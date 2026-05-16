import type { CompareTargetPathsResult, Issue } from '@modernization-navigator/shared';

function toTargetMajor(targetNodeVersion?: string): number | null {
  if (!targetNodeVersion) {
    return null;
  }

  const match = targetNodeVersion.match(/\d+/);
  const major = match ? Number.parseInt(match[0], 10) : Number.NaN;
  return Number.isFinite(major) ? major : null;
}

export function compareTargetPaths(options: {
  targetNodeVersion?: string;
  issues?: Issue[];
}): CompareTargetPathsResult {
  const targetVersion = options.targetNodeVersion ?? 'unknown';
  const blockerTitles = (options.issues ?? []).map((issue) => issue.title);
  const targetMajor = toTargetMajor(targetVersion);
  const needsStagedPath = targetMajor !== null && targetMajor >= 20;

  const directPath = {
    label: 'direct-upgrade',
    targetVersion,
    riskScore: Math.min(10, 3 + blockerTitles.length * 1.5),
    effortScore: Math.min(10, 2 + blockerTitles.length),
    blockers: blockerTitles
  };

  if (!needsStagedPath) {
    return {
      comparedPaths: [directPath],
      recommendedPathCandidate: directPath.label
    };
  }

  const stagedPath = {
    label: 'staged-upgrade',
    targetVersion,
    riskScore: Math.max(1, directPath.riskScore - 2),
    effortScore: Math.min(10, directPath.effortScore + 2),
    blockers: blockerTitles
  };

  return {
    comparedPaths: [directPath, stagedPath],
    recommendedPathCandidate:
      blockerTitles.length > 2 ? stagedPath.label : directPath.label
  };
}
