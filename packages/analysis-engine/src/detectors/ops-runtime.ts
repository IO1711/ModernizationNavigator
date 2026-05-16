import type { InspectOpsRuntimeResult } from '@modernization-navigator/shared';

export async function detectOpsRuntimeIssues(
  _repoRoot: string,
  _options?: { subdirectory?: string; targetNodeVersion?: string }
): Promise<InspectOpsRuntimeResult> {
  return {
    issues: [],
    summary:
      'Starter scaffold only: CI, Docker, and deployment runtime checks are not implemented yet.'
  };
}
