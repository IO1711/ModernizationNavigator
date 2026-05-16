import { z } from 'zod';

import { reportManifestSchema } from '../schemas/manifest';
import {
  baseToolInputSchema,
  collectRuntimeEvidenceResultSchema,
  compareTargetPathsResultSchema,
  discoverRepoScopeResultSchema,
  inspectDependencyBlockersResultSchema,
  inspectOpsRuntimeResultSchema,
  inspectSourceCompatibilityResultSchema,
  openReportViewerInputSchema,
  openReportViewerResultSchema,
  saveModernizationReportInputSchema,
  saveModernizationReportResultSchema
} from '../schemas/tool-results';

export type BaseToolInput = z.infer<typeof baseToolInputSchema>;
export type DiscoverRepoScopeResult = z.infer<typeof discoverRepoScopeResultSchema>;
export type CollectRuntimeEvidenceResult = z.infer<
  typeof collectRuntimeEvidenceResultSchema
>;
export type InspectDependencyBlockersResult = z.infer<
  typeof inspectDependencyBlockersResultSchema
>;
export type InspectOpsRuntimeResult = z.infer<typeof inspectOpsRuntimeResultSchema>;
export type InspectSourceCompatibilityResult = z.infer<
  typeof inspectSourceCompatibilityResultSchema
>;
export type CompareTargetPathsResult = z.infer<
  typeof compareTargetPathsResultSchema
>;
export type SaveModernizationReportInput = z.infer<
  typeof saveModernizationReportInputSchema
>;
export type SaveModernizationReportResult = z.infer<
  typeof saveModernizationReportResultSchema
>;
export type OpenReportViewerInput = z.infer<typeof openReportViewerInputSchema>;
export type OpenReportViewerResult = z.infer<typeof openReportViewerResultSchema>;
export type ReportManifest = z.infer<typeof reportManifestSchema>;
