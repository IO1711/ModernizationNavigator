import { z } from 'zod';

import { issueSchema, reportSchema, runtimeEvidenceEntrySchema } from './report';

export const baseToolInputSchema = z.object({
  repoRoot: z.string(),
  subdirectory: z.string().optional(),
  targetNodeVersion: z.string().optional(),
  offline: z.boolean().optional()
});

export const discoverRepoScopeResultSchema = z.object({
  repoRoot: z.string(),
  subdirectory: z.string().optional(),
  detectedPackageManager: z.enum(['npm', 'pnpm', 'yarn']),
  workspaceType: z.enum(['single', 'monorepo']),
  candidateProjects: z.array(z.string())
});

export const collectRuntimeEvidenceResultSchema = z.object({
  runtimeEvidence: z.array(runtimeEvidenceEntrySchema)
});

export const inspectDependencyBlockersResultSchema = z.object({
  issues: z.array(issueSchema),
  summary: z.string()
});

export const inspectOpsRuntimeResultSchema = z.object({
  issues: z.array(issueSchema),
  summary: z.string()
});

export const inspectSourceCompatibilityResultSchema = z.object({
  issues: z.array(issueSchema),
  summary: z.string()
});

export const compareTargetPathsResultSchema = z.object({
  comparedPaths: z.array(
    z.object({
      label: z.string(),
      targetVersion: z.string(),
      riskScore: z.number(),
      effortScore: z.number(),
      blockers: z.array(z.string())
    })
  ),
  recommendedPathCandidate: z.string()
});

export const saveModernizationReportInputSchema = z.object({
  report: reportSchema
});

export const saveModernizationReportResultSchema = z.object({
  reportId: z.string(),
  reportPath: z.string(),
  historyPath: z.string()
});

export const openReportViewerInputSchema = z.object({
  reportPath: z.string(),
  autoOpenViewer: z.boolean().optional()
});

export const openReportViewerResultSchema = z.object({
  viewerUrl: z.string().url(),
  serverStatus: z.enum(['started', 'reused'])
});
