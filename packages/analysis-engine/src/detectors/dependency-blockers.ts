import path from 'node:path';

import { loadPackageCompatibilityRules } from '@modernization-navigator/knowledge-base';
import {
  DefaultNpmRegistryProvider,
  DefaultOsvProvider,
  type NpmRegistryProvider,
  type OsvProvider
} from '@modernization-navigator/providers';
import type {
  AlternativeSolution,
  EvidenceItem,
  InspectDependencyBlockersResult,
  Issue,
  ValidationStep
} from '@modernization-navigator/shared';

import {
  fileExists,
  readJsonIfExists,
  readTextIfExists,
  resolveAnalysisRoot,
  toRelative,
  uniqueStrings
} from '../internal/file-utils';
import {
  extractMajorVersion,
  rangeSeemsToSupportMajor,
  sanitizeIssueIdPart
} from '../internal/version-utils';
import { detectPackageManager } from './package-manager';

type DependencySection =
  | 'dependencies'
  | 'devDependencies'
  | 'optionalDependencies'
  | 'peerDependencies';

type PackageJsonShape = {
  scripts?: Record<string, string>;
} & Partial<Record<DependencySection, Record<string, string>>>;

type DeclaredDependency = {
  name: string;
  spec: string;
  section: DependencySection;
};

type DetectionOptions = {
  subdirectory?: string;
  targetNodeVersion?: string;
  offline?: boolean;
};

type DetectionProviders = {
  npmRegistryProvider?: NpmRegistryProvider;
  osvProvider?: OsvProvider;
};

const DEPENDENCY_SECTIONS: DependencySection[] = [
  'dependencies',
  'optionalDependencies',
  'peerDependencies',
  'devDependencies'
];

const PROVIDER_TIMEOUT_MS = 1_250;

async function safeFetchPackageMetadata(
  provider: NpmRegistryProvider,
  packageName: string
) {
  try {
    return await provider.fetchPackageMetadata(packageName, {
      timeoutMs: PROVIDER_TIMEOUT_MS
    });
  } catch {
    return null;
  }
}

async function safeQueryPackageVulnerabilities(
  provider: OsvProvider,
  packageName: string,
  version: string
) {
  try {
    return await provider.queryPackageVulnerabilities(
      'npm',
      packageName,
      version,
      {
        timeoutMs: PROVIDER_TIMEOUT_MS
      }
    );
  } catch {
    return null;
  }
}

function collectDeclaredDependencies(packageJson: PackageJsonShape): DeclaredDependency[] {
  const dependencies: DeclaredDependency[] = [];

  for (const section of DEPENDENCY_SECTIONS) {
    for (const [name, spec] of Object.entries(packageJson[section] ?? {}).sort(
      ([leftName], [rightName]) => leftName.localeCompare(rightName)
    )) {
      dependencies.push({
        name,
        spec,
        section
      });
    }
  }

  return dependencies;
}

function detectExactVersion(versionSpec: string): string | null {
  const normalizedVersion = versionSpec.trim().replace(/^workspace:/, '');
  return /^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(normalizedVersion)
    ? normalizedVersion
    : null;
}

function buildUpgradeCommand(
  packageManager: 'npm' | 'pnpm' | 'yarn',
  packageName: string
): string {
  if (packageManager === 'npm') {
    return `npm install ${packageName}@latest`;
  }

  return `${packageManager} up ${packageName}`;
}

function buildInstallCommand(packageManager: 'npm' | 'pnpm' | 'yarn'): string {
  return packageManager === 'yarn' ? 'yarn install' : `${packageManager} install`;
}

function buildTestCommand(packageManager: 'npm' | 'pnpm' | 'yarn'): string {
  return packageManager === 'npm' ? 'npm test' : `${packageManager} test`;
}

function buildBuildCommand(packageManager: 'npm' | 'pnpm' | 'yarn'): string {
  return packageManager === 'npm' ? 'npm run build' : `${packageManager} build`;
}

