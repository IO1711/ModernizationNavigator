import type { ZodError, ZodType } from 'zod';

import { reportManifestSchema } from '../schemas/manifest';
import { reportSchema } from '../schemas/report';
import { toolInputSchemas, toolResultSchemas } from '../schemas/tool-results';
import type { Report, ReportManifest } from '../types/report';
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
