import type {
  CompareTargetPathsResult,
  Issue,
  RuntimeEvidenceEntry
} from '@modernization-navigator/shared';

import {
  extractMajorVersion,
  pickMostCommonMajor
} from '../internal/version-utils';

function countIssuesByCategory(issues: Issue[]): Record<Issue['category'], number> {
  const counts: Record<Issue['category'], number> = {
    ci: 0,
    dependency: 0,
    deployment: 0,
    docker: 0,
    runtime: 0,
    script: 0,
    source: 0
  };

  for (const issue of issues) {
    counts[issue.category] += 1;
  }

  return counts;
}

function clampScore(value: number): number {
  return Math.max(1, Math.min(10, Number(value.toFixed(1))));
}

function uniqueBlockers(issues: Issue[]): string[] {
  return Array.from(new Set(issues.map((issue) => issue.title))).sort((left, right) =>
    left.localeCompare(right)
  );
}

function calculateEvidenceConfidence(runtimeEvidence?: RuntimeEvidenceEntry[]): number {
  if (!runtimeEvidence || runtimeEvidence.length === 0) {
    return 0;
  }

  const distinctKinds = new Set(runtimeEvidence.map((entry) => entry.kind)).size;
  return Math.min(1, distinctKinds / 5);
}

export function compareTargetPaths(options: {
  targetNodeVersion?: string;
  issues?: Issue[];
  runtimeEvidence?: RuntimeEvidenceEntry[];
}): CompareTargetPathsResult {
  const targetVersion = options.targetNodeVersion ?? 'unknown';
  const issues = [...(options.issues ?? [])].sort((left, right) =>
    left.id.localeCompare(right.id)
  );
  const blockerTitles = uniqueBlockers(issues);
  const targetMajor = extractMajorVersion(targetVersion);
  const categoryCounts = countIssuesByCategory(issues);
  const evidenceConfidence = calculateEvidenceConfidence(options.runtimeEvidence);
  const detectedCurrentMajor = pickMostCommonMajor(
    (options.runtimeEvidence ?? []).map((entry) => entry.value)
  );
  const majorJump =
    targetMajor !== null && detectedCurrentMajor !== null
      ? Math.max(0, targetMajor - detectedCurrentMajor)
      : targetMajor !== null && targetMajor >= 20
        ? 2
        : 0;
  const directRisk = clampScore(
    2 +
      categoryCounts.dependency * 1.6 +
      categoryCounts.source * 1.4 +
      (categoryCounts.runtime +
        categoryCounts.ci +
        categoryCounts.docker +
        categoryCounts.deployment +
        categoryCounts.script) *
        0.8 +
      majorJump * 0.6 -
      evidenceConfidence * 0.5
  );
  const directEffort = clampScore(
    2 +
      issues.length * 0.55 +
      categoryCounts.source * 0.5 +
      categoryCounts.dependency * 0.45 +
      majorJump * 0.35
  );
  const shouldOfferStagedPath =
    targetMajor !== null &&
    (targetMajor >= 20 || directRisk >= 6 || categoryCounts.dependency > 0 || categoryCounts.source > 0);
  const stagedBlockerIssues = issues.filter((issue) =>
    ['dependency', 'source'].includes(issue.category)
  );

  const directPath = {
    label: 'direct-upgrade',
    targetVersion,
    riskScore: directRisk,
    effortScore: directEffort,
    blockers: blockerTitles
  };

  if (!shouldOfferStagedPath) {
    return {
      comparedPaths: [directPath],
      recommendedPathCandidate: directPath.label
    };
  }

  const stagedPath = {
    label: 'staged-upgrade',
    targetVersion,
    riskScore: clampScore(
      directRisk -
        1.8 -
        Math.min(1.2, categoryCounts.runtime * 0.2 + categoryCounts.ci * 0.25)
    ),
    effortScore: clampScore(directEffort + 1.7 + majorJump * 0.2),
    blockers: uniqueBlockers(stagedBlockerIssues)
  };
  const directWeightedScore = directPath.riskScore * 1.3 + directPath.effortScore;
  const stagedWeightedScore = stagedPath.riskScore * 1.3 + stagedPath.effortScore;

  return {
    comparedPaths: [directPath, stagedPath],
    recommendedPathCandidate:
      stagedWeightedScore < directWeightedScore ? stagedPath.label : directPath.label
  };
}
