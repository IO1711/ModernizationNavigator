import { z } from 'zod';

import { TOOL_NAMES } from '../constants/tool-names';
import {
  baseToolInputSchema,
  collectRuntimeEvidenceResultSchema,
  compareTargetPathEntrySchema,
  compareTargetPathsResultSchema,
  discoverRepoScopeResultSchema,
  inspectDependencyBlockersResultSchema,
  inspectOpsRuntimeResultSchema,
  inspectSourceCompatibilityResultSchema,
  openReportViewerInputSchema,
  openReportViewerResultSchema,
  saveModernizationReportInputSchema,
  saveModernizationReportResultSchema,
  toolInputSchemas,
  toolResultSchemas
} from '../schemas/tool-results';
import type { ReportManifest } from './report';

export type BaseToolInput = z.infer<typeof baseToolInputSchema>;
export type ToolName = (typeof TOOL_NAMES)[number];
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
export type CompareTargetPathEntry = z.infer<typeof compareTargetPathEntrySchema>;
export type SaveModernizationReportInput = z.infer<
  typeof saveModernizationReportInputSchema
>;
export type SaveModernizationReportResult = z.infer<
  typeof saveModernizationReportResultSchema
>;
export type OpenReportViewerInput = z.infer<typeof openReportViewerInputSchema>;
export type OpenReportViewerResult = z.infer<typeof openReportViewerResultSchema>;
export type ToolInputSchemas = typeof toolInputSchemas;
export type ToolResultSchemas = typeof toolResultSchemas;
export type ToolInputByName = {
  discover_repo_scope: BaseToolInput;
  collect_runtime_evidence: BaseToolInput;
  inspect_dependency_blockers: BaseToolInput;
  inspect_ops_runtime: BaseToolInput;
  inspect_source_compatibility: BaseToolInput;
  compare_target_paths: BaseToolInput;
  save_modernization_report: SaveModernizationReportInput;
  open_report_viewer: OpenReportViewerInput;
};
export type ToolResultByName = {
  discover_repo_scope: DiscoverRepoScopeResult;
  collect_runtime_evidence: CollectRuntimeEvidenceResult;
  inspect_dependency_blockers: InspectDependencyBlockersResult;
  inspect_ops_runtime: InspectOpsRuntimeResult;
  inspect_source_compatibility: InspectSourceCompatibilityResult;
  compare_target_paths: CompareTargetPathsResult;
  save_modernization_report: SaveModernizationReportResult;
  open_report_viewer: OpenReportViewerResult;
};
export type { ReportManifest };
