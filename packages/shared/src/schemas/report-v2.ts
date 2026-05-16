import { z } from 'zod';

import { toolNameV2Schema } from './primitives';
import {
  bobDecisionSchema,
  bobExecutionPlanItemSchema,
  issueSchema,
  validationChecklistItemSchema
} from './report';
import {
  environmentEvidenceEntrySchema,
  externalDataStatusV2Schema,
  projectDescriptorSchema,
  stackProfileSchema
} from './stack-profile';
import {
  isoTimestampSchema,
  reportIdSchema,
  repoRootSchema,
  safeSubdirectorySchema,
  targetVersionSchema
} from './primitives';

export const toolTraceEntryV2Schema = z
  .object({
    toolName: toolNameV2Schema,
    purpose: z.string().trim().min(1),
    status: z.enum(['success', 'error', 'skipped']),
    startedAt: isoTimestampSchema,
    finishedAt: isoTimestampSchema,
    resultSummary: z.string().trim().min(1)
  })
  .strict();

export const reportV2Schema = z
  .object({
    reportVersion: z.literal('v2'),
    reportId: reportIdSchema,
    createdAt: isoTimestampSchema,
    repoRoot: repoRootSchema,
    subdirectory: safeSubdirectorySchema.optional(),
    stackProfile: stackProfileSchema,
    projectDescriptors: z.array(projectDescriptorSchema),
    requestedTargetVersion: targetVersionSchema,
    evaluatedTargetVersions: z.array(targetVersionSchema),
    offlineMode: z.boolean(),
    externalDataStatus: externalDataStatusV2Schema,
    toolTrace: z.array(toolTraceEntryV2Schema),
    environmentEvidence: z.array(environmentEvidenceEntrySchema),
    issues: z.array(issueSchema),
    bobDecision: bobDecisionSchema,
    bobExecutionPlan: z.array(bobExecutionPlanItemSchema),
    validationChecklist: z.array(validationChecklistItemSchema)
  })
  .strict();
