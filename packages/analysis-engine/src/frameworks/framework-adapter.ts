import type {
  BaseToolInputV2,
  CollectEnvironmentEvidenceResult,
  CompareUpgradePathsResult,
  DiscoverProjectStackResult,
  InspectFrameworkDependenciesResult,
  InspectPlatformConfigResult,
  InspectSourceRisksResult,
  ProjectDescriptor
} from '@modernization-navigator/shared';

export type FrameworkToolInput = BaseToolInputV2;

export type FrameworkResolution = {
  primaryDescriptor: ProjectDescriptor;
  projectDescriptors: ProjectDescriptor[];
  workspaceType: DiscoverProjectStackResult['workspaceType'];
};

export interface FrameworkAdapter {
  readonly ecosystem: ProjectDescriptor['ecosystem'];
  readonly framework: ProjectDescriptor['framework'];

  detectProjects(input: FrameworkToolInput): Promise<ProjectDescriptor[]>;
  collectEnvironmentEvidence(
    input: FrameworkToolInput,
    resolution: FrameworkResolution
  ): Promise<CollectEnvironmentEvidenceResult>;
  inspectFrameworkDependencies(
    input: FrameworkToolInput,
    resolution: FrameworkResolution
  ): Promise<InspectFrameworkDependenciesResult>;
  inspectPlatformConfig(
    input: FrameworkToolInput,
    resolution: FrameworkResolution
  ): Promise<InspectPlatformConfigResult>;
  inspectSourceRisks(
    input: FrameworkToolInput,
    resolution: FrameworkResolution
  ): Promise<InspectSourceRisksResult>;
  compareUpgradePaths(
    input: FrameworkToolInput,
    resolution: FrameworkResolution
  ): Promise<CompareUpgradePathsResult>;
}