function buildValidationSteps(
  packageManager: 'npm' | 'pnpm' | 'yarn',
  packageName: string,
  targetNodeVersion?: string
): ValidationStep[] {
  const validationTarget = targetNodeVersion
    ? ` on Node ${targetNodeVersion}`
    : '';

  return [
    {
      title: `Validate ${packageName}${validationTarget}`,
      commands: [
        buildInstallCommand(packageManager),
        buildTestCommand(packageManager),
        buildBuildCommand(packageManager)
      ],
      expectedResult: `Install, test, and build complete without ${packageName} runtime or native build failures${validationTarget}.`
    }
  ];
}

function buildRuleAlternatives(
  alternatives: AlternativeSolution[] | undefined
): AlternativeSolution[] {
  return [...(alternatives ?? [])].sort((left, right) => left.rank - right.rank);
}

function createDependencyEvidence(
  packageJsonRelativePath: string,
  dependency: DeclaredDependency,
  lockfileMatches: Array<{ filePath: string; snippet: string }>
): EvidenceItem[] {
  const evidence: EvidenceItem[] = [
    {
      kind: 'package',
      filePath: packageJsonRelativePath,
      summary: `${dependency.name} appears in ${dependency.section}.`,
      packageName: dependency.name,
      snippet: `"${dependency.name}": "${dependency.spec}"`
    }
  ];

  for (const lockfileMatch of lockfileMatches) {
    evidence.push({
      kind: 'lockfile',
      filePath: lockfileMatch.filePath,
      summary: `${dependency.name} also appears in the lockfile.`,
      packageName: dependency.name,
      snippet: lockfileMatch.snippet
    });
  }

  return evidence;
}

function createDependencyIssue(options: {
  dependency: DeclaredDependency;
  packageManager: 'npm' | 'pnpm' | 'yarn';
  packageJsonRelativePath: string;
  lockfileMatches: Array<{ filePath: string; snippet: string }>;
  targetNodeVersion?: string;
  issueId: string;
  title: string;
  issue: string;
  incompatibilityReason: string;
  defaultTechnicalRecommendation: string;
  alternativeSolutions?: AlternativeSolution[];
}): Issue {
  const affectedFiles = uniqueStrings([
    options.packageJsonRelativePath,
    ...options.lockfileMatches.map((match) => match.filePath)
  ]);

  return {
    id: options.issueId,
    category: 'dependency',
    title: options.title,
    issue: options.issue,
    incompatibilityReason: options.incompatibilityReason,
    defaultTechnicalRecommendation: options.defaultTechnicalRecommendation,
    alternativeSolutions: buildRuleAlternatives(options.alternativeSolutions),
    affectedFiles,
    evidence: createDependencyEvidence(
      options.packageJsonRelativePath,
      options.dependency,
      options.lockfileMatches
    ),
    recommendedCommands: [
      buildUpgradeCommand(options.packageManager, options.dependency.name),
      buildTestCommand(options.packageManager),
      buildBuildCommand(options.packageManager)
    ],
    validationSteps: buildValidationSteps(
      options.packageManager,
      options.dependency.name,
      options.targetNodeVersion
    )
  };
}

