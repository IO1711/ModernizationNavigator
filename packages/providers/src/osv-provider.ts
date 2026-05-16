import type {
  OsvProvider,
  OsvQueryResult,
  ProviderRequestOptions
} from './provider-types';

const DEFAULT_TIMEOUT_MS = 5_000;

export class DefaultOsvProvider implements OsvProvider {
  async queryPackageVulnerabilities(
    ecosystem: string,
    packageName: string,
    version?: string,
    options?: ProviderRequestOptions
  ): Promise<OsvQueryResult | null> {
    if (options?.offline) {
      return null;
    }

    const controller = new AbortController();
    const timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch('https://api.osv.dev/v1/query', {
        method: 'POST',
        signal: controller.signal,
        headers: {
          accept: 'application/json',
          'content-type': 'application/json'
        },
        body: JSON.stringify({
          version,
          package: {
            ecosystem,
            name: packageName
          }
        })
      });

      if (!response.ok) {
        return null;
      }

      return (await response.json()) as OsvQueryResult;
    } catch {
      return null;
    } finally {
      clearTimeout(timeout);
    }
  }
}
