import { z } from 'zod';

export const alternativeSolutionSchema = z.object({
  rank: z.number().int().nonnegative(),
  title: z.string(),
  summary: z.string(),
  targetVersionRange: z.string(),
  rationale: z.string(),
  tradeoffs: z.array(z.string()),
  commands: z.array(z.string())
});

export const evidenceItemSchema = z.object({
  kind: z.enum([
    'package',
    'lockfile',
    'docker',
    'github-actions',
    'deployment',
    'script',
    'source'
  ]),
  filePath: z.string(),
  summary: z.string(),
  line: z.number().int().positive().optional(),
  column: z.number().int().positive().optional(),
  packageName: z.string().optional(),
  configKey: z.string().optional(),
  snippet: z.string().optional(),
  source: z.string().optional()
});

export const validationStepSchema = z.object({
  title: z.string(),
  commands: z.array(z.string()),
  expectedResult: z.string()
});

export const issueSchema = z.object({
  id: z.string(),
  category: z.enum([
    'runtime',
    'dependency',
    'ci',
    'docker',
    'deployment',
    'script',
    'source'
  ]),
  title: z.string(),
  issue: z.string(),
  incompatibilityReason: z.string(),
  defaultTechnicalRecommendation: z.string(),
  alternativeSolutions: z.array(alternativeSolutionSchema),
  affectedFiles: z.array(z.string()),
  evidence: z.array(evidenceItemSchema),
  recommendedCommands: z.array(z.string()),
  validationSteps: z.array(validationStepSchema)
});

export const runtimeEvidenceEntrySchema = z.object({
  source: z.string(),
  filePath: z.string(),
  value: z.string(),
  kind: z.enum([
    'engines',
    'nvmrc',
    'node-version',
    'docker',
    'github-actions',
    'deployment',
    'script'
  ])
});

export const externalDataStatusSchema = z.object({
  npmRegistry: z.enum(['used', 'skipped_offline', 'error']),
  osv: z.enum(['used', 'skipped_offline', 'error']),
  notes: z.array(z.string())
});

export const toolTraceEntrySchema = z.object({
  toolName: z.string(),
  purpose: z.string(),
  status: z.enum(['success', 'error', 'skipped']),
  startedAt: z.string(),
  finishedAt: z.string(),
  resultSummary: z.string()
});

export const bobDecisionSchema = z.object({
  summary: z.string(),
  selectedTargetPath: z.string(),
  rationale: z.string(),
  prioritizedRisks: z.array(z.string()),
  chosenSolutions: z.array(z.string()),
  tradeoffs: z.array(z.string())
});

export const bobExecutionPlanItemSchema = z.object({
  phase: z.string(),
  order: z.number().int(),
  title: z.string(),
  actions: z.array(z.string()),
  dependsOn: z.array(z.string()),
  validation: z.array(z.string())
});

export const validationChecklistItemSchema = z.object({
  title: z.string(),
  commands: z.array(z.string()),
  expectedResult: z.string()
});

export const reportSchema = z.object({
  reportId: z.string(),
  createdAt: z.string(),
  repoRoot: z.string(),
  subdirectory: z.string().optional(),
  requestedTargetNodeVersion: z.string(),
  evaluatedTargetNodeVersions: z.array(z.string()),
  detectedPackageManager: z.enum(['npm', 'pnpm', 'yarn']),
  offlineMode: z.boolean(),
  externalDataStatus: externalDataStatusSchema,
  toolTrace: z.array(toolTraceEntrySchema),
  runtimeEvidence: z.array(runtimeEvidenceEntrySchema),
  issues: z.array(issueSchema),
  bobDecision: bobDecisionSchema,
  bobExecutionPlan: z.array(bobExecutionPlanItemSchema),
  validationChecklist: z.array(validationChecklistItemSchema)
});
