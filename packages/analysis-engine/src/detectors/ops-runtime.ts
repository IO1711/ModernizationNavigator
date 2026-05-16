import path from 'node:path';

import {
  loadCiRuntimeRules,
  loadDeploymentRuntimeRules
} from '@modernization-navigator/knowledge-base';
import type {
  EvidenceItem,
  InspectOpsRuntimeResult,
  Issue,
  RuntimeEvidenceEntry
} from '@modernization-navigator/shared';

import { pickMostCommonMajor, extractMajorVersion, sanitizeIssueIdPart } from '../internal/version-utils';
import { collectRuntimeEvidenceEntries } from './runtime-evidence';
import { detectPackageManager } from './package-manager';

type DetectionOptions = {
  subdirectory?: string;
  targetNodeVersion?: string;
};

function resolveBaselineMajor(
  runtimeEvidence: RuntimeEvidenceEntry[],
  targetNodeVersion?: string
): number | null {
  const targetMajor = extractMajorVersion(targetNodeVersion);

  if (targetMajor !== null) {
    return targetMajor;
  }

  const primaryEvidence = runtimeEvidence.filter((entry) =>
    ['engines', 'nvmrc', 'node-version'].includes(entry.kind)
  );

  return (
    pickMostCommonMajor(primaryEvidence.map((entry) => entry.value)) ??
    pickMostCommonMajor(runtimeEvidence.map((entry) => entry.value))
  );
}

function categoryFromEvidence(
  entry: RuntimeEvidenceEntry
): Issue['category'] {
  switch (entry.kind) {
    case 'docker':
      return 'docker';
    case 'github-actions':
      return 'ci';
    case 'deployment':
      return 'deployment';
    case 'script':
      return 'script';
    default:
      return 'runtime';
  }
}

function evidenceKindFromRuntimeEntry(
  entry: RuntimeEvidenceEntry
): EvidenceItem['kind'] {
  switch (entry.kind) {
    case 'docker':
      return 'docker';
    case 'github-actions':
      return 'github-actions';
    case 'deployment':
      return 'deployment';
    case 'script':
      return 'script';
    default:
      return 'package';
  }
}

function buildIssueTemplate(entry: RuntimeEvidenceEntry): {
  incompatibilityReason: string;
  defaultTechnicalRecommendation: string;
} {
  if (entry.kind === 'github-actions') {
    const matchingRule =
      loadCiRuntimeRules().find(
        (rule) =>
          entry.source.includes(rule.match.workflowPattern ?? '') &&
          (rule.match.workflowPattern ?? '').length > 0
      ) ?? loadCiRuntimeRules()[0];

    return {
      incompatibilityReason:
        matchingRule?.incompatibilityReason ??
        'GitHub Actions can pin a different Node runtime from the requested target.',
      defaultTechnicalRecommendation:
        matchingRule?.defaultTechnicalRecommendation ??
        'Update workflow node-version settings during the runtime upgrade rollout.'
    };
  }

  if (entry.kind === 'deployment') {
    const matchingRule =
      loadDeploymentRuntimeRules().find((rule) =>
        (rule.match.deploymentFiles ?? []).includes(path.basename(entry.filePath))
      ) ?? loadDeploymentRuntimeRules()[0];

    return {
      incompatibilityReason:
        matchingRule?.incompatibilityReason ??
        'Deployment runtime declarations can drift away from the requested Node target.',
      defaultTechnicalRecommendation:
        matchingRule?.defaultTechnicalRecommendation ??
        'Update deployment runtime declarations in the same phase as the Node upgrade.'
    };
  }

  if (entry.kind === 'docker') {
    return {
      incompatibilityReason:
        'Docker base images and NODE_VERSION build args can pin a different Node major than the rollout target.',
      defaultTechnicalRecommendation:
        'Refresh Docker base images and build args together with the runtime upgrade.'
    };
  }

  if (entry.kind === 'script') {
    return {
      incompatibilityReason:
        'Scripts that pin a Node version can silently reintroduce the old runtime after the upgrade.',
      defaultTechnicalRecommendation:
        'Update version-pinned scripts and verify them on the same runtime as CI and production.'
    };
  }

  return {
    incompatibilityReason:
      'Runtime declarations in manifest files can diverge from the requested Node target and create upgrade drift.',
    defaultTechnicalRecommendation:
      'Reconcile runtime declarations before the final cutover.'
  };
}

function sortIssues(issues: Issue[]): Issue[] {
  return [...issues].sort((left, right) => {
    return (
      left.id.localeCompare(right.id) ||
      left.affectedFiles.join('|').localeCompare(right.affectedFiles.join('|'))
    );
  });
}

export async function detectOpsRuntimeIssues(
  repoRoot: string,
  options?: DetectionOptions
): Promise<InspectOpsRuntimeResult> {
  const runtimeEvidence = await collectRuntimeEvidenceEntries(
    repoRoot,
    options?.subdirectory
  );
  const baselineMajor = resolveBaselineMajor(
    runtimeEvidence,
    options?.targetNodeVersion
  );

  if (baselineMajor === null) {
    return {
      issues: [],
      summary: 'No comparable runtime declarations were found for ops/runtime analysis.'
    };
  }

  const packageManager = detectPackageManager(repoRoot);
  const issues: Issue[] = [];

  for (const entry of runtimeEvidence) {
    const entryMajor = extractMajorVersion(entry.value);

    if (entryMajor === null || entryMajor === baselineMajor) {
      continue;
    }

    const category = categoryFromEvidence(entry);
    const template = buildIssueTemplate(entry);
    const validationCommand = packageManager === 'npm' ? 'npm test' : `${packageManager} test`;
    const validationBuildCommand =
      packageManager === 'npm' ? 'npm run build' : `${packageManager} build`;

    issues.push({
      id: `ops-${category}-${sanitizeIssueIdPart(entry.filePath)}-${entryMajor}-vs-${baselineMajor}`,
      category,
      title: `${entry.filePath} declares Node ${entryMajor} instead of ${baselineMajor}`,
      issue: `${entry.filePath} contains a ${entry.kind} runtime declaration for Node ${entryMajor}, which differs from the ${options?.targetNodeVersion ? `requested target Node ${options.targetNodeVersion}` : `detected baseline Node ${baselineMajor}`}.`,
      incompatibilityReason: template.incompatibilityReason,
      defaultTechnicalRecommendation: template.defaultTechnicalRecommendation,
      alternativeSolutions: [],
      affectedFiles: [entry.filePath],
      evidence: [
        {
          kind: evidenceKindFromRuntimeEntry(entry),
          filePath: entry.filePath,
          summary: `Runtime declaration differs from the expected Node ${baselineMajor} baseline.`,
          snippet: entry.value,
          source: entry.source
        }
      ],
      recommendedCommands: [
        `rg -n "node|NODE_VERSION|node-version|Dockerfile" ${entry.filePath}`,
        validationCommand,
        validationBuildCommand
      ],
      validationSteps: [
        {
          title: `Validate ${entry.filePath} on Node ${baselineMajor}`,
          commands: [validationCommand, validationBuildCommand],
          expectedResult: `The pipeline or runtime config represented by ${entry.filePath} aligns with Node ${baselineMajor}.`
        }
      ]
    });
  }

  const sortedIssues = sortIssues(issues);
  const summaryPrefix =
    sortedIssues.length === 0 ? 'No ops/runtime mismatches detected.' : `Detected ${sortedIssues.length} ops/runtime mismatch(es).`;

  return {
    issues: sortedIssues,
    summary: `${summaryPrefix} Compared runtime declarations against Node ${baselineMajor}.`
  };
}
