import type { ZodError, ZodType } from 'zod';

import { reportManifestV2Schema } from '../schemas/manifest-v2';
import { reportManifestSchema } from '../schemas/manifest';
import { reportV2Schema } from '../schemas/report-v2';
import { reportSchema } from '../schemas/report';
import { toolInputSchemasV2, toolResultSchemasV2 } from '../schemas/tool-results-v2';
import { toolInputSchemas, toolResultSchemas } from '../schemas/tool-results';
import type { ReportManifestV2, ReportV2 } from '../types/report-v2';
import type { Report, ReportManifest } from '../types/report';
import type {
  BaseToolInputV2,
  CollectEnvironmentEvidenceResult,
  CompareUpgradePathsResult,
  DiscoverProjectStackResult,
  InspectFrameworkDependenciesResult,
  InspectPlatformConfigResult,
  InspectSourceRisksResult,
  SaveModernizationReportV2Input,
  SaveModernizationReportV2Result,
  ToolInputByNameV2,
  ToolNameV2,
  ToolResultByNameV2
} from '../types/tools-v2';
import type {
  BaseToolInput,
  CollectRuntimeEvidenceResult,
  CompareTargetPathsResult,
  DiscoverRepoScopeResult,
  InspectDependencyBlockersResult,
  InspectOpsRuntimeResult,
  InspectSourceCompatibilityResult,
  OpenReportViewerInput,
  OpenReportViewerResult,
  SaveModernizationReportInput,
  SaveModernizationReportResult,
  ToolInputByName,
  ToolName,
  ToolResultByName
} from '../types/tools';

export type ValidationIssue = {
  path: string;
  message: string;
  code: string;
};

export type ValidationResult<T> =
  | {
      success: true;
      data: T;
    }
  | {
      success: false;
      errors: ValidationIssue[];
    };

function toValidationIssues(error: ZodError): ValidationIssue[] {
  return error.issues.map((issue) => ({
    path: issue.path.length > 0 ? issue.path.join('.') : '<root>',
    message: issue.message,
    code: issue.code
  }));
}

function safeValidate<T>(schema: ZodType<T>, payload: unknown): ValidationResult<T> {
  const result = schema.safeParse(payload);

  if (result.success) {
    return {
      success: true,
      data: result.data
    };
  }

  return {
    success: false,
    errors: toValidationIssues(result.error)
  };
}

export function validateReport(payload: unknown): ValidationResult<Report> {
  return safeValidate(reportSchema, payload);
}

export function validateManifest(payload: unknown): ValidationResult<ReportManifest> {
  return safeValidate(reportManifestSchema, payload);
}

export function validateReportV2(payload: unknown): ValidationResult<ReportV2> {
  return safeValidate(reportV2Schema, payload);
}

export function validateManifestV2(payload: unknown): ValidationResult<ReportManifestV2> {
  return safeValidate(reportManifestV2Schema, payload);
}

export function validateToolInput(
  toolName: 'discover_repo_scope',
  payload: unknown
): ValidationResult<BaseToolInput>;
export function validateToolInput(
  toolName: 'collect_runtime_evidence',
  payload: unknown
): ValidationResult<BaseToolInput>;
export function validateToolInput(
  toolName: 'inspect_dependency_blockers',
  payload: unknown
): ValidationResult<BaseToolInput>;
export function validateToolInput(
  toolName: 'inspect_ops_runtime',
  payload: unknown
): ValidationResult<BaseToolInput>;
export function validateToolInput(
  toolName: 'inspect_source_compatibility',
  payload: unknown
): ValidationResult<BaseToolInput>;
export function validateToolInput(
  toolName: 'compare_target_paths',
  payload: unknown
): ValidationResult<BaseToolInput>;
export function validateToolInput(
  toolName: 'save_modernization_report',
  payload: unknown
): ValidationResult<SaveModernizationReportInput>;
export function validateToolInput(
  toolName: 'open_report_viewer',
  payload: unknown
): ValidationResult<OpenReportViewerInput>;
export function validateToolInput(
  toolName: ToolName,
  payload: unknown
): ValidationResult<ToolInputByName[ToolName]> {
  const result = toolInputSchemas[toolName].safeParse(payload);

  if (result.success) {
    return {
      success: true,
      data: result.data
    };
  }

  return {
    success: false,
    errors: toValidationIssues(result.error)
  };
}

