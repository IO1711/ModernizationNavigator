import { z } from 'zod';

import { TOOL_NAMES_V2 } from '../constants/tool-names-v2';
import {
  baseToolInputV2Schema,
  collectEnvironmentEvidenceResultSchema,
  compareUpgradePathEntrySchema,
  compareUpgradePathsResultSchema,
  discoverProjectStackResultSchema,
  inspectFrameworkDependenciesResultSchema,
  inspectPlatformConfigResultSchema,
  inspectSourceRisksResultSchema,
  saveModernizationReportV2InputSchema,
  saveModernizationReportV2ResultSchema,
  toolInputSchemasV2,
  toolResultSchemasV2
} from '../schemas/tool-results-v2';

export type BaseToolInputV2 = z.infer<typeof baseToolInputV2Schema>;
export type ToolNameV2 = (typeof TOOL_NAMES_V2)[number];
export type DiscoverProjectStackResult = z.infer<typeof discoverProjectStackResultSchema>;
export type CollectEnvironmentEvidenceResult = z.infer<
  typeof collectEnvironmentEvidenceResultSchema
>;
export type InspectFrameworkDependenciesResult = z.infer<
  typeof inspectFrameworkDependenciesResultSchema
>;
export type InspectPlatformConfigResult = z.infer<
  typeof inspectPlatformConfigResultSchema
>;
export type InspectSourceRisksResult = z.infer<typeof inspectSourceRisksResultSchema>;
export type CompareUpgradePathsResult = z.infer<
  typeof compareUpgradePathsResultSchema
>;
export type CompareUpgradePathEntry = z.infer<typeof compareUpgradePathEntrySchema>;
export type SaveModernizationReportV2Input = z.infer<
  typeof saveModernizationReportV2InputSchema
>;
export type SaveModernizationReportV2Result = z.infer<
  typeof saveModernizationReportV2ResultSchema
>;
export type ToolInputSchemasV2 = typeof toolInputSchemasV2;
export type ToolResultSchemasV2 = typeof toolResultSchemasV2;
export type ToolInputByNameV2 = {
  discover_project_stack: BaseToolInputV2;
  collect_environment_evidence: BaseToolInputV2;
  inspect_framework_dependencies: BaseToolInputV2;
  inspect_platform_config: BaseToolInputV2;
  inspect_source_risks: BaseToolInputV2;
  compare_upgrade_paths: BaseToolInputV2;
  save_modernization_report_v2: SaveModernizationReportV2Input;
};
export type ToolResultByNameV2 = {
  discover_project_stack: DiscoverProjectStackResult;
  collect_environment_evidence: CollectEnvironmentEvidenceResult;
  inspect_framework_dependencies: InspectFrameworkDependenciesResult;
  inspect_platform_config: InspectPlatformConfigResult;
  inspect_source_risks: InspectSourceRisksResult;
  compare_upgrade_paths: CompareUpgradePathsResult;
  save_modernization_report_v2: SaveModernizationReportV2Result;
};
