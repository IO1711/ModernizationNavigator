import { loadReactFrameworkRules } from '@modernization-navigator/knowledge-base';
import type {
  CollectEnvironmentEvidenceResult,
  CompareUpgradePathsResult,
  InspectFrameworkDependenciesResult,
  InspectPlatformConfigResult,
  InspectSourceRisksResult,
  Issue,
  ProjectDescriptor,
  ValidationStep
} from '@modernization-navigator/shared';

import { compareTargetPaths } from '../../rankers/target-paths';
import { collectRuntimeEvidenceEntries } from '../../detectors/runtime-evidence';
import { detectPackageManager } from '../../detectors/package-manager';
import { mergeIssues } from '../../report/merge-issues';
import { extractMajorVersion, sanitizeIssueIdPart } from '../../internal/version-utils';
import type {
  FrameworkAdapter,
  FrameworkResolution,
  FrameworkToolInput
} from '../framework-adapter';
import {
  collectPackageJsonProjects,
  collectReactMarkers,
  detectBuildSystem,
  detectProjectLanguage,
  getPackageVersion,
  loadPackageJsonProject,
  type PackageJsonLike
} from '../detection/project-descriptor';
import { NodeFrameworkAdapter } from '../node/node-adapter';

type PackageManager = ReturnType<typeof detectPackageManager>;

function normalizePackageManager(
  value: string | undefined,
  fallback: PackageManager
): PackageManager {
  return value === 'npm' || value === 'pnpm' || value === 'yarn' ? value : fallback;
}

function buildInstallCommand(packageManager: PackageManager): string {
  return packageManager === 'yarn' ? 'yarn install' : `${packageManager} install`;
}

function buildTestCommand(packageManager: PackageManager): string {
  return packageManager === 'npm' ? 'npm test' : `${packageManager} test`;
}

function buildBuildCommand(packageManager: PackageManager): string {
  return packageManager === 'npm' ? 'npm run build' : `${packageManager} build`;
}

function buildValidationSteps(
  packageManager: PackageManager,
  targetVersion: string | undefined,
  title: string
): ValidationStep[] {
  return [
    {
      title,
      commands: [
        buildInstallCommand(packageManager),
        buildTestCommand(packageManager),
        buildBuildCommand(packageManager)
      ],
      expectedResult: `Install, test, and build complete without React-specific toolchain regressions${targetVersion ? ` on the requested target version ${targetVersion}` : ''}.`
    }
  ];
}

function createReactScriptsIssue(options: {
  packageJsonPath: string;
  packageManager: PackageManager;
  reactScriptsVersion: string;
  maxRecommendedMajor: number;
  targetVersion?: string;
  incompatibilityReason: string;
  recommendation: string;
}): Issue {
  return {
    id: `react-react-scripts-${sanitizeIssueIdPart(options.packageJsonPath)}`,
    category: 'dependency',
    title: 'react-scripts is pinned to a legacy major',
    issue: `The project still uses react-scripts ${options.reactScriptsVersion}, which is at or below the legacy major threshold ${options.maxRecommendedMajor}.`,
    incompatibilityReason: options.incompatibilityReason,
    defaultTechnicalRecommendation: options.recommendation,
    alternativeSolutions: [],
    affectedFiles: [options.packageJsonPath],
    evidence: [
      {
        kind: 'package',
        filePath: options.packageJsonPath,
        summary: 'react-scripts appears in package.json.',
        packageName: 'react-scripts',
        snippet: `"react-scripts": "${options.reactScriptsVersion}"`
      }
    ],
    recommendedCommands: [
      options.packageManager === 'npm'
        ? 'npm install react-scripts@latest'
        : `${options.packageManager} up react-scripts`,
      buildTestCommand(options.packageManager),
      buildBuildCommand(options.packageManager)
    ],
    validationSteps: buildValidationSteps(
      options.packageManager,
      options.targetVersion,
      'Validate the React build after updating react-scripts'
    )
  };
}

