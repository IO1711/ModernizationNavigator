import path from 'node:path';

import { loadPythonFrameworkRules } from '@modernization-navigator/knowledge-base';
import {
  DefaultOsvProvider,
  DefaultPyPIProvider,
  type OsvProvider,
  type PyPIProvider
} from '@modernization-navigator/providers';
import type {
  CollectEnvironmentEvidenceResult,
  CompareUpgradePathsResult,
  EnvironmentEvidenceEntry,
  InspectFrameworkDependenciesResult,
  InspectPlatformConfigResult,
  InspectSourceRisksResult,
  Issue,
  ProjectDescriptor,
  StackProfile,
  ValidationStep
} from '@modernization-navigator/shared';

import { mergeIssues } from '../../report/merge-issues';
import {
  readTextIfExists,
  toRelative,
  walkFiles
} from '../../internal/file-utils';
import { sanitizeIssueIdPart } from '../../internal/version-utils';
import type {
  FrameworkAdapter,
  FrameworkResolution,
  FrameworkToolInput
} from '../framework-adapter';
import {
  collectPythonProjects,
  comparePythonVersionTuples,
  compareVersionStrings,
  formatPythonVersionTuple,
  loadPythonProject,
  parsePythonVersionTuple,
  type PythonDependency,
  type PythonDependencyManager,
  type PythonFramework,
  type PythonProject
} from './project-inspection';

const OSV_TIMEOUT_MS = 1_250;
const PYPI_TIMEOUT_MS = 1_250;

type PythonVersionCompatibilityIssue = {
  requiresPython: string;
  source: string;
};

function sortDescriptors(
  descriptors: ProjectDescriptor[]
): ProjectDescriptor[] {
  return [...descriptors].sort((left, right) => {
    return (
      left.rootPath.localeCompare(right.rootPath) ||
      right.confidence - left.confidence ||
      left.framework.localeCompare(right.framework)
    );
  });
}

function clampScore(value: number): number {
  return Math.max(1, Math.min(10, Number(value.toFixed(1))));
}

function buildInstallCommand(
  dependencyManager: PythonDependencyManager,
  project: PythonProject
): string {
  switch (dependencyManager) {
    case 'poetry':
      return 'poetry install';
    case 'uv':
      return 'uv sync';
    case 'pipenv':
      return 'pipenv install';
    default:
      return project.dependencies.some((dependency) => dependency.filePath.endsWith('requirements.txt'))
        ? 'python -m pip install -r requirements.txt'
        : 'python -m pip install -e .';
  }
}

function buildTestCommand(
  dependencyManager: PythonDependencyManager
): string {
  switch (dependencyManager) {
    case 'poetry':
      return 'poetry run pytest';
    case 'uv':
      return 'uv run pytest';
    case 'pipenv':
      return 'pipenv run pytest';
    default:
      return 'pytest';
  }
}

function buildHealthCommand(
  framework: PythonFramework,
  dependencyManager: PythonDependencyManager
): string {
  switch (framework) {
    case 'django':
      return dependencyManager === 'poetry'
        ? 'poetry run python manage.py check'
        : dependencyManager === 'uv'
          ? 'uv run python manage.py check'
          : dependencyManager === 'pipenv'
            ? 'pipenv run python manage.py check'
            : 'python manage.py check';
    default:
      return dependencyManager === 'poetry'
        ? 'poetry run python -m compileall .'
        : dependencyManager === 'uv'
          ? 'uv run python -m compileall .'
          : dependencyManager === 'pipenv'
            ? 'pipenv run python -m compileall .'
            : 'python -m compileall .';
  }
}

function buildValidationSteps(
  project: PythonProject,
  targetVersion: string | undefined,
  title: string
): ValidationStep[] {
  return [
    {
      title,
      commands: [
        buildInstallCommand(project.dependencyManager, project),
        buildTestCommand(project.dependencyManager),
        buildHealthCommand(project.framework, project.dependencyManager)
      ],
      expectedResult: `Install, test, and runtime health checks complete without ${project.framework} compatibility regressions${targetVersion ? ` on Python ${targetVersion}` : ''}.`
    }
  ];
}

