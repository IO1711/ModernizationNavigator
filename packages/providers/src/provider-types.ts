export type ProviderRequestOptions = {
  offline?: boolean;
  timeoutMs?: number;
};

export type NpmPackageVersionMetadata = {
  deprecated?: string;
  engines?: {
    node?: string;
  };
};

export type NpmPackageMetadata = {
  name: string;
  'dist-tags'?: Record<string, string>;
  versions?: Record<string, NpmPackageVersionMetadata>;
  time?: Record<string, string>;
};

export interface NpmRegistryProvider {
  fetchPackageMetadata(
    packageName: string,
    options?: ProviderRequestOptions
  ): Promise<NpmPackageMetadata | null>;
}

export type OsvQueryResult = {
  vulns?: Array<{
    id?: string;
    summary?: string;
    details?: string;
    aliases?: string[];
  }>;
};

export interface OsvProvider {
  queryPackageVulnerabilities(
    ecosystem: string,
    packageName: string,
    version?: string,
    options?: ProviderRequestOptions
  ): Promise<OsvQueryResult | null>;
}
