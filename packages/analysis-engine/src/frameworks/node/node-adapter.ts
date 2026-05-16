import type {
  CollectEnvironmentEvidenceResult,
  CompareUpgradePathsResult,
  EnvironmentEvidenceEntry,
  InspectFrameworkDependenciesResult,
  InspectPlatformConfigResult,
  InspectSourceRisksResult,
  ProjectDescriptor,
  StackProfile
} from '@modernization-navigator/shared';

import { compareTargetPaths } from '../../rankers/target-paths';
import { mergeIssues } from '../../report/merge-issues';
import { detectDependencyBlockers } from '../../detectors/dependency-blockers';
import { detectOpsRuntimeIssues } from '../../detectors/ops-runtime';
import { detectPackageManager } from '../../detectors/package-manager';
import { collectRuntimeEvidenceEntries } from '../../detectors/runtime-evidence';
import { detectSourceCompatibilityIssues } from '../../detectors/source-compatibility';
import type {
  FrameworkAdapter,
  FrameworkResolution,
  FrameworkToolInput
} from '../framework-adapter';
import {
  collectPackageJsonProjects,
  detectBuildSystem,
  detectProjectLanguage
} from '../detection/project-descriptor';

function effectiveSubdirectory(rootPath: string): string | undefined {
  return rootPath === '.' ? undefined : rootPath;
}

function mapRuntimeEvidenceKind(
  kind: string
): EnvironmentEvidenceEntry['kind'] {
  switch (kind) {
    case 'docker':
      return 'docker';
    case 'github-actions':
      return 'github-actions';
    case 'deployment':
      return 'deployment';
    case 'script':
      return 'script';
    default:
      return 'runtime';
  }
}

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

export class NodeFrameworkAdapter implements FrameworkAdapter {
  readonly ecosystem = 'node' as const;
  readonly framework = 'node' as const;

  async detectProjects(input: FrameworkToolInput): Promise<ProjectDescriptor[]> {
    const projects = await collectPackageJsonProjects(input.repoRoot, input.subdirectory);

    const descriptors = await Promise.all(
      projects.map(async (project) => {
        const language = await detectProjectLanguage(project);
        const hasEngines =
          typeof project.packageJson.packageManager === 'string' ||
          typeof project.packageJson.scripts?.build === 'string';
        const confidence = Math.min(0.8, hasEngines ? 0.62 : 0.56);

        return {
          rootPath: project.rootPath,
          ecosystem: 'node',
          framework: 'node',
          language,
          runtimeName: 'node',
          dependencyManager: detectPackageManager(project.absoluteRoot),
          buildSystem: detectBuildSystem(project.packageJson),
          confidence,
          markers: ['file:package.json']
        } satisfies ProjectDescriptor;
      })
    );

    return sortDescriptors(descriptors);
  }

  async collectEnvironmentEvidence(
    input: FrameworkToolInput,
    resolution: FrameworkResolution
  ): Promise<CollectEnvironmentEvidenceResult> {
    const subdirectory = effectiveSubdirectory(resolution.primaryDescriptor.rootPath);
    const runtimeEvidence = await collectRuntimeEvidenceEntries(input.repoRoot, subdirectory);
    const packageManager =
      resolution.primaryDescriptor.dependencyManager ??
      detectPackageManager(input.repoRoot);
    const stackProfile: StackProfile = {
      ecosystem: 'node',
      framework: 'node',
      language: resolution.primaryDescriptor.language,
      runtimeName: 'node',
      dependencyManager: packageManager,
      buildSystem: resolution.primaryDescriptor.buildSystem
    };
    const environmentEvidence: EnvironmentEvidenceEntry[] = runtimeEvidence.map((entry) => ({
      source: entry.source,
      filePath: entry.filePath,
      value: entry.value,
      kind: mapRuntimeEvidenceKind(entry.kind)
    }));

    if (resolution.primaryDescriptor.buildSystem) {
      environmentEvidence.push({
        source: 'package.json',
        filePath:
          resolution.primaryDescriptor.rootPath === '.'
            ? 'package.json'
            : `${resolution.primaryDescriptor.rootPath}/package.json`,
        value: resolution.primaryDescriptor.buildSystem,
        kind: 'build-system'
      });
    }

    environmentEvidence.push({
      source: 'package-manager',
      filePath:
        resolution.primaryDescriptor.rootPath === '.'
          ? 'package.json'
          : `${resolution.primaryDescriptor.rootPath}/package.json`,
      value: packageManager,
      kind: 'dependency-manager'
    });

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
    return detectDependencyBlockers(input.repoRoot, {
      subdirectory: effectiveSubdirectory(resolution.primaryDescriptor.rootPath),
      targetNodeVersion: input.targetVersion,
      offline: input.offline
    });
  }

  async inspectPlatformConfig(
    input: FrameworkToolInput,
    resolution: FrameworkResolution
  ): Promise<InspectPlatformConfigResult> {
    return detectOpsRuntimeIssues(input.repoRoot, {
      subdirectory: effectiveSubdirectory(resolution.primaryDescriptor.rootPath),
      targetNodeVersion: input.targetVersion
    });
  }

  async inspectSourceRisks(
    input: FrameworkToolInput,
    resolution: FrameworkResolution
  ): Promise<InspectSourceRisksResult> {
    return detectSourceCompatibilityIssues(input.repoRoot, {
      subdirectory: effectiveSubdirectory(resolution.primaryDescriptor.rootPath),
      targetNodeVersion: input.targetVersion
    });
  }

  async compareUpgradePaths(
    input: FrameworkToolInput,
    resolution: FrameworkResolution
  ): Promise<CompareUpgradePathsResult> {
    const subdirectory = effectiveSubdirectory(resolution.primaryDescriptor.rootPath);
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