function createDependencyIssue(options: {
  id: string;
  title: string;
  issue: string;
  incompatibilityReason: string;
  recommendation: string;
  dependency: PythonDependency;
  project: PythonProject;
  targetVersion?: string;
}): Issue {
  return {
    id: options.id,
    category: 'dependency',
    title: options.title,
    issue: options.issue,
    incompatibilityReason: options.incompatibilityReason,
    defaultTechnicalRecommendation: options.recommendation,
    alternativeSolutions: [],
    affectedFiles: [options.dependency.filePath],
    evidence: [
      {
        kind: 'package',
        filePath: options.dependency.filePath,
        summary: `${options.dependency.name} is declared in ${options.dependency.source}.`,
        packageName: options.dependency.name,
        snippet: `${options.dependency.name}${options.dependency.spec ? options.dependency.spec : ''}`
      }
    ],
    recommendedCommands: [
      buildInstallCommand(options.project.dependencyManager, options.project),
      buildTestCommand(options.project.dependencyManager),
      buildHealthCommand(options.project.framework, options.project.dependencyManager)
    ],
    validationSteps: buildValidationSteps(
      options.project,
      options.targetVersion,
      options.title
    )
  };
}

function categoryFromEvidenceKind(
  kind: EnvironmentEvidenceEntry['kind']
): Issue['category'] {
  switch (kind) {
    case 'docker':
      return 'docker';
    case 'github-actions':
      return 'ci';
    case 'deployment':
      return 'deployment';
    case 'script':
      return 'script';
    default:
      return 'runtime';
  }
}

function comparePythonVersions(left: string, right: string): number {
  const leftTuple = parsePythonVersionTuple(left);
  const rightTuple = parsePythonVersionTuple(right);

  if (!leftTuple || !rightTuple) {
    return 0;
  }

  return comparePythonVersionTuples(leftTuple, rightTuple);
}

