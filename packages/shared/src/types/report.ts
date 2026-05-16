import { z } from 'zod';

import { reportManifestEntrySchema, reportManifestSchema } from '../schemas/manifest';
import {
  alternativeSolutionSchema,
  bobDecisionSchema,
  bobExecutionPlanItemSchema,
  evidenceItemSchema,
  externalDataStatusSchema,
  issueSchema,
  reportSchema,
  runtimeEvidenceEntrySchema,
  toolTraceEntrySchema,
  validationChecklistItemSchema,
  validationStepSchema
} from '../schemas/report';

export type AlternativeSolution = z.infer<typeof alternativeSolutionSchema>;
export type EvidenceItem = z.infer<typeof evidenceItemSchema>;
export type ValidationStep = z.infer<typeof validationStepSchema>;
export type Issue = z.infer<typeof issueSchema>;
export type RuntimeEvidenceEntry = z.infer<typeof runtimeEvidenceEntrySchema>;
export type ExternalDataStatus = z.infer<typeof externalDataStatusSchema>;
export type ToolTraceEntry = z.infer<typeof toolTraceEntrySchema>;
export type BobDecision = z.infer<typeof bobDecisionSchema>;
export type BobExecutionPlanItem = z.infer<typeof bobExecutionPlanItemSchema>;
export type ValidationChecklistItem = z.infer<typeof validationChecklistItemSchema>;
export type Report = z.infer<typeof reportSchema>;
export type ReportManifestEntry = z.infer<typeof reportManifestEntrySchema>;
export type ReportManifest = z.infer<typeof reportManifestSchema>;