function createReactMajorMismatchIssue(options: {
  packageJsonPath: string;
  packageManager: PackageManager;
  reactVersion: string;
  reactDomVersion: string;
  targetVersion?: string;
}): Issue {
  return {
    id: `react-version-mismatch-${sanitizeIssueIdPart(options.packageJsonPath)}`,
    category: 'dependency',
    title: 'react and react-dom major versions do not match',
    issue: `The project declares react ${options.reactVersion} and react-dom ${options.reactDomVersion}, which can create renderer mismatches during framework or runtime upgrades.`,
    incompatibilityReason:
      'Mismatched React core and renderer majors can hide hydration, JSX runtime, or bundler integration issues until late validation.',
    defaultTechnicalRecommendation:
      'Align react and react-dom on the same supported major before the runtime cutover.',
    alternativeSolutions: [],
    affectedFiles: [options.packageJsonPath],
    evidence: [
      {
        kind: 'package',
        filePath: options.packageJsonPath,
        summary: 'react and react-dom resolve to different declared majors.',
        packageName: 'react',
        snippet: `"react": "${options.reactVersion}"`
      },
      {
        kind: 'package',
        filePath: options.packageJsonPath,
        summary: 'react-dom major does not match react.',
        packageName: 'react-dom',
        snippet: `"react-dom": "${options.reactDomVersion}"`
      }
    ],
    recommendedCommands: [
      options.packageManager === 'npm'
        ? 'npm install react@latest react-dom@latest'
        : `${options.packageManager} up react react-dom`,
      buildTestCommand(options.packageManager),
      buildBuildCommand(options.packageManager)
    ],
    validationSteps: buildValidationSteps(
      options.packageManager,
      options.targetVersion,
      'Validate the app after aligning react and react-dom'
    )
  };
}

function createBuildToolDriftIssue(options: {
  packageJsonPath: string;
  packageManager: PackageManager;
  toolchains: string[];
  targetVersion?: string;
}): Issue {
  return {
    id: `react-build-tool-drift-${sanitizeIssueIdPart(options.packageJsonPath)}`,
    category: 'dependency',
    title: 'Multiple React build toolchains are declared',
    issue: `The project declares more than one React build stack (${options.toolchains.join(', ')}), which increases upgrade coupling and complicates validation.`,
    incompatibilityReason:
      'Running multiple React app toolchains in one package can blur which bundler or framework owns the upgrade path.',
    defaultTechnicalRecommendation:
      'Choose one primary React build toolchain for the package and remove or isolate the others before the runtime cutover.',
    alternativeSolutions: [],
    affectedFiles: [options.packageJsonPath],
    evidence: [
      {
        kind: 'package',
        filePath: options.packageJsonPath,
        summary: 'Multiple React build toolchains were detected in package.json.',
        snippet: options.toolchains.join(', ')
      }
    ],
    recommendedCommands: [
      `rg -n "react-scripts|vite|next|webpack" ${options.packageJsonPath}`,
      buildTestCommand(options.packageManager),
      buildBuildCommand(options.packageManager)
    ],
    validationSteps: buildValidationSteps(
      options.packageManager,
      options.targetVersion,
      'Validate the selected React build toolchain after removing drift'
    )
  };
}

function sortIssues(issues: Issue[]): Issue[] {
  return [...issues].sort((left, right) => {
    return (
      left.id.localeCompare(right.id) ||
      left.affectedFiles.join('|').localeCompare(right.affectedFiles.join('|'))
    );
  });
}

function detectBuildToolchains(packageJson: PackageJsonLike): string[] {
  const toolchains: string[] = [];

  if (getPackageVersion(packageJson, 'next')) {
    toolchains.push('next');
  }

  if (
    getPackageVersion(packageJson, 'vite') ||
    getPackageVersion(packageJson, '@vitejs/plugin-react')
  ) {
    toolchains.push('vite');
  }

  if (getPackageVersion(packageJson, 'react-scripts')) {
    toolchains.push('react-scripts');
  }

  if (getPackageVersion(packageJson, 'webpack')) {
    toolchains.push('webpack');
  }

  return [...new Set(toolchains)].sort((left, right) => left.localeCompare(right));
}