function pickMostCommonPythonVersion(
  values: string[]
): [number, number] | null {
  const counts = new Map<string, number>();

  for (const value of values) {
    const version = parsePythonVersionTuple(value);

    if (!version) {
      continue;
    }

    const key = formatPythonVersionTuple(version);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  const ranked = [...counts.entries()].sort((left, right) => {
    return right[1] - left[1] || left[0].localeCompare(right[0]);
  });

  return ranked[0] ? parsePythonVersionTuple(ranked[0][0]) : null;
}

function rangeSeemsToSupportPythonVersion(
  range: string | undefined,
  targetVersion: string
): boolean {
  if (!range) {
    return true;
  }

  const target = parsePythonVersionTuple(targetVersion);

  if (!target) {
    return true;
  }

  const normalized = range.replace(/\s+/g, '');

  if (normalized.includes('||')) {
    return normalized
      .split('||')
      .some((segment) => rangeSeemsToSupportPythonVersion(segment, targetVersion));
  }

  const constraints = normalized.split(',').filter(Boolean);

  for (const constraint of constraints) {
    const match = constraint.match(/^(<=|>=|<|>|==|~=|\^)?(\d+)(?:\.(\d+))?/);

    if (!match) {
      continue;
    }

    const operator = match[1] ?? '==';
    const version: [number, number] = [
      Number.parseInt(match[2] ?? '0', 10),
      Number.parseInt(match[3] ?? '0', 10)
    ];
    const comparison = comparePythonVersionTuples(target, version);

    if (operator === '<' && comparison >= 0) {
      return false;
    }

    if (operator === '<=' && comparison > 0) {
      return false;
    }

    if (operator === '>' && comparison <= 0) {
      return false;
    }

    if (operator === '>=' && comparison < 0) {
      return false;
    }

    if (operator === '==' && comparison !== 0) {
      return false;
    }

    if ((operator === '~=' || operator === '^') && target[0] !== version[0]) {
      return false;
    }

    if ((operator === '~=' || operator === '^') && comparison < 0) {
      return false;
    }
  }

  return true;
}

async function safeQueryPythonVulnerabilities(
  osvProvider: OsvProvider,
  packageName: string,
  version: string,
  input: FrameworkToolInput
) {
  try {
    return await osvProvider.queryPackageVulnerabilities('PyPI', packageName, version, {
      offline: input.offline,
      timeoutMs: OSV_TIMEOUT_MS
    });
  } catch {
    return null;
  }
}

async function safeFetchPyPIMetadata(
  pypiProvider: PyPIProvider,
  packageName: string,
  version: string | undefined,
  input: FrameworkToolInput
) {
  try {
    return await pypiProvider.fetchPackageMetadata(packageName, version, {
      offline: input.offline,
      timeoutMs: PYPI_TIMEOUT_MS
    });
  } catch {
    return null;
  }
}

function sortIssues(issues: Issue[]): Issue[] {
  return [...issues].sort((left, right) => {
    return (
      left.id.localeCompare(right.id) ||
      left.affectedFiles.join('|').localeCompare(right.affectedFiles.join('|'))
    );
  });
}

function createRuntimeDriftIssue(
  evidence: EnvironmentEvidenceEntry,
  expectedVersion: string,
  project: PythonProject,
  targetVersion?: string
): Issue {
  const category = categoryFromEvidenceKind(evidence.kind);

  return {
    id: `python-runtime-${category}-${sanitizeIssueIdPart(evidence.filePath)}`,
    category,
    title: `${evidence.filePath} declares Python ${evidence.value} instead of ${expectedVersion}`,
    issue: `${evidence.filePath} contains a ${evidence.kind} Python declaration for ${evidence.value}, which differs from the ${targetVersion ? `requested target Python ${targetVersion}` : `detected baseline Python ${expectedVersion}`}.`,
    incompatibilityReason:
      'Python runtime declarations that drift across local, CI, Docker, and deployment surfaces can break upgrades even when the application code is unchanged.',
    defaultTechnicalRecommendation:
      'Align all Python runtime declarations to the same target before finalizing the framework upgrade.',
    alternativeSolutions: [],
    affectedFiles: [evidence.filePath],
    evidence: [
      {
        kind:
          evidence.kind === 'docker' ||
          evidence.kind === 'github-actions' ||
          evidence.kind === 'deployment' ||
          evidence.kind === 'script'
            ? evidence.kind
            : 'package',
        filePath: evidence.filePath,
        summary: 'Python runtime declaration differs from the expected baseline.',
        source: evidence.source,
        snippet: evidence.value
      }
    ],
    recommendedCommands: [
      `rg -n "python|PYTHON_VERSION|python-version|runtime.txt" ${evidence.filePath}`,
      buildTestCommand(project.dependencyManager),
      buildHealthCommand(project.framework, project.dependencyManager)
    ],
    validationSteps: buildValidationSteps(
      project,
      targetVersion,
      `Validate runtime alignment for ${evidence.filePath}`
    )
  };
}

function extractDeclaredDependency(
  project: PythonProject,
  packageName: string
): PythonDependency | null {
  return (
    project.dependencies.find(
      (dependency) => dependency.name === packageName
    ) ?? null
  );
}

function toRepoRelativeProjectPath(
  project: PythonProject,
  absoluteFilePath: string
): string {
  const relativePath = toRelative(project.absoluteRoot, absoluteFilePath);
  return project.rootPath === '.'
    ? relativePath
    : `${project.rootPath}/${relativePath}`;
}

function inferManifestFilePath(project: PythonProject): string {
  return (
    project.dependencies[0]?.filePath ??
    project.environmentEvidence[0]?.filePath ??
    (project.rootPath === '.' ? 'pyproject.toml' : `${project.rootPath}/pyproject.toml`)
  );
}

async function collectDeploymentCommandFiles(
  project: PythonProject
): Promise<Array<{ filePath: string; content: string }>> {
  const candidateFiles = await walkFiles(
    project.absoluteRoot,
    (filePath) =>
      path.basename(filePath) === 'Procfile' ||
      /(^|\/)Dockerfile(?:\.[^/]+)?$/i.test(filePath) ||
      filePath.endsWith('render.yaml') ||
      filePath.endsWith('render.yml'),
    3
  );
  const files = await Promise.all(
    candidateFiles.map(async (filePath) => ({
      filePath: toRepoRelativeProjectPath(project, filePath),
      absolutePath: filePath,
      content: (await readTextIfExists(filePath)) ?? ''
    }))
  );

  return files
    .filter((file) => file.content.length > 0)
    .map(({ filePath, content }) => ({ filePath, content }));
}

function buildPythonComparison(options: {
  targetVersion?: string;
  issues: Issue[];
  evidence: EnvironmentEvidenceEntry[];
}): CompareUpgradePathsResult {
  const targetVersion = options.targetVersion ?? 'unknown';
  const issueCountByCategory: Record<Issue['category'], number> = {
    ci: 0,
    dependency: 0,
    deployment: 0,
    docker: 0,
    runtime: 0,
    script: 0,
    source: 0
  };

  for (const issue of options.issues) {
    issueCountByCategory[issue.category] += 1;
  }

  const targetTuple = parsePythonVersionTuple(targetVersion);
  const currentTuple = pickMostCommonPythonVersion(
    options.evidence.map((entry) => entry.value)
  );
  const minorJump =
    targetTuple && currentTuple && targetTuple[0] === currentTuple[0]
      ? Math.max(0, targetTuple[1] - currentTuple[1])
      : targetTuple && currentTuple
        ? Math.max(1, targetTuple[0] - currentTuple[0]) * 4
        : 0;
  const blockerTitles = [...new Set(options.issues.map((issue) => issue.title))].sort(
    (left, right) => left.localeCompare(right)
  );
  const directRisk = clampScore(
    2 +
      issueCountByCategory.dependency * 1.5 +
      issueCountByCategory.source * 1.2 +
      (issueCountByCategory.runtime +
        issueCountByCategory.ci +
        issueCountByCategory.docker +
        issueCountByCategory.deployment +
        issueCountByCategory.script) *
        0.8 +
      minorJump * 0.35
  );
  const directEffort = clampScore(
    2 +
      options.issues.length * 0.55 +
      issueCountByCategory.dependency * 0.45 +
      issueCountByCategory.source * 0.45 +
      minorJump * 0.25
  );
  const directPath = {
    label: 'direct-upgrade',
    targetVersion,
    riskScore: directRisk,
    effortScore: directEffort,
    blockers: blockerTitles
  };
  const shouldOfferStagedPath =
    minorJump >= 2 ||
    directRisk >= 6 ||
    issueCountByCategory.dependency > 0 ||
    issueCountByCategory.source > 0;

  if (!shouldOfferStagedPath) {
    return {
      comparedPaths: [directPath],
      recommendedPathCandidate: directPath.label
    };
  }

  const stagedPath = {
    label: 'staged-upgrade',
    targetVersion,
    riskScore: clampScore(directRisk - 1.4),
    effortScore: clampScore(directEffort + 1.5 + minorJump * 0.15),
    blockers: blockerTitles.filter((title) =>
      options.issues.some(
        (issue) =>
          issue.title === title &&
          (issue.category === 'dependency' || issue.category === 'source')
      )
    )
  };

  return {
    comparedPaths: [directPath, stagedPath],
    recommendedPathCandidate:
      stagedPath.riskScore * 1.3 + stagedPath.effortScore <
      directPath.riskScore * 1.3 + directPath.effortScore
        ? stagedPath.label
        : directPath.label
  };
}

async function collectPythonSourceRiskIssues(
  project: PythonProject,
  targetVersion?: string
): Promise<Issue[]> {
  const issues: Issue[] = [];
  const sourceFiles = await walkFiles(
    project.absoluteRoot,
    (filePath) => filePath.endsWith('.py'),
    6
  );

  for (const sourceFile of sourceFiles) {
    const content = await readTextIfExists(sourceFile);

    if (!content) {
      continue;
    }

    const relativeFilePath = toRepoRelativeProjectPath(project, sourceFile);

    if (
      project.framework === 'fastapi' &&
      /\buvicorn\.run\s*\([\s\S]*reload\s*=\s*True/.test(content)
    ) {
      issues.push({
        id: `python-source-fastapi-reload-${sanitizeIssueIdPart(relativeFilePath)}`,
        category: 'source',
        title: 'FastAPI source enables uvicorn reload mode',
        issue:
          'This source file enables uvicorn reload mode in application code, which is a development-only behavior that should not ride into production runtime upgrades.',
        incompatibilityReason:
          'Development reload flags can hide production startup behavior and deployment drift during framework modernization.',
        defaultTechnicalRecommendation:
          'Move reload settings into local-only launch commands and validate the ASGI app without reload mode.',
        alternativeSolutions: [],
        affectedFiles: [relativeFilePath],
        evidence: [
          {
            kind: 'source',
            filePath: relativeFilePath,
            summary: 'uvicorn.run(... reload=True) appears in source.',
            snippet: 'uvicorn.run(..., reload=True)'
          }
        ],
        recommendedCommands: [
          `rg -n "uvicorn\\.run|reload\\s*=\\s*True" ${relativeFilePath}`,
          buildTestCommand(project.dependencyManager),
          buildHealthCommand(project.framework, project.dependencyManager)
        ],
        validationSteps: buildValidationSteps(
          project,
          targetVersion,
          'Validate FastAPI startup without reload mode'
        )
      });
    }

    if (
      project.framework === 'flask' &&
      /\.run\s*\([\s\S]*debug\s*=\s*True/.test(content)
    ) {
      issues.push({
        id: `python-source-flask-debug-${sanitizeIssueIdPart(relativeFilePath)}`,
        category: 'source',
        title: 'Flask source enables debug mode',
        issue:
          'This source file enables Flask debug mode in application code, which increases rollout risk during runtime or deployment upgrades.',
        incompatibilityReason:
          'Debug mode changes serving behavior and should not be treated as a production validation baseline.',
        defaultTechnicalRecommendation:
          'Remove debug=True from committed runtime startup paths and validate with the production serving stack.',
        alternativeSolutions: [],
        affectedFiles: [relativeFilePath],
        evidence: [
          {
            kind: 'source',
            filePath: relativeFilePath,
            summary: 'Flask app.run(... debug=True) appears in source.',
            snippet: 'app.run(..., debug=True)'
          }
        ],
        recommendedCommands: [
          `rg -n "debug\\s*=\\s*True|\\.run\\(" ${relativeFilePath}`,
          buildTestCommand(project.dependencyManager),
          buildHealthCommand(project.framework, project.dependencyManager)
        ],
        validationSteps: buildValidationSteps(
          project,
          targetVersion,
          'Validate Flask startup without debug mode'
        )
      });
    }

    if (
      project.framework === 'django' &&
      /(^|\n)\s*DEBUG\s*=\s*True\b/.test(content) &&
      relativeFilePath.endsWith('settings.py')
    ) {
      issues.push({
        id: `python-source-django-debug-${sanitizeIssueIdPart(relativeFilePath)}`,
        category: 'source',
        title: 'Django settings enable DEBUG = True',
        issue:
          'This Django settings file leaves DEBUG enabled, which increases risk when validating a runtime or framework upgrade against production-like behavior.',
        incompatibilityReason:
          'DEBUG=True changes static-file, error-handling, and middleware behavior that can mask deployment issues.',
        defaultTechnicalRecommendation:
          'Validate the upgraded Django app with production-like settings and keep DEBUG disabled outside local development.',
        alternativeSolutions: [],
        affectedFiles: [relativeFilePath],
        evidence: [
          {
            kind: 'source',
            filePath: relativeFilePath,
            summary: 'DEBUG = True appears in Django settings.',
            snippet: 'DEBUG = True'
          }
        ],
        recommendedCommands: [
          `rg -n "DEBUG\\s*=\\s*True" ${relativeFilePath}`,
          buildTestCommand(project.dependencyManager),
          buildHealthCommand(project.framework, project.dependencyManager)
        ],
        validationSteps: buildValidationSteps(
          project,
          targetVersion,
          'Validate Django with production-like settings'
        )
      });
    }
  }

  return sortIssues(issues);
}

export class PythonFrameworkAdapter implements FrameworkAdapter {
  readonly ecosystem = 'python' as const;

  constructor(
    readonly framework: PythonFramework,
    private readonly osvProvider: OsvProvider = new DefaultOsvProvider(),
    private readonly pypiProvider: PyPIProvider = new DefaultPyPIProvider()
  ) {}

  async detectProjects(input: FrameworkToolInput): Promise<ProjectDescriptor[]> {
    const projects = await collectPythonProjects(input.repoRoot, input.subdirectory);

    return sortDescriptors(
      projects
        .filter((project) => project.framework === this.framework)
        .map((project) => ({
          rootPath: project.rootPath,
          ecosystem: 'python',
          framework: project.framework,
          language: 'python',
          runtimeName: 'python',
          dependencyManager: project.dependencyManager,
          buildSystem: project.buildSystem,
          confidence: project.confidence,
          markers: project.markers
        }))
    );
  }

  async collectEnvironmentEvidence(
    input: FrameworkToolInput,
    resolution: FrameworkResolution
  ): Promise<CollectEnvironmentEvidenceResult> {
    const project = await loadPythonProject(
      input.repoRoot,
      resolution.primaryDescriptor.rootPath
    );

    if (!project) {
      throw new Error(
        `Could not load Python project at ${resolution.primaryDescriptor.rootPath}.`
      );
    }

    const stackProfile: StackProfile = {
      ecosystem: 'python',
      framework: project.framework,
      language: 'python',
      runtimeName: 'python',
      dependencyManager: project.dependencyManager,
      buildSystem: project.buildSystem
    };
    const environmentEvidence = [...project.environmentEvidence];
    const manifestFilePath = inferManifestFilePath(project);

    environmentEvidence.push({
      source: 'framework',
      filePath: manifestFilePath,
      value: project.framework,
      kind: 'framework'
    });
    environmentEvidence.push({
      source: 'dependency-manager',
      filePath: manifestFilePath,
      value: project.dependencyManager,
      kind: 'dependency-manager'
    });

    if (project.buildSystem) {
      environmentEvidence.push({
        source: 'build-system',
        filePath: manifestFilePath,
        value: project.buildSystem,
        kind: 'build-system'
      });
    }

    return {
      stackProfile,
      projectDescriptors: resolution.projectDescriptors,
      environmentEvidence
    };
  }

  async inspectFrameworkDependencies(
    input: FrameworkToolInput,
    resolution: FrameworkResolution
  ): Promise<InspectFrameworkDependenciesResult> {
    const project = await loadPythonProject(
      input.repoRoot,
      resolution.primaryDescriptor.rootPath
    );

    if (!project) {
      throw new Error(
        `Could not load Python project at ${resolution.primaryDescriptor.rootPath}.`
      );
    }

    const issues: Issue[] = [];
    const frameworkRules = loadPythonFrameworkRules();

    for (const frameworkRule of frameworkRules) {
      const dependency = frameworkRule.match.packageName
        ? extractDeclaredDependency(project, frameworkRule.match.packageName)
        : null;

      if (!dependency) {
        continue;
      }

      if (
        frameworkRule.match.maxRecommendedMajor !== undefined &&
        dependency.exactVersion
      ) {
        const versionMajor = Number.parseInt(
          dependency.exactVersion.split('.')[0] ?? '0',
          10
        );

        if (versionMajor <= frameworkRule.match.maxRecommendedMajor) {
          issues.push(
            createDependencyIssue({
              id: `python-${frameworkRule.id}-${sanitizeIssueIdPart(dependency.filePath)}`,
              title: frameworkRule.title,
              issue: `${dependency.name} is pinned to ${dependency.exactVersion}, which is at or below the legacy major threshold ${frameworkRule.match.maxRecommendedMajor}.`,
              incompatibilityReason: frameworkRule.incompatibilityReason,
              recommendation: frameworkRule.defaultTechnicalRecommendation,
              dependency,
              project,
              targetVersion: input.targetVersion
            })
          );
        }
      }

      if (
        frameworkRule.match.minRecommendedVersion &&
        dependency.exactVersion &&
        compareVersionStrings(
          dependency.exactVersion,
          frameworkRule.match.minRecommendedVersion
        ) < 0
      ) {
        issues.push(
          createDependencyIssue({
            id: `python-${frameworkRule.id}-${sanitizeIssueIdPart(dependency.filePath)}`,
            title: frameworkRule.title,
            issue: `${dependency.name} is pinned to ${dependency.exactVersion}, which is below the compatibility baseline ${frameworkRule.match.minRecommendedVersion}.`,
            incompatibilityReason: frameworkRule.incompatibilityReason,
            recommendation: frameworkRule.defaultTechnicalRecommendation,
            dependency,
            project,
            targetVersion: input.targetVersion
          })
        );
      }
    }

    for (const dependency of project.dependencies) {
      if (!dependency.exactVersion) {
        continue;
      }

      const vulnerabilities = await safeQueryPythonVulnerabilities(
        this.osvProvider,
        dependency.name,
        dependency.exactVersion,
        input
      );

      if (vulnerabilities?.vulns?.length) {
        issues.push(
          createDependencyIssue({
            id: `python-osv-${dependency.name}-${sanitizeIssueIdPart(dependency.filePath)}`,
            title: `${dependency.name} has known vulnerability advisories`,
            issue: `${dependency.name}@${dependency.exactVersion} returned ${vulnerabilities.vulns.length} OSV advisory result(s), so it should be reviewed during the upgrade.`,
            incompatibilityReason:
              'Known vulnerability advisories can force package upgrades alongside runtime or framework modernization.',
            recommendation:
              'Review OSV advisories for the affected package version and upgrade or replace the dependency before final rollout.',
            dependency,
            project,
            targetVersion: input.targetVersion
          })
        );
      }

      if (!input.targetVersion) {
        continue;
      }

      const pypiMetadata = await safeFetchPyPIMetadata(
        this.pypiProvider,
        dependency.name,
        dependency.exactVersion,
        input
      );
      const requiresPythonCandidates = [
        pypiMetadata?.info?.requires_python,
        ...(pypiMetadata?.urls ?? []).map((file) => file.requires_python ?? undefined)
      ].filter((candidate): candidate is string => Boolean(candidate));
      const incompatibleRange = requiresPythonCandidates.find(
        (candidate) => !rangeSeemsToSupportPythonVersion(candidate, input.targetVersion!)
      );

      if (incompatibleRange) {
        issues.push(
          createDependencyIssue({
            id: `python-requires-python-${dependency.name}-${sanitizeIssueIdPart(dependency.filePath)}`,
            title: `${dependency.name} declares incompatible requires_python metadata`,
            issue: `${dependency.name}@${dependency.exactVersion} declares requires_python=${incompatibleRange}, which may not support the requested target Python ${input.targetVersion}.`,
            incompatibilityReason:
              'Package-level Python version metadata can block a runtime upgrade even when the framework itself is otherwise compatible.',
            recommendation:
              'Upgrade the package or choose a target Python version that satisfies the package metadata before the final cutover.',
            dependency,
            project,
            targetVersion: input.targetVersion
          })
        );
      }
    }

    return {
      issues: sortIssues(issues),
      summary:
        issues.length === 0
          ? 'No Python framework dependency issues detected.'
          : `Detected ${issues.length} Python dependency issue(s).`
    };
  }

  async inspectPlatformConfig(
    input: FrameworkToolInput,
    resolution: FrameworkResolution
  ): Promise<InspectPlatformConfigResult> {
    const project = await loadPythonProject(
      input.repoRoot,
      resolution.primaryDescriptor.rootPath
    );

    if (!project) {
      throw new Error(
        `Could not load Python project at ${resolution.primaryDescriptor.rootPath}.`
      );
    }

    const issues: Issue[] = [];
    const targetVersionTuple = parsePythonVersionTuple(input.targetVersion);
    const baselineVersionTuple =
      targetVersionTuple ??
      pickMostCommonPythonVersion(project.environmentEvidence.map((entry) => entry.value));
    const baselineVersion = baselineVersionTuple
      ? formatPythonVersionTuple(baselineVersionTuple)
      : null;

    if (baselineVersion) {
      for (const evidence of project.environmentEvidence) {
        if (
          !['runtime', 'docker', 'github-actions', 'deployment', 'script'].includes(
            evidence.kind
          )
        ) {
          continue;
        }

        const versionTuple = parsePythonVersionTuple(evidence.value);

        if (!versionTuple || comparePythonVersionTuples(versionTuple, baselineVersionTuple!) === 0) {
          continue;
        }

        issues.push(
          createRuntimeDriftIssue(
            evidence,
            baselineVersion,
            project,
            input.targetVersion
          )
        );
      }
    }

    const deploymentDependencies = new Set(
      project.dependencies.map((dependency) => dependency.name)
    );

    if (
      project.framework === 'fastapi' &&
      !['uvicorn', 'hypercorn', 'gunicorn'].some((packageName) =>
        deploymentDependencies.has(packageName)
      )
    ) {
      issues.push({
        id: `python-platform-asgi-server-${sanitizeIssueIdPart(project.rootPath)}`,
        category: 'deployment',
        title: 'FastAPI project does not declare an ASGI server dependency',
        issue:
          'The project is classified as FastAPI but no uvicorn, hypercorn, or gunicorn dependency was found for deployment validation.',
        incompatibilityReason:
          'FastAPI applications need an ASGI-serving path to validate framework and runtime upgrades under production-like behavior.',
        defaultTechnicalRecommendation:
          'Declare and validate the ASGI server dependency you plan to use in deployment before finalizing the upgrade.',
        alternativeSolutions: [],
        affectedFiles: [...new Set(project.dependencies.map((dependency) => dependency.filePath))],
        evidence: [
          {
            kind: 'deployment',
            filePath:
              project.dependencies[0]?.filePath ??
              (project.rootPath === '.' ? 'pyproject.toml' : `${project.rootPath}/pyproject.toml`),
            summary: 'FastAPI markers were found, but no deployment server dependency marker was found.',
            snippet: 'Expected one of: uvicorn, hypercorn, gunicorn'
          }
        ],
        recommendedCommands: [
          'rg -n "uvicorn|hypercorn|gunicorn" pyproject.toml requirements*.txt Pipfile poetry.lock uv.lock',
          buildTestCommand(project.dependencyManager),
          buildHealthCommand(project.framework, project.dependencyManager)
        ],
        validationSteps: buildValidationSteps(
          project,
          input.targetVersion,
          'Validate FastAPI with an explicit ASGI server dependency'
        )
      });
    }

    const deploymentCommandFiles = await collectDeploymentCommandFiles(project);

    for (const deploymentFile of deploymentCommandFiles) {
      if (
        project.framework === 'django' &&
        /\bmanage\.py\s+runserver\b/.test(deploymentFile.content)
      ) {
        issues.push({
          id: `python-platform-django-runserver-${sanitizeIssueIdPart(deploymentFile.filePath)}`,
          category: 'deployment',
          title: 'Django deployment path uses runserver',
          issue:
            `${deploymentFile.filePath} appears to use Django's development server, which is not a production validation baseline for a runtime upgrade.`,
          incompatibilityReason:
            'The Django development server does not represent the production serving path that must be validated during a framework or runtime upgrade.',
          defaultTechnicalRecommendation:
            'Validate Django with the intended production server such as gunicorn, uvicorn, or daphne.',
          alternativeSolutions: [],
          affectedFiles: [deploymentFile.filePath],
          evidence: [
            {
              kind: 'deployment',
              filePath: deploymentFile.filePath,
              summary: 'Deployment file references manage.py runserver.',
              snippet: 'manage.py runserver'
            }
          ],
          recommendedCommands: [
            `rg -n "manage\\.py runserver" ${deploymentFile.filePath}`,
            buildTestCommand(project.dependencyManager),
            buildHealthCommand(project.framework, project.dependencyManager)
          ],
          validationSteps: buildValidationSteps(
            project,
            input.targetVersion,
            'Validate Django with the production serving command'
          )
        });
      }

      if (
        project.framework === 'flask' &&
        /\bflask\s+run\b/.test(deploymentFile.content)
      ) {
        issues.push({
          id: `python-platform-flask-run-${sanitizeIssueIdPart(deploymentFile.filePath)}`,
          category: 'deployment',
          title: 'Flask deployment path uses the development server',
          issue:
            `${deploymentFile.filePath} appears to use \`flask run\`, which is a development serving path and not the production baseline for upgrade validation.`,
          incompatibilityReason:
            'Using the Flask development server in deployment validation can hide production-serving issues during runtime or dependency upgrades.',
          defaultTechnicalRecommendation:
            'Validate Flask with the production server stack you plan to deploy, such as gunicorn or waitress.',
          alternativeSolutions: [],
          affectedFiles: [deploymentFile.filePath],
          evidence: [
            {
              kind: 'deployment',
              filePath: deploymentFile.filePath,
              summary: 'Deployment file references flask run.',
              snippet: 'flask run'
            }
          ],
          recommendedCommands: [
            `rg -n "flask run" ${deploymentFile.filePath}`,
            buildTestCommand(project.dependencyManager),
            buildHealthCommand(project.framework, project.dependencyManager)
          ],
          validationSteps: buildValidationSteps(
            project,
            input.targetVersion,
            'Validate Flask with the production serving command'
          )
        });
      }

      if (
        project.framework === 'fastapi' &&
        /\buvicorn\b[\s\S]*--reload\b/.test(deploymentFile.content)
      ) {
        issues.push({
          id: `python-platform-fastapi-reload-${sanitizeIssueIdPart(deploymentFile.filePath)}`,
          category: 'deployment',
          title: 'FastAPI deployment path enables reload mode',
          issue:
            `${deploymentFile.filePath} appears to run uvicorn with --reload, which is a development-only setting and not a production upgrade baseline.`,
          incompatibilityReason:
            'Reload mode changes process behavior and can mask production-serving issues during runtime or framework upgrades.',
          defaultTechnicalRecommendation:
            'Remove --reload from deployment commands and validate the ASGI app under production-like startup conditions.',
          alternativeSolutions: [],
          affectedFiles: [deploymentFile.filePath],
          evidence: [
            {
              kind: 'deployment',
              filePath: deploymentFile.filePath,
              summary: 'Deployment file references uvicorn --reload.',
              snippet: 'uvicorn ... --reload'
            }
          ],
          recommendedCommands: [
            `rg -n "uvicorn|--reload" ${deploymentFile.filePath}`,
            buildTestCommand(project.dependencyManager),
            buildHealthCommand(project.framework, project.dependencyManager)
          ],
          validationSteps: buildValidationSteps(
            project,
            input.targetVersion,
            'Validate FastAPI without reload mode in deployment commands'
          )
        });
      }
    }

    return {
      issues: sortIssues(issues),
      summary:
        issues.length === 0
          ? 'No Python platform or runtime issues detected.'
          : `Detected ${issues.length} Python platform/runtime issue(s).`
    };
  }

  async inspectSourceRisks(
    input: FrameworkToolInput,
    resolution: FrameworkResolution
  ): Promise<InspectSourceRisksResult> {
    const project = await loadPythonProject(
      input.repoRoot,
      resolution.primaryDescriptor.rootPath
    );

    if (!project) {
      throw new Error(
        `Could not load Python project at ${resolution.primaryDescriptor.rootPath}.`
      );
    }

    const issues = await collectPythonSourceRiskIssues(project, input.targetVersion);

    return {
      issues,
      summary:
        issues.length === 0
          ? 'No Python source-risk patterns detected.'
          : `Detected ${issues.length} Python source-risk issue(s).`
    };
  }

  async compareUpgradePaths(
    input: FrameworkToolInput,
    resolution: FrameworkResolution
  ): Promise<CompareUpgradePathsResult> {
    const project = await loadPythonProject(
      input.repoRoot,
      resolution.primaryDescriptor.rootPath
    );

    if (!project) {
      throw new Error(
        `Could not load Python project at ${resolution.primaryDescriptor.rootPath}.`
      );
    }

    const [dependencyResult, platformResult, sourceResult] = await Promise.all([
      this.inspectFrameworkDependencies(input, resolution),
      this.inspectPlatformConfig(input, resolution),
      this.inspectSourceRisks(input, resolution)
    ]);

    return buildPythonComparison({
      targetVersion: input.targetVersion,
      issues: mergeIssues(
        dependencyResult.issues,
        platformResult.issues,
        sourceResult.issues
      ),
      evidence: project.environmentEvidence
    });
  }
}
