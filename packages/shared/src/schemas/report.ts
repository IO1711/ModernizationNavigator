import { z } from 'zod';

import {
  isoTimestampSchema,
  packageManagerSchema,
  reportIdSchema,
  repoRootSchema,
  safeRelativePathSchema,
  safeSubdirectorySchema,
  targetNodeVersionSchema,
  toolNameSchema
} from './primitives';

export const alternativeSolutionSchema = z
  .object({
    rank: z.number().int().nonnegative(),
    title: z.string().trim().min(1),
    summary: z.string().trim().min(1),
    targetVersionRange: z.string().trim().min(1),
    rationale: z.string().trim().min(1),
    tradeoffs: z.array(z.string().trim().min(1)),
    commands: z.array(z.string().trim().min(1))
  })
  .strict();

export const evidenceItemSchema = z
  .object({
    kind: z.enum([
      'package',
      'lockfile',
      'docker',
      'github-actions',
      'deployment',
      'script',
      'source'
    ]),
    filePath: safeRelativePathSchema,
    summary: z.string().trim().min(1),
    line: z.number().int().positive().optional(),
    column: z.number().int().positive().optional(),
    packageName: z.string().trim().min(1).optional(),
    configKey: z.string().trim().min(1).optional(),
    snippet: z.string().trim().min(1).optional(),
    source: z.string().trim().min(1).optional()
  })
  .strict();

export const validationStepSchema = z
  .object({
    title: z.string().trim().min(1),
    commands: z.array(z.string().trim().min(1)),
    expectedResult: z.string().trim().min(1)
  })
  .strict();

export const issueSchema = z
  .object({
    id: z.string().trim().min(1),
    category: z.enum([
      'runtime',
      'dependency',
      'ci',
      'docker',
      'deployment',
      'script',
      'source'
    ]),
    title: z.string().trim().min(1),
    issue: z.string().trim().min(1),
    incompatibilityReason: z.string().trim().min(1),
    defaultTechnicalRecommendation: z.string().trim().min(1),
    alternativeSolutions: z.array(alternativeSolutionSchema),
    affectedFiles: z.array(safeRelativePathSchema),
    evidence: z.array(evidenceItemSchema),
    recommendedCommands: z.array(z.string().trim().min(1)),
    validationSteps: z.array(validationStepSchema)
  })
  .strict();

export const runtimeEvidenceEntrySchema = z
  .object({
    source: z.string().trim().min(1),
    filePath: safeRelativePathSchema,
    value: z.string().trim().min(1),
    kind: z.enum([
      'engines',
      'nvmrc',
      'node-version',
      'docker',
      'github-actions',
      'deployment',
      'script'
    ])
  })
  .strict();

export const externalDataStatusSchema = z
  .object({
    npmRegistry: z.enum(['used', 'skipped_offline', 'error']),
    osv: z.enum(['used', 'skipped_offline', 'error']),
    notes: z.array(z.string().trim().min(1))
  })
  .strict();

export const toolTraceEntrySchema = z
  .object({
    toolName: toolNameSchema,
    purpose: z.string().trim().min(1),
    status: z.enum(['success', 'error', 'skipped']),
    startedAt: isoTimestampSchema,
    finishedAt: isoTimestampSchema,
    resultSummary: z.string().trim().min(1)
  })
  .strict();

export const bobDecisionSchema = z
  .object({
    summary: z.string().trim().min(1),
    selectedTargetPath: z.string().trim().min(1),
    rationale: z.string().trim().min(1),
    prioritizedRisks: z.array(z.string().trim().min(1)),
    chosenSolutions: z.array(z.string().trim().min(1)),
    tradeoffs: z.array(z.string().trim().min(1))
  })
  .strict();

export const bobExecutionPlanItemSchema = z
  .object({
    phase: z.string().trim().min(1),
    order: z.number().int().positive(),
    title: z.string().trim().min(1),
    actions: z.array(z.string().trim().min(1)),
    dependsOn: z.array(z.string().trim().min(1)),
    validation: z.array(z.string().trim().min(1))
  })
  .strict();

export const validationChecklistItemSchema = z
  .object({
    title: z.string().trim().min(1),
    commands: z.array(z.string().trim().min(1)),
    expectedResult: z.string().trim().min(1)
  })
  .strict();

export const reportSchema = z
  .object({
    reportId: reportIdSchema,
    createdAt: isoTimestampSchema,
    repoRoot: repoRootSchema,
    subdirectory: safeSubdirectorySchema.optional(),
    requestedTargetNodeVersion: targetNodeVersionSchema,
    evaluatedTargetNodeVersions: z.array(targetNodeVersionSchema),
    detectedPackageManager: packageManagerSchema,
    offlineMode: z.boolean(),
    externalDataStatus: externalDataStatusSchema,
    toolTrace: z.array(toolTraceEntrySchema),
    runtimeEvidence: z.array(runtimeEvidenceEntrySchema),
    issues: z.array(issueSchema),
    bobDecision: bobDecisionSchema,
    bobExecutionPlan: z.array(bobExecutionPlanItemSchema),
    validationChecklist: z.array(validationChecklistItemSchema)
  })
  .strict();
