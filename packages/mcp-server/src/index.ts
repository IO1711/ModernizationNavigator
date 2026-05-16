import {
  COLLECT_RUNTIME_EVIDENCE,
  COMPARE_TARGET_PATHS,
  DISCOVER_REPO_SCOPE,
  INSPECT_DEPENDENCY_BLOCKERS,
  INSPECT_OPS_RUNTIME,
  INSPECT_SOURCE_COMPATIBILITY,
  OPEN_REPORT_VIEWER,
  SAVE_MODERNIZATION_REPORT,
  type BaseToolInput,
  type OpenReportViewerInput,
  type SaveModernizationReportInput
} from '@modernization-navigator/shared';

import { collectRuntimeEvidence } from './tools/collect-runtime-evidence';
import { compareTargetPaths } from './tools/compare-target-paths';
import { discoverRepoScope } from './tools/discover-repo-scope';
import { inspectDependencyBlockers } from './tools/inspect-dependency-blockers';
import { inspectOpsRuntime } from './tools/inspect-ops-runtime';
import { inspectSourceCompatibility } from './tools/inspect-source-compatibility';
import { openReportViewer } from './tools/open-report-viewer';
import { saveModernizationReport } from './tools/save-modernization-report';

type ToolDefinition = {
  name: string;
  description: string;
  handler: (input: unknown) => Promise<unknown>;
};

export const toolDefinitions: ToolDefinition[] = [
  {
    name: DISCOVER_REPO_SCOPE,
    description: 'Detects workspace scope, candidate projects, and package manager.',
    handler: (input) => discoverRepoScope(input as BaseToolInput)
  },
  {
    name: COLLECT_RUNTIME_EVIDENCE,
    description: 'Collects runtime-related evidence from repo files.',
    handler: (input) => collectRuntimeEvidence(input as BaseToolInput)
  },
  {
    name: INSPECT_DEPENDENCY_BLOCKERS,
    description: 'Inspects dependency compatibility blockers for the requested target.',
    handler: (input) => inspectDependencyBlockers(input as BaseToolInput)
  },
  {
    name: INSPECT_OPS_RUNTIME,
    description: 'Inspects CI, Docker, and deployment runtime mismatches.',
    handler: (input) => inspectOpsRuntime(input as BaseToolInput)
  },
  {
    name: INSPECT_SOURCE_COMPATIBILITY,
    description: 'Inspects source-level compatibility and module-system risk.',
    handler: (input) => inspectSourceCompatibility(input as BaseToolInput)
  },
  {
    name: COMPARE_TARGET_PATHS,
    description: 'Compares direct and staged target upgrade paths.',
    handler: (input) => compareTargetPaths(input as BaseToolInput)
  },
  {
    name: SAVE_MODERNIZATION_REPORT,
    description: 'Validates and persists the normalized modernization report.',
    handler: (input) => saveModernizationReport(input as SaveModernizationReportInput)
  },
  {
    name: OPEN_REPORT_VIEWER,
    description: 'Starts the local viewer server and opens the saved report.',
    handler: (input) => openReportViewer(input as OpenReportViewerInput)
  }
];

export function createServer(): { tools: ToolDefinition[] } {
  return {
    tools: toolDefinitions
  };
}

if (require.main === module) {
  console.error(
    'Starter scaffold ready: implement STDIO JSON-RPC MCP bootstrap in packages/mcp-server/src/index.ts.'
  );
}
