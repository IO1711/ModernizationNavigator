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

import type { FrameworkAdapter, FrameworkResolution } from './framework-adapter';
import {
  detectWorkspaceTypeFromDescriptors,
  preferHigherConfidenceDescriptor
} from './detection/project-descriptor';
import { NodeFrameworkAdapter } from './node/node-adapter';
import { PythonFrameworkAdapter } from './python/python-adapter';
import { ReactFrameworkAdapter } from './react/react-adapter';

const frameworkAdapters: FrameworkAdapter[] = [
  new PythonFrameworkAdapter('fastapi'),
  new PythonFrameworkAdapter('django'),
  new PythonFrameworkAdapter('flask'),
  new ReactFrameworkAdapter(),
  new NodeFrameworkAdapter()
];

function sortProjectDescriptors(
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

function resolveRequestedRoot(input: BaseToolInputV2): string {
  return input.subdirectory?.trim() || '.';
}

function findPrimaryDescriptor(
  descriptors: ProjectDescriptor[],
  requestedRoot: string
): ProjectDescriptor | undefined {
  if (requestedRoot === '.') {
    return descriptors.find((descriptor) => descriptor.rootPath === '.') ??
      [...descriptors].sort((left, right) => right.confidence - left.confidence)[0];
  }

  const exactMatch = descriptors.find((descriptor) => descriptor.rootPath === requestedRoot);

  if (exactMatch) {
    return exactMatch;
  }

  const containingMatches = descriptors
    .filter((descriptor) => {
      if (descriptor.rootPath === '.') {
        return true;
      }

      return requestedRoot.startsWith(`${descriptor.rootPath}/`);
    })
    .sort((left, right) => right.rootPath.length - left.rootPath.length);

  if (containingMatches.length > 0) {
    return containingMatches[0];
  }

  return undefined;
}

function getFrameworkAdapter(framework: ProjectDescriptor['framework']): FrameworkAdapter {
  return (
    frameworkAdapters.find((adapter) => adapter.framework === framework) ??
    frameworkAdapters.find((adapter) => adapter.framework === 'node')!
  );
}

export function getFrameworkAdapters(): FrameworkAdapter[] {
  return [...frameworkAdapters];
}

export async function discoverProjectDescriptors(
  input: BaseToolInputV2
): Promise<ProjectDescriptor[]> {
  const detectedDescriptors = await Promise.all(
    frameworkAdapters.map((adapter) => adapter.detectProjects(input))
  );
  const preferredByRoot = new Map<string, ProjectDescriptor>();

  for (const descriptor of detectedDescriptors.flat()) {
    preferredByRoot.set(
      descriptor.rootPath,
      preferHigherConfidenceDescriptor(
        preferredByRoot.get(descriptor.rootPath),
        descriptor
      )
    );
  }

  return sortProjectDescriptors([...preferredByRoot.values()]);
}

export async function discoverProjectStack(
  input: BaseToolInputV2
): Promise<DiscoverProjectStackResult> {
  const projectDescriptors = await discoverProjectDescriptors(input);

  if (projectDescriptors.length === 0) {
    throw new Error(
      `No supported project stack could be detected under ${input.subdirectory ?? input.repoRoot}.`
    );
  }

  return {
    repoRoot: input.repoRoot,
    subdirectory: input.subdirectory,
    workspaceType: detectWorkspaceTypeFromDescriptors(projectDescriptors),
    projectDescriptors
  };
}

export async function resolveFrameworkAnalysis(
  input: BaseToolInputV2
): Promise<{ adapter: FrameworkAdapter; resolution: FrameworkResolution }> {
  const projectDescriptors = await discoverProjectDescriptors(input);

  if (projectDescriptors.length === 0) {
    throw new Error(
      `No supported project stack could be detected under ${input.subdirectory ?? input.repoRoot}.`
    );
  }

  const primaryDescriptor = findPrimaryDescriptor(
    projectDescriptors,
    resolveRequestedRoot(input)
  );

  if (!primaryDescriptor) {
    throw new Error(
      `No project descriptor matched ${input.subdirectory ?? input.repoRoot}.`
    );
  }

  return {
    adapter: getFrameworkAdapter(primaryDescriptor.framework),
    resolution: {
      primaryDescriptor,
      projectDescriptors,
      workspaceType: detectWorkspaceTypeFromDescriptors(projectDescriptors)
    }
  };
}

export async function collectEnvironmentEvidenceV2(
  input: BaseToolInputV2
): Promise<CollectEnvironmentEvidenceResult> {
  const { adapter, resolution } = await resolveFrameworkAnalysis(input);
  return adapter.collectEnvironmentEvidence(input, resolution);
}

export async function inspectFrameworkDependenciesV2(
  input: BaseToolInputV2
): Promise<InspectFrameworkDependenciesResult> {
  const { adapter, resolution } = await resolveFrameworkAnalysis(input);
  return adapter.inspectFrameworkDependencies(input, resolution);
}

export async function inspectPlatformConfigV2(
  input: BaseToolInputV2
): Promise<InspectPlatformConfigResult> {
  const { adapter, resolution } = await resolveFrameworkAnalysis(input);
  return adapter.inspectPlatformConfig(input, resolution);
}

export async function inspectSourceRisksV2(
  input: BaseToolInputV2
): Promise<InspectSourceRisksResult> {
  const { adapter, resolution } = await resolveFrameworkAnalysis(input);
  return adapter.inspectSourceRisks(input, resolution);
}

export async function compareUpgradePathsV2(
  input: BaseToolInputV2
): Promise<CompareUpgradePathsResult> {
  const { adapter, resolution } = await resolveFrameworkAnalysis(input);
  return adapter.compareUpgradePaths(input, resolution);
}