export class ReactFrameworkAdapter implements FrameworkAdapter {
  readonly ecosystem = 'node' as const;
  readonly framework = 'react' as const;

  private readonly nodeAdapter = new NodeFrameworkAdapter();

  async detectProjects(input: FrameworkToolInput): Promise<ProjectDescriptor[]> {
    const projects = await collectPackageJsonProjects(input.repoRoot, input.subdirectory);
    const descriptors: Array<ProjectDescriptor | null> = await Promise.all(
      projects.map(async (project) => {
        const markers = collectReactMarkers(project.packageJson);

        if (markers.length === 0) {
          return null;
        }

        const hasReactCore =
          getPackageVersion(project.packageJson, 'react') !== null ||
          getPackageVersion(project.packageJson, 'react-dom') !== null;
        const confidence = hasReactCore ? 0.95 : 0.82;

        return {
          rootPath: project.rootPath,
          ecosystem: 'node',
          framework: 'react',
          language: await detectProjectLanguage(project),
          runtimeName: 'node',
          dependencyManager: detectPackageManager(project.absoluteRoot),
          buildSystem: detectBuildSystem(project.packageJson) ?? 'react',
          confidence,
          markers
        } satisfies ProjectDescriptor;
      })
    );

    return descriptors
      .filter((descriptor): descriptor is ProjectDescriptor => descriptor !== null)
      .sort((left, right) => {
        return (
          left.rootPath.localeCompare(right.rootPath) ||
          right.confidence - left.confidence
        );
      });
  }

  async collectEnvironmentEvidence(
    input: FrameworkToolInput,
    resolution: FrameworkResolution
  ): Promise<CollectEnvironmentEvidenceResult> {
    const baseResult = await this.nodeAdapter.collectEnvironmentEvidence(input, resolution);
    const environmentEvidence = [...baseResult.environmentEvidence];
    const packageJsonPath =
      resolution.primaryDescriptor.rootPath === '.'
        ? 'package.json'
        : `${resolution.primaryDescriptor.rootPath}/package.json`;

    environmentEvidence.push({
      source: 'package.json',
      filePath: packageJsonPath,
      value: 'react',
      kind: 'framework'
    });

    return {
      ...baseResult,
      stackProfile: {
        ...baseResult.stackProfile,
        framework: 'react',
        buildSystem:
          resolution.primaryDescriptor.buildSystem ?? baseResult.stackProfile.buildSystem
      },
      environmentEvidence
    };
  }

