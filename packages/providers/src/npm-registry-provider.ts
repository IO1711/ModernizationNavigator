import type {
  NpmPackageMetadata,
  NpmRegistryProvider,
  ProviderRequestOptions
} from './provider-types';

const DEFAULT_TIMEOUT_MS = 5_000;

export class DefaultNpmRegistryProvider implements NpmRegistryProvider {
  async fetchPackageMetadata(
    packageName: string,
    options?: ProviderRequestOptions
  ): Promise<NpmPackageMetadata | null> {
    if (options?.offline) {
      return null;
    }

    const controller = new AbortController();
    const timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(
        `https://registry.npmjs.org/${encodeURIComponent(packageName)}`,
        {
          signal: controller.signal,
          headers: {
            accept: 'application/json'
          }
        }
      );

      if (!response.ok) {
        return null;
      }

      return (await response.json()) as NpmPackageMetadata;
    } catch {
      return null;
    } finally {
      clearTimeout(timeout);
    }
  }
}
