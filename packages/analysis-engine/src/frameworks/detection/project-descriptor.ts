import path from 'node:path';

import type {
  DiscoverProjectStackResult,
  ProjectDescriptor
} from '@modernization-navigator/shared';

import {
  fileExists,
  readJsonIfExists,
  resolveAnalysisRoot,
  toRelative,
  walkFiles
} from '../../internal/file-utils';

export type PackageJsonLike = {
  name?: string;
  packageManager?: string;
  scripts?: Record<string, string>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
};

export type PackageJsonProject = {
  absoluteRoot: string;
  rootPath: string;
  packageJson: PackageJsonLike;
};

const DEPENDENCY_SECTIONS = [
  'dependencies',
  'devDependencies',
  'optionalDependencies',
  'peerDependencies'
] as const;

export async function collectPackageJsonProjects(
  repoRoot: string,
  subdirectory?: string
): Promise<PackageJsonProject[]> {
  const analysisRoot = resolveAnalysisRoot(repoRoot, subdirectory);
  const packageJsonFiles = await walkFiles(
    analysisRoot,
    (filePath) => filePath.endsWith('/package.json') || path.basename(filePath) === 'package.json',
    6
  );

  const projects = await Promise.all(
    packageJsonFiles.map(async (packageJsonFilePath) => {
      const packageJson = await readJsonIfExists<PackageJsonLike>(packageJsonFilePath);

      if (!packageJson) {
        return null;
      }

      const absoluteRoot = path.dirname(packageJsonFilePath);
      return {
        absoluteRoot,
        rootPath: toRelative(repoRoot, absoluteRoot),
        packageJson
      };
    })
  );

  return projects
    .filter((project): project is PackageJsonProject => project !== null)
    .sort((left, right) => left.rootPath.localeCompare(right.rootPath));
}

export async function loadPackageJsonProject(
  repoRoot: string,
  rootPath: string
): Promise<PackageJsonProject | null> {
  const absoluteRoot =
    rootPath === '.' ? repoRoot : path.resolve(repoRoot, rootPath);
  const packageJsonPath = path.join(absoluteRoot, 'package.json');
  const packageJson = await readJsonIfExists<PackageJsonLike>(packageJsonPath);

  if (!packageJson) {
    return null;
  }

  return {
    absoluteRoot,
    rootPath,
    packageJson
  };
}

export function collectPackageNames(packageJson: PackageJsonLike): string[] {
  const names = new Set<string>();

  for (const section of DEPENDENCY_SECTIONS) {
    for (const packageName of Object.keys(packageJson[section] ?? {})) {
      names.add(packageName);
    }
  }

  return [...names].sort((left, right) => left.localeCompare(right));
}

export function getPackageVersion(
  packageJson: PackageJsonLike,
  packageName: string
): string | null {
  for (const section of DEPENDENCY_SECTIONS) {
    const version = packageJson[section]?.[packageName];

    if (typeof version === 'string' && version.trim().length > 0) {
      return version;
    }
  }

  return null;
}

export function detectBuildSystem(packageJson: PackageJsonLike): string | undefined {
  const packageNames = new Set(collectPackageNames(packageJson));

  if (packageNames.has('next')) {
    return 'next';
  }

  if (packageNames.has('vite') || packageNames.has('@vitejs/plugin-react')) {
    return 'vite';
  }

  if (packageNames.has('react-scripts')) {
    return 'react-scripts';
  }

  if (packageNames.has('webpack')) {
    return 'webpack';
  }

  if (packageNames.has('typescript') || packageNames.has('tsx')) {
    return 'tsc';
  }

  return undefined;
}

export async function detectProjectLanguage(
  project: PackageJsonProject
): Promise<ProjectDescriptor['language']> {
  const packageNames = new Set(collectPackageNames(project.packageJson));

  if (packageNames.has('typescript') || packageNames.has('tsx')) {
    return 'typescript';
  }

  if (
    (await fileExists(path.join(project.absoluteRoot, 'tsconfig.json'))) ||
    (await fileExists(path.join(project.absoluteRoot, 'tsconfig.app.json')))
  ) {
    return 'typescript';
  }

  return 'javascript';
}

export function detectWorkspaceTypeFromDescriptors(
  projectDescriptors: ProjectDescriptor[]
): DiscoverProjectStackResult['workspaceType'] {
  return projectDescriptors.length > 1 ? 'monorepo' : 'single';
}

export function collectReactMarkers(packageJson: PackageJsonLike): string[] {
  const markers: string[] = [];
  const packageNames = new Set(collectPackageNames(packageJson));

  if (packageNames.has('react')) {
    markers.push('dependency:react');
  }

  if (packageNames.has('react-dom')) {
    markers.push('dependency:react-dom');
  }

  if (packageNames.has('next')) {
    markers.push('dependency:next');
  }

  if (packageNames.has('vite')) {
    markers.push('dependency:vite');
  }

  if (packageNames.has('@vitejs/plugin-react')) {
    markers.push('dependency:@vitejs/plugin-react');
  }

  if (packageNames.has('react-scripts')) {
    markers.push('dependency:react-scripts');
  }

  return markers.sort((left, right) => left.localeCompare(right));
}

export function preferHigherConfidenceDescriptor(
  current: ProjectDescriptor | undefined,
  candidate: ProjectDescriptor
): ProjectDescriptor {
  if (!current) {
    return candidate;
  }

  if (candidate.confidence !== current.confidence) {
    return candidate.confidence > current.confidence ? candidate : current;
  }

  if (candidate.framework !== current.framework) {
    return candidate.framework === 'react' ? candidate : current;
  }

  return candidate.rootPath.localeCompare(current.rootPath) <= 0 ? candidate : current;
}
