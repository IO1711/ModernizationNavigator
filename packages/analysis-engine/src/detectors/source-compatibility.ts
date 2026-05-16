import type { InspectSourceCompatibilityResult } from '@modernization-navigator/shared';

export async function detectSourceCompatibilityIssues(
  _repoRoot: string,
  _options?: { subdirectory?: string; targetNodeVersion?: string }
): Promise<InspectSourceCompatibilityResult> {
  return {
    issues: [],
    summary:
      'Starter scaffold only: ts-morph source compatibility checks are not implemented yet.'
  };
}