export function validateToolResult(
  toolName: 'discover_repo_scope',
  payload: unknown
): ValidationResult<DiscoverRepoScopeResult>;
export function validateToolResult(
  toolName: 'collect_runtime_evidence',
  payload: unknown
): ValidationResult<CollectRuntimeEvidenceResult>;
export function validateToolResult(
  toolName: 'inspect_dependency_blockers',
  payload: unknown
): ValidationResult<InspectDependencyBlockersResult>;
export function validateToolResult(
  toolName: 'inspect_ops_runtime',
  payload: unknown
): ValidationResult<InspectOpsRuntimeResult>;
export function validateToolResult(
  toolName: 'inspect_source_compatibility',
  payload: unknown
): ValidationResult<InspectSourceCompatibilityResult>;
export function validateToolResult(
  toolName: 'compare_target_paths',
  payload: unknown
): ValidationResult<CompareTargetPathsResult>;
export function validateToolResult(
  toolName: 'save_modernization_report',
  payload: unknown
): ValidationResult<SaveModernizationReportResult>;
export function validateToolResult(
  toolName: 'open_report_viewer',
  payload: unknown
): ValidationResult<OpenReportViewerResult>;
export function validateToolResult(
  toolName: ToolName,
  payload: unknown
): ValidationResult<ToolResultByName[ToolName]> {
  const result = toolResultSchemas[toolName].safeParse(payload);

  if (result.success) {
    return {
      success: true,
      data: result.data
    };
  }

  return {
    success: false,
    errors: toValidationIssues(result.error)
  };
}

export function parseReport(payload: unknown): Report {
  return reportSchema.parse(payload);
}

export function parseManifest(payload: unknown): ReportManifest {
  return reportManifestSchema.parse(payload);
}

export function parseReportV2(payload: unknown): ReportV2 {
  return reportV2Schema.parse(payload);
}

export function parseManifestV2(payload: unknown): ReportManifestV2 {
  return reportManifestV2Schema.parse(payload);
}

export function parseToolInput(
  toolName: 'discover_repo_scope',
  payload: unknown
): BaseToolInput;
export function parseToolInput(
  toolName: 'collect_runtime_evidence',
  payload: unknown
): BaseToolInput;
export function parseToolInput(
  toolName: 'inspect_dependency_blockers',
  payload: unknown
): BaseToolInput;
export function parseToolInput(
  toolName: 'inspect_ops_runtime',
  payload: unknown
): BaseToolInput;
export function parseToolInput(
  toolName: 'inspect_source_compatibility',
  payload: unknown
): BaseToolInput;
export function parseToolInput(
  toolName: 'compare_target_paths',
  payload: unknown
): BaseToolInput;
export function parseToolInput(
  toolName: 'save_modernization_report',
  payload: unknown
): SaveModernizationReportInput;
export function parseToolInput(
  toolName: 'open_report_viewer',
  payload: unknown
): OpenReportViewerInput;
export function parseToolInput(
  toolName: ToolName,
  payload: unknown
): ToolInputByName[ToolName] {
  return toolInputSchemas[toolName].parse(payload);
}

export function parseToolResult(
  toolName: 'discover_repo_scope',
  payload: unknown
): DiscoverRepoScopeResult;
export function parseToolResult(
  toolName: 'collect_runtime_evidence',
  payload: unknown
): CollectRuntimeEvidenceResult;
export function parseToolResult(
  toolName: 'inspect_dependency_blockers',
  payload: unknown
): InspectDependencyBlockersResult;
export function parseToolResult(
  toolName: 'inspect_ops_runtime',
  payload: unknown
): InspectOpsRuntimeResult;
export function parseToolResult(
  toolName: 'inspect_source_compatibility',
  payload: unknown
): InspectSourceCompatibilityResult;
export function parseToolResult(
  toolName: 'compare_target_paths',
  payload: unknown
): CompareTargetPathsResult;
export function parseToolResult(
  toolName: 'save_modernization_report',
  payload: unknown
): SaveModernizationReportResult;
export function parseToolResult(
  toolName: 'open_report_viewer',
  payload: unknown
): OpenReportViewerResult;
export function parseToolResult(
  toolName: ToolName,
  payload: unknown
): ToolResultByName[ToolName] {
  return toolResultSchemas[toolName].parse(payload);
}

export function validateToolInputV2(
  toolName: 'discover_project_stack',
  payload: unknown
): ValidationResult<BaseToolInputV2>;
export function validateToolInputV2(
  toolName: 'collect_environment_evidence',
  payload: unknown
): ValidationResult<BaseToolInputV2>;
export function validateToolInputV2(
  toolName: 'inspect_framework_dependencies',
  payload: unknown
): ValidationResult<BaseToolInputV2>;
export function validateToolInputV2(
  toolName: 'inspect_platform_config',
  payload: unknown
): ValidationResult<BaseToolInputV2>;
export function validateToolInputV2(
  toolName: 'inspect_source_risks',
  payload: unknown
): ValidationResult<BaseToolInputV2>;
export function validateToolInputV2(
  toolName: 'compare_upgrade_paths',
  payload: unknown
): ValidationResult<BaseToolInputV2>;
export function validateToolInputV2(
  toolName: 'save_modernization_report_v2',
  payload: unknown
): ValidationResult<SaveModernizationReportV2Input>;
export function validateToolInputV2(
  toolName: ToolNameV2,
  payload: unknown
): ValidationResult<ToolInputByNameV2[ToolNameV2]> {
  const result = toolInputSchemasV2[toolName].safeParse(payload);

  if (result.success) {
    return {
      success: true,
      data: result.data
    };
  }

  return {
    success: false,
    errors: toValidationIssues(result.error)
  };
}

