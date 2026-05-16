import type { InspectDependencyBlockersResult } from '@modernization-navigator/shared';

export async function detectDependencyBlockers(
  _repoRoot: string,
  _options?: { subdirectory?: string; targetNodeVersion?: string; offline?: boolean }
): Promise<InspectDependencyBlockersResult> {
  return {
    issues: [],
    summary:
      'Starter scaffold only: dependency blocker analysis has not been implemented yet.'
  };
}