function createScriptIssue(options: {
  scriptName: string;
  scriptValue: string;
  packageJsonRelativePath: string;
  packageManager: 'npm' | 'pnpm' | 'yarn';
  targetNodeVersion?: string;
  issueId: string;
  title: string;
  incompatibilityReason: string;
  defaultTechnicalRecommendation: string;
  alternativeSolutions?: AlternativeSolution[];
}): Issue {
  return {
    id: options.issueId,
    category: 'dependency',
    title: options.title,
    issue: `The ${options.scriptName} script includes a native-tooling pattern that may break during a Node major upgrade.`,
    incompatibilityReason: options.incompatibilityReason,
    defaultTechnicalRecommendation: options.defaultTechnicalRecommendation,
    alternativeSolutions: buildRuleAlternatives(options.alternativeSolutions),
    affectedFiles: [options.packageJsonRelativePath],
    evidence: [
      {
        kind: 'script',
        filePath: options.packageJsonRelativePath,
        summary: `package.json script ${options.scriptName} references native addon tooling.`,
        configKey: `scripts.${options.scriptName}`,
        snippet: options.scriptValue
      }
    ],
    recommendedCommands: [
      `rg -n "${options.scriptName}|node-gyp|node-pre-gyp|prebuild-install" ${options.packageJsonRelativePath}`,
      buildTestCommand(options.packageManager),
      buildBuildCommand(options.packageManager)
    ],
    validationSteps: [
      {
        title: `Verify script ${options.scriptName} on the target runtime`,
        commands: [
          buildInstallCommand(options.packageManager),
          buildTestCommand(options.packageManager)
        ],
        expectedResult: `The ${options.scriptName} script finishes cleanly${options.targetNodeVersion ? ` on Node ${options.targetNodeVersion}` : ''}.`
      }
    ]
  };
}

async function readRelevantLockfiles(
  repoRoot: string,
  analysisRoot: string
): Promise<Array<{ absolutePath: string; relativePath: string; content: string }>> {
  const candidateRoots = uniqueStrings([analysisRoot, repoRoot]);
  const candidateFileNames = [
    'pnpm-lock.yaml',
    'yarn.lock',
    'package-lock.json',
    'npm-shrinkwrap.json'
  ];
  const lockfiles: Array<{ absolutePath: string; relativePath: string; content: string }> = [];

  for (const candidateRoot of candidateRoots) {
    for (const fileName of candidateFileNames) {
      const absolutePath = path.join(candidateRoot, fileName);

      if (!(await fileExists(absolutePath))) {
        continue;
      }

      const content = await readTextIfExists(absolutePath);

      if (!content) {
        continue;
      }

      lockfiles.push({
        absolutePath,
        relativePath: toRelative(repoRoot, absolutePath),
        content
      });
    }
  }

  return lockfiles.sort((left, right) => left.relativePath.localeCompare(right.relativePath));
}

function findLockfileMatches(
  lockfiles: Array<{ relativePath: string; content: string }>,
  dependencyName: string
): Array<{ filePath: string; snippet: string }> {
  const matches: Array<{ filePath: string; snippet: string }> = [];

  for (const lockfile of lockfiles) {
    const matchedLine = lockfile.content
      .split(/\r?\n/)
      .map((line) => line.trim())
      .find((line) => line.includes(dependencyName));

    if (!matchedLine) {
      continue;
    }

    matches.push({
      filePath: lockfile.relativePath,
      snippet: matchedLine.slice(0, 180)
    });
  }

  return matches;
}

function sortIssues(issues: Issue[]): Issue[] {
  return [...issues].sort((left, right) => {
    return (
      left.id.localeCompare(right.id) ||
      left.title.localeCompare(right.title) ||
      left.affectedFiles.join('|').localeCompare(right.affectedFiles.join('|'))
    );
  });
}

