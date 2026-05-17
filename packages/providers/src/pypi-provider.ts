import type {
  ProviderRequestOptions,
  PyPIPackageVersionMetadata,
  PyPIProvider
} from './provider-types';

const DEFAULT_TIMEOUT_MS = 5_000;

export class DefaultPyPIProvider implements PyPIProvider {
  async fetchPackageMetadata(
    packageName: string,
    version?: string,
    options?: ProviderRequestOptions
  ): Promise<PyPIPackageVersionMetadata | null> {
    if (options?.offline) {
      return null;
    }

    const controller = new AbortController();
    const timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    const versionSegment = version ? `/${encodeURIComponent(version)}` : '';

    try {
      const response = await fetch(
        `https://pypi.org/pypi/${encodeURIComponent(packageName)}${versionSegment}/json`,
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

      return (await response.json()) as PyPIPackageVersionMetadata;
    } catch {
      return null;
    } finally {
      clearTimeout(timeout);
    }
  }
}
