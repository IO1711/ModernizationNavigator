export const DISCOVER_REPO_SCOPE = 'discover_repo_scope';
export const COLLECT_RUNTIME_EVIDENCE = 'collect_runtime_evidence';
export const INSPECT_DEPENDENCY_BLOCKERS = 'inspect_dependency_blockers';
export const INSPECT_OPS_RUNTIME = 'inspect_ops_runtime';
export const INSPECT_SOURCE_COMPATIBILITY = 'inspect_source_compatibility';
export const COMPARE_TARGET_PATHS = 'compare_target_paths';
export const SAVE_MODERNIZATION_REPORT = 'save_modernization_report';
export const OPEN_REPORT_VIEWER = 'open_report_viewer';

export const TOOL_NAMES = [
  DISCOVER_REPO_SCOPE,
  COLLECT_RUNTIME_EVIDENCE,
  INSPECT_DEPENDENCY_BLOCKERS,
  INSPECT_OPS_RUNTIME,
  INSPECT_SOURCE_COMPATIBILITY,
  COMPARE_TARGET_PATHS,
  SAVE_MODERNIZATION_REPORT,
  OPEN_REPORT_VIEWER
] as const;