export async function detectDependencyBlockers(
  repoRoot: string,
  options?: DetectionOptions,
  providers?: DetectionProviders
): Promise<InspectDependencyBlockersResult> {
  const analysisRoot = resolveAnalysisRoot(repoRoot, options?.subdirectory);
  const packageJsonPath = path.join(analysisRoot, 'package.json');
  const packageJson = await readJsonIfExists<PackageJsonShape>(packageJsonPath);

  if (!packageJson) {
    return {
      issues: [],
      summary: 'No package.json was found for dependency blocker analysis.'
    };
  }

  const packageManager = detectPackageManager(repoRoot);
  const packageJsonRelativePath = toRelative(repoRoot, packageJsonPath);
  const declaredDependencies = collectDeclaredDependencies(packageJson);
  const compatibilityRules = loadPackageCompatibilityRules();
  const lockfiles = await readRelevantLockfiles(repoRoot, analysisRoot);
  const issues = new Map<string, Issue>();
  const targetMajor = extractMajorVersion(options?.targetNodeVersion);

  for (const dependency of declaredDependencies) {
    const lockfileMatches = findLockfileMatches(lockfiles, dependency.name);

    for (const rule of compatibilityRules) {
      const matchedPattern = (rule.match.packagePatterns ?? []).find(
        (pattern) =>
          dependency.name === pattern || dependency.name.includes(pattern)
      );

      if (!matchedPattern) {
        continue;
      }

      const issue = createDependencyIssue({
        dependency,
        packageManager,
        packageJsonRelativePath,
        lockfileMatches,
        targetNodeVersion: options?.targetNodeVersion,
        issueId: `dependency-${sanitizeIssueIdPart(rule.id)}-${sanitizeIssueIdPart(
          dependency.name
        )}`,
        title: `${dependency.name} needs upgrade compatibility review`,
        issue: `${dependency.name} in ${dependency.section} matches a known compatibility rule that can block a direct Node upgrade.`,
        incompatibilityReason: rule.incompatibilityReason,
        defaultTechnicalRecommendation: rule.defaultTechnicalRecommendation,
        alternativeSolutions: rule.alternativeSolutions
      });

      issues.set(issue.id, issue);
    }
  }

  for (const [scriptName, scriptValue] of Object.entries(packageJson.scripts ?? {}).sort(
    ([leftName], [rightName]) => leftName.localeCompare(rightName)
  )) {
    for (const rule of compatibilityRules) {
      const matchedPattern = (rule.match.scriptPatterns ?? []).find((pattern) =>
        scriptValue.toLowerCase().includes(pattern.toLowerCase())
      );

      if (!matchedPattern) {
        continue;
      }

      const issue = createScriptIssue({
        scriptName,
        scriptValue,
        packageJsonRelativePath,
        packageManager,
        targetNodeVersion: options?.targetNodeVersion,
        issueId: `dependency-${sanitizeIssueIdPart(rule.id)}-script-${sanitizeIssueIdPart(
          scriptName
        )}`,
        title: `Script ${scriptName} needs upgrade review`,
        incompatibilityReason: rule.incompatibilityReason,
        defaultTechnicalRecommendation: rule.defaultTechnicalRecommendation,
        alternativeSolutions: rule.alternativeSolutions
      });

      issues.set(issue.id, issue);
    }
  }

  const providerCandidates = declaredDependencies
    .map((dependency) => ({
      dependency,
      exactVersion: detectExactVersion(dependency.spec)
    }))
    .filter(
      (
        candidate
      ): candidate is { dependency: DeclaredDependency; exactVersion: string } =>
        candidate.exactVersion !== null
    )
    .slice(0, 10);

  if (!options?.offline && providerCandidates.length > 0) {
    const npmRegistryProvider =
      providers?.npmRegistryProvider ?? new DefaultNpmRegistryProvider();
    const osvProvider = providers?.osvProvider ?? new DefaultOsvProvider();

    const npmMetadataResults = await Promise.all(
      providerCandidates.map(async (candidate) => ({
        candidate,
        metadata: await safeFetchPackageMetadata(
          npmRegistryProvider,
          candidate.dependency.name
        )
      }))
    );

    for (const { candidate, metadata } of npmMetadataResults) {
      const versionMetadata = metadata?.versions?.[candidate.exactVersion];

      if (versionMetadata?.deprecated) {
        const issue = createDependencyIssue({
          dependency: candidate.dependency,
          packageManager,
          packageJsonRelativePath,
          lockfileMatches: findLockfileMatches(lockfiles, candidate.dependency.name),
          targetNodeVersion: options?.targetNodeVersion,
          issueId: `dependency-deprecated-${sanitizeIssueIdPart(candidate.dependency.name)}`,
          title: `${candidate.dependency.name}@${candidate.exactVersion} is deprecated`,
          issue: `The npm registry marks ${candidate.dependency.name}@${candidate.exactVersion} as deprecated, which increases upgrade risk during runtime modernization.`,
          incompatibilityReason: versionMetadata.deprecated,
          defaultTechnicalRecommendation:
            'Upgrade the dependency within the current package ecosystem before the final runtime cutover.',
          alternativeSolutions: []
        });

        issues.set(issue.id, issue);
      }

      if (
        targetMajor !== null &&
        versionMetadata?.engines?.node &&
        !rangeSeemsToSupportMajor(versionMetadata.engines.node, targetMajor)
      ) {
        const issue = createDependencyIssue({
          dependency: candidate.dependency,
          packageManager,
          packageJsonRelativePath,
          lockfileMatches: findLockfileMatches(lockfiles, candidate.dependency.name),
          targetNodeVersion: options?.targetNodeVersion,
          issueId: `dependency-engines-${sanitizeIssueIdPart(candidate.dependency.name)}`,
          title: `${candidate.dependency.name}@${candidate.exactVersion} declares a different Node engine range`,
          issue: `${candidate.dependency.name}@${candidate.exactVersion} declares engines.node=${versionMetadata.engines.node}, which may not support Node ${options?.targetNodeVersion}.`,
          incompatibilityReason:
            'Package engine declarations can indicate an unsupported runtime before the upgrade is rolled out.',
          defaultTechnicalRecommendation:
            'Upgrade to a compatible package release or validate support on the requested Node target.',
          alternativeSolutions: []
        });

        issues.set(issue.id, issue);
      }
    }

    const osvResults = await Promise.all(
      providerCandidates.map(async (candidate) => ({
        candidate,
        result: await safeQueryPackageVulnerabilities(
          osvProvider,
          candidate.dependency.name,
          candidate.exactVersion
        )
      }))
    );

    for (const { candidate, result } of osvResults) {
      const vulnerabilities = result?.vulns ?? [];

      if (vulnerabilities.length === 0) {
        continue;
      }

      const firstVulnerability = vulnerabilities[0];
      const issue = createDependencyIssue({
        dependency: candidate.dependency,
        packageManager,
        packageJsonRelativePath,
        lockfileMatches: findLockfileMatches(lockfiles, candidate.dependency.name),
        targetNodeVersion: options?.targetNodeVersion,
        issueId: `dependency-osv-${sanitizeIssueIdPart(candidate.dependency.name)}`,
        title: `${candidate.dependency.name}@${candidate.exactVersion} has known vulnerability records`,
        issue: `OSV returned ${vulnerabilities.length} vulnerability record(s) for ${candidate.dependency.name}@${candidate.exactVersion}.`,
        incompatibilityReason:
          firstVulnerability.summary ??
          firstVulnerability.details ??
          'Known security issues increase migration risk until the dependency is patched or replaced.',
        defaultTechnicalRecommendation:
          'Upgrade to a patched version in the same package ecosystem before completing the runtime cutover.',
        alternativeSolutions: []
      });

      issues.set(issue.id, issue);
    }
  }

  const sortedIssues = sortIssues(Array.from(issues.values()));
  const summaryParts = [
    `Detected ${sortedIssues.length} dependency blocker(s) from ${declaredDependencies.length} declared dependency entries.`
  ];

  if (options?.offline) {
    summaryParts.push('External provider checks were skipped in offline mode.');
  } else if (providerCandidates.length > 0) {
    summaryParts.push('External provider checks were best-effort and do not block local analysis.');
  } else {
    summaryParts.push('No exact package versions were available for provider lookups.');
  }

  return {
    issues: sortedIssues,
    summary: summaryParts.join(' ')
  };
}
