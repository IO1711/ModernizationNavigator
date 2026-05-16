import type { NpmPackageMetadata, NpmRegistryProvider } from './provider-types';

export class DefaultNpmRegistryProvider implements NpmRegistryProvider {
  async fetchPackageMetadata(
    packageName: string,
    options?: { offline?: boolean }
  ): Promise<NpmPackageMetadata | null> {
    if (options?.offline) {
      return null;
    }

    try {
      const response = await fetch(
        `https://registry.npmjs.org/${encodeURIComponent(packageName)}`
      );

      if (!response.ok) {
        return null;
      }

      return (await response.json()) as NpmPackageMetadata;
    } catch {
      return null;
    }
  }
}
