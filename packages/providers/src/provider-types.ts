export type NpmPackageMetadata = {
  name: string;
  'dist-tags'?: Record<string, string>;
  versions?: Record<string, unknown>;
};

export interface NpmRegistryProvider {
  fetchPackageMetadata(
    packageName: string,
    options?: { offline?: boolean }
  ): Promise<NpmPackageMetadata | null>;
}

export type OsvQueryResult = {
  vulns?: Array<{
    id?: string;
    summary?: string;
    details?: string;
  }>;
};

export interface OsvProvider {
  queryPackageVulnerabilities(
    ecosystem: string,
    packageName: string,
    version?: string,
    options?: { offline?: boolean }
  ): Promise<OsvQueryResult | null>;
}