export function validateToolResultV2(
  toolName: 'discover_project_stack',
  payload: unknown
): ValidationResult<DiscoverProjectStackResult>;
export function validateToolResultV2(
  toolName: 'collect_environment_evidence',
  payload: unknown
): ValidationResult<CollectEnvironmentEvidenceResult>;
export function validateToolResultV2(
  toolName: 'inspect_framework_dependencies',
  payload: unknown
): ValidationResult<InspectFrameworkDependenciesResult>;
export function validateToolResultV2(
  toolName: 'inspect_platform_config',
  payload: unknown
): ValidationResult<InspectPlatformConfigResult>;
export function validateToolResultV2(
  toolName: 'inspect_source_risks',
  payload: unknown
): ValidationResult<InspectSourceRisksResult>;
export function validateToolResultV2(
  toolName: 'compare_upgrade_paths',
  payload: unknown
): ValidationResult<CompareUpgradePathsResult>;
export function validateToolResultV2(
  toolName: 'save_modernization_report_v2',
  payload: unknown
): ValidationResult<SaveModernizationReportV2Result>;
export function validateToolResultV2(
  toolName: ToolNameV2,
  payload: unknown
): ValidationResult<ToolResultByNameV2[ToolNameV2]> {
  const result = toolResultSchemasV2[toolName].safeParse(payload);

  if (result.success) {
    return {
      success: true,
      data: result.data
    };
  }

  return {
    success: false,
    errors: toValidationIssues(result.error)
  };
}

export function parseToolInputV2(
  toolName: 'discover_project_stack',
  payload: unknown
): BaseToolInputV2;
export function parseToolInputV2(
  toolName: 'collect_environment_evidence',
  payload: unknown
): BaseToolInputV2;
export function parseToolInputV2(
  toolName: 'inspect_framework_dependencies',
  payload: unknown
): BaseToolInputV2;
export function parseToolInputV2(
  toolName: 'inspect_platform_config',
  payload: unknown
): BaseToolInputV2;
export function parseToolInputV2(
  toolName: 'inspect_source_risks',
  payload: unknown
): BaseToolInputV2;
export function parseToolInputV2(
  toolName: 'compare_upgrade_paths',
  payload: unknown
): BaseToolInputV2;
export function parseToolInputV2(
  toolName: 'save_modernization_report_v2',
  payload: unknown
): SaveModernizationReportV2Input;
export function parseToolInputV2(
  toolName: ToolNameV2,
  payload: unknown
): ToolInputByNameV2[ToolNameV2] {
  return toolInputSchemasV2[toolName].parse(payload);
}

export function parseToolResultV2(
  toolName: 'discover_project_stack',
  payload: unknown
): DiscoverProjectStackResult;
export function parseToolResultV2(
  toolName: 'collect_environment_evidence',
  payload: unknown
): CollectEnvironmentEvidenceResult;
export function parseToolResultV2(
  toolName: 'inspect_framework_dependencies',
  payload: unknown
): InspectFrameworkDependenciesResult;
export function parseToolResultV2(
  toolName: 'inspect_platform_config',
  payload: unknown
): InspectPlatformConfigResult;
export function parseToolResultV2(
  toolName: 'inspect_source_risks',
  payload: unknown
): InspectSourceRisksResult;
export function parseToolResultV2(
  toolName: 'compare_upgrade_paths',
  payload: unknown
): CompareUpgradePathsResult;
export function parseToolResultV2(
  toolName: 'save_modernization_report_v2',
  payload: unknown
): SaveModernizationReportV2Result;
export function parseToolResultV2(
  toolName: ToolNameV2,
  payload: unknown
): ToolResultByNameV2[ToolNameV2] {
  return toolResultSchemasV2[toolName].parse(payload);
}

export function formatValidationErrors(result: { errors: ValidationIssue[] }): string {
  return result.errors
    .map((issue) => `${issue.path}: ${issue.message} [${issue.code}]`)
    .join('\n');
}

export function stringifyCanonicalJson(value: unknown): string {
  return `${JSON.stringify(sortJsonValue(value), null, 2)}\n`;
}

function sortJsonValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((entry) => sortJsonValue(entry));
  }

  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>).sort(([left], [right]) =>
      left.localeCompare(right)
    );

    return Object.fromEntries(
      entries.map(([key, nestedValue]) => [key, sortJsonValue(nestedValue)])
    );
  }

  return value;
}