  async inspectFrameworkDependencies(
    input: FrameworkToolInput,
    resolution: FrameworkResolution
  ): Promise<InspectFrameworkDependenciesResult> {
    const baseResult = await this.nodeAdapter.inspectFrameworkDependencies(input, resolution);
    const project = await loadPackageJsonProject(
      input.repoRoot,
      resolution.primaryDescriptor.rootPath
    );

    if (!project) {
      return baseResult;
    }

    const packageManager =
      normalizePackageManager(
        resolution.primaryDescriptor.dependencyManager,
        detectPackageManager(project.absoluteRoot)
      );
    const packageJsonPath =
      resolution.primaryDescriptor.rootPath === '.'
        ? 'package.json'
        : `${resolution.primaryDescriptor.rootPath}/package.json`;
    const additionalIssues: Issue[] = [];
    const reactScriptsVersion = getPackageVersion(project.packageJson, 'react-scripts');
    const reactScriptsRule = loadReactFrameworkRules().find(
      (rule) => rule.match.packageName === 'react-scripts'
    );
    const reactScriptsMajor = extractMajorVersion(reactScriptsVersion ?? undefined);

    if (
      reactScriptsVersion &&
      reactScriptsRule?.match.maxRecommendedMajor !== undefined &&
      reactScriptsMajor !== null &&
      reactScriptsMajor <= reactScriptsRule.match.maxRecommendedMajor
    ) {
      additionalIssues.push(
        createReactScriptsIssue({
          packageJsonPath,
          packageManager,
          reactScriptsVersion,
          maxRecommendedMajor: reactScriptsRule.match.maxRecommendedMajor,
          targetVersion: input.targetVersion,
          incompatibilityReason: reactScriptsRule.incompatibilityReason,
          recommendation: reactScriptsRule.defaultTechnicalRecommendation
        })
      );
    }

    const reactVersion = getPackageVersion(project.packageJson, 'react');
    const reactDomVersion = getPackageVersion(project.packageJson, 'react-dom');
    const reactMajor = extractMajorVersion(reactVersion ?? undefined);
    const reactDomMajor = extractMajorVersion(reactDomVersion ?? undefined);

    if (
      reactVersion &&
      reactDomVersion &&
      reactMajor !== null &&
      reactDomMajor !== null &&
      reactMajor !== reactDomMajor
    ) {
      additionalIssues.push(
        createReactMajorMismatchIssue({
          packageJsonPath,
          packageManager,
          reactVersion,
          reactDomVersion,
          targetVersion: input.targetVersion
        })
      );
    }

    const buildToolchains = detectBuildToolchains(project.packageJson);

    if (buildToolchains.length > 1) {
      additionalIssues.push(
        createBuildToolDriftIssue({
          packageJsonPath,
          packageManager,
          toolchains: buildToolchains,
          targetVersion: input.targetVersion
        })
      );
    }

    const issues = sortIssues(mergeIssues(baseResult.issues, additionalIssues));
    const reactSummary =
      additionalIssues.length === 0
        ? 'No React-specific dependency issues detected.'
        : `Added ${additionalIssues.length} React-specific dependency issue(s).`;

    return {
      issues,
      summary: `${baseResult.summary} ${reactSummary}`.trim()
    };
  }

  inspectPlatformConfig(
    input: FrameworkToolInput,
    resolution: FrameworkResolution
  ): Promise<InspectPlatformConfigResult> {
    return this.nodeAdapter.inspectPlatformConfig(input, resolution);
  }

  inspectSourceRisks(
    input: FrameworkToolInput,
    resolution: FrameworkResolution
  ): Promise<InspectSourceRisksResult> {
    return this.nodeAdapter.inspectSourceRisks(input, resolution);
  }

  compareUpgradePaths(
    input: FrameworkToolInput,
    resolution: FrameworkResolution
  ): Promise<CompareUpgradePathsResult> {
    return this.compareUpgradePathsWithReactContext(input, resolution);
  }

  private async compareUpgradePathsWithReactContext(
    input: FrameworkToolInput,
    resolution: FrameworkResolution
  ): Promise<CompareUpgradePathsResult> {
    const subdirectory =
      resolution.primaryDescriptor.rootPath === '.'
        ? undefined
        : resolution.primaryDescriptor.rootPath;
    const [dependencyResults, platformResults, sourceResults, runtimeEvidence] =
      await Promise.all([
        this.inspectFrameworkDependencies(input, resolution),
        this.inspectPlatformConfig(input, resolution),
        this.inspectSourceRisks(input, resolution),
        collectRuntimeEvidenceEntries(input.repoRoot, subdirectory)
      ]);
    const comparison = compareTargetPaths({
      targetNodeVersion: input.targetVersion,
      issues: mergeIssues(
        dependencyResults.issues,
        platformResults.issues,
        sourceResults.issues
      ),
      runtimeEvidence
    });

    return {
      comparedPaths: comparison.comparedPaths.map((pathEntry) => ({
        ...pathEntry,
        targetVersion:
          pathEntry.targetVersion === 'unknown' && input.targetVersion
            ? input.targetVersion
            : pathEntry.targetVersion
      })),
      recommendedPathCandidate: comparison.recommendedPathCandidate
    };
  }
}
