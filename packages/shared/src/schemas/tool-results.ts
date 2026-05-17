import { z } from 'zod';

import {
  COLLECT_RUNTIME_EVIDENCE,
  COMPARE_TARGET_PATHS,
  DISCOVER_REPO_SCOPE,
  INSPECT_DEPENDENCY_BLOCKERS,
  INSPECT_OPS_RUNTIME,
  INSPECT_SOURCE_COMPATIBILITY,
  OPEN_REPORT_VIEWER,
  SAVE_MODERNIZATION_REPORT
} from '../constants/tool-names';
import { issueSchema, reportSchema, runtimeEvidenceEntrySchema } from './report';
import {
  historyReportPathSchema,
  packageManagerSchema,
  reportIdSchema,
  reportPathSchema,
  reportPathV2Schema,
  repoRootSchema,
  safeSubdirectorySchema,
  targetNodeVersionSchema,
  workspaceTypeSchema
} from './primitives';

export const baseToolInputSchema = z
  .object({
    repoRoot: repoRootSchema,
    subdirectory: safeSubdirectorySchema.optional(),
    targetNodeVersion: targetNodeVersionSchema.optional(),
    offline: z.boolean().optional()
  })
  .strict();

export const discoverRepoScopeResultSchema = z
  .object({
    repoRoot: repoRootSchema,
    subdirectory: safeSubdirectorySchema.optional(),
    detectedPackageManager: packageManagerSchema,
    workspaceType: workspaceTypeSchema,
    candidateProjects: z.array(safeSubdirectorySchema)
  })
  .strict();

export const collectRuntimeEvidenceResultSchema = z
  .object({
    runtimeEvidence: z.array(runtimeEvidenceEntrySchema)
  })
  .strict();

export const inspectDependencyBlockersResultSchema = z
  .object({
    issues: z.array(issueSchema),
    summary: z.string().trim().min(1)
  })
  .strict();

export const inspectOpsRuntimeResultSchema = z
  .object({
    issues: z.array(issueSchema),
    summary: z.string().trim().min(1)
  })
  .strict();

export const inspectSourceCompatibilityResultSchema = z
  .object({
    issues: z.array(issueSchema),
    summary: z.string().trim().min(1)
  })
  .strict();

export const compareTargetPathEntrySchema = z
  .object({
    label: z.string().trim().min(1),
    targetVersion: targetNodeVersionSchema,
    riskScore: z.number(),
    effortScore: z.number(),
    blockers: z.array(z.string().trim().min(1))
  })
  .strict();

export const compareTargetPathsResultSchema = z
  .object({
    comparedPaths: z.array(compareTargetPathEntrySchema),
    recommendedPathCandidate: z.string().trim().min(1)
  })
  .strict();

export const saveModernizationReportInputSchema = z
  .object({
    report: reportSchema
  })
  .strict();

export const saveModernizationReportResultSchema = z
  .object({
    reportId: reportIdSchema,
    reportPath: reportPathSchema,
    historyPath: historyReportPathSchema
  })
  .strict();

export const openReportViewerInputSchema = z
  .object({
    reportPath: z.union([reportPathSchema, reportPathV2Schema]),
    repoRoot: repoRootSchema.optional(),
    autoOpenViewer: z.boolean().optional()
  })
  .strict();

export const openReportViewerResultSchema = z
  .object({
    viewerUrl: z.string().url(),
    serverStatus: z.enum(['started', 'reused'])
  })
  .strict();

export const toolInputSchemas = {
  [DISCOVER_REPO_SCOPE]: baseToolInputSchema,
  [COLLECT_RUNTIME_EVIDENCE]: baseToolInputSchema,
  [INSPECT_DEPENDENCY_BLOCKERS]: baseToolInputSchema,
  [INSPECT_OPS_RUNTIME]: baseToolInputSchema,
  [INSPECT_SOURCE_COMPATIBILITY]: baseToolInputSchema,
  [COMPARE_TARGET_PATHS]: baseToolInputSchema,
  [SAVE_MODERNIZATION_REPORT]: saveModernizationReportInputSchema,
  [OPEN_REPORT_VIEWER]: openReportViewerInputSchema
} as const;

export const toolResultSchemas = {
  [DISCOVER_REPO_SCOPE]: discoverRepoScopeResultSchema,
  [COLLECT_RUNTIME_EVIDENCE]: collectRuntimeEvidenceResultSchema,
  [INSPECT_DEPENDENCY_BLOCKERS]: inspectDependencyBlockersResultSchema,
  [INSPECT_OPS_RUNTIME]: inspectOpsRuntimeResultSchema,
  [INSPECT_SOURCE_COMPATIBILITY]: inspectSourceCompatibilityResultSchema,
  [COMPARE_TARGET_PATHS]: compareTargetPathsResultSchema,
  [SAVE_MODERNIZATION_REPORT]: saveModernizationReportResultSchema,
  [OPEN_REPORT_VIEWER]: openReportViewerResultSchema
} as const;
