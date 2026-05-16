#!/usr/bin/env node
/**
 * MCP server entry point.
 *
 * Speaks JSON-RPC 2.0 over STDIO. Bob (the Claude agent) launches this
 * process via `.bob/mcp.json` and communicates by writing JSON-RPC
 * requests to our stdin and reading responses from our stdout.
 *
 * STRICT RULE: nothing must ever be written to stdout except the
 * JSON-RPC frames the SDK emits. All logging goes to stderr.
 */
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema
} from '@modelcontextprotocol/sdk/types.js';
import type { ZodTypeAny } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';

import {
  COLLECT_RUNTIME_EVIDENCE,
  COMPARE_TARGET_PATHS,
  DISCOVER_REPO_SCOPE,
  INSPECT_DEPENDENCY_BLOCKERS,
  INSPECT_OPS_RUNTIME,
  INSPECT_SOURCE_COMPATIBILITY,
  OPEN_REPORT_VIEWER,
  SAVE_MODERNIZATION_REPORT,
  baseToolInputSchema,
  openReportViewerInputSchema,
  saveModernizationReportInputSchema,
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
  inputSchema: ZodTypeAny;
  handler: (input: unknown) => Promise<unknown>;
};

export const toolDefinitions: ToolDefinition[] = [
  {
    name: DISCOVER_REPO_SCOPE,
    description:
      'Detect workspace scope, candidate projects, and package manager. Call this first.',
    inputSchema: baseToolInputSchema,
    handler: (input) => discoverRepoScope(input as BaseToolInput)
  },
  {
    name: COLLECT_RUNTIME_EVIDENCE,
    description:
      'Collect runtime-related evidence (Node version pins, package manager, CI, Docker) from repo files.',
    inputSchema: baseToolInputSchema,
    handler: (input) => collectRuntimeEvidence(input as BaseToolInput)
  },
  {
    name: INSPECT_DEPENDENCY_BLOCKERS,
    description:
      'Inspect direct dependencies for compatibility blockers against the requested target Node version.',
    inputSchema: baseToolInputSchema,
    handler: (input) => inspectDependencyBlockers(input as BaseToolInput)
  },
  {
    name: INSPECT_OPS_RUNTIME,
    description:
      'Inspect CI workflows, Dockerfiles, and deployment configuration for runtime mismatches.',
    inputSchema: baseToolInputSchema,
    handler: (input) => inspectOpsRuntime(input as BaseToolInput)
  },
  {
    name: INSPECT_SOURCE_COMPATIBILITY,
    description:
      'Inspect source code (via ts-morph) for deprecated Node APIs and module-system risk.',
    inputSchema: baseToolInputSchema,
    handler: (input) => inspectSourceCompatibility(input as BaseToolInput)
  },
  {
    name: COMPARE_TARGET_PATHS,
    description:
      'Score direct vs staged upgrade paths by risk and effort. Call only when both paths are plausible.',
    inputSchema: baseToolInputSchema,
    handler: (input) => compareTargetPaths(input as BaseToolInput)
  },
  {
    name: SAVE_MODERNIZATION_REPORT,
    description:
      'Validate and persist the final normalized report to reports/latest, reports/history, and the manifest.',
    inputSchema: saveModernizationReportInputSchema,
    handler: (input) => saveModernizationReport(input as SaveModernizationReportInput)
  },
  {
    name: OPEN_REPORT_VIEWER,
    description:
      'Start the local viewer server (if needed) and open the saved report in the browser.',
    inputSchema: openReportViewerInputSchema,
    handler: (input) => openReportViewer(input as OpenReportViewerInput)
  }
];

const toolsByName = new Map(toolDefinitions.map((t) => [t.name, t]));

export function createServer(): Server {
  const server = new Server(
    { name: 'modernization-navigator', version: '0.1.0' },
    { capabilities: { tools: {} } }
  );

  // tools/list — Bob asks "what tools do you have?"
  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: toolDefinitions.map((tool) => ({
      name: tool.name,
      description: tool.description,
      inputSchema: zodToJsonSchema(tool.inputSchema as never, {
        $refStrategy: 'none',
        target: 'jsonSchema7'
      }) as unknown as Record<string, unknown>
    }))
  }));

  // tools/call — Bob asks "please run this tool with these args"
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    const tool = toolsByName.get(name);

    if (!tool) {
      return {
        isError: true,
        content: [{ type: 'text', text: `Unknown tool: ${name}` }]
      };
    }

    try {
      const result = await tool.handler(args ?? {});
      return {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }]
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        isError: true,
        content: [{ type: 'text', text: `Tool ${name} failed: ${message}` }]
      };
    }
  });

  return server;
}

async function main(): Promise<void> {
  const server = createServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  // Logs MUST go to stderr — stdout is the JSON-RPC channel.
  console.error('[modernization-navigator] MCP server ready (stdio).');
}

if (require.main === module) {
  main().catch((error) => {
    console.error('[modernization-navigator] fatal:', error);
    process.exit(1);
  });
}
