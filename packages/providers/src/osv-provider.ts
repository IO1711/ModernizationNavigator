import type { OsvProvider, OsvQueryResult } from './provider-types';

export class DefaultOsvProvider implements OsvProvider {
  async queryPackageVulnerabilities(
    ecosystem: string,
    packageName: string,
    version?: string,
    options?: { offline?: boolean }
  ): Promise<OsvQueryResult | null> {
    if (options?.offline) {
      return null;
    }

    try {
      const response = await fetch('https://api.osv.dev/v1/query', {
        method: 'POST',
        headers: {
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
    }
  }
}
