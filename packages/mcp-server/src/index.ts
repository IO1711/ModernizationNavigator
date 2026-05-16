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
import path from 'node:path';

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema
} from '@modelcontextprotocol/sdk/types.js';
import type { ZodTypeAny } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';

import {
  COLLECT_ENVIRONMENT_EVIDENCE,
  COLLECT_RUNTIME_EVIDENCE,
  COMPARE_UPGRADE_PATHS,
  COMPARE_TARGET_PATHS,
  DISCOVER_PROJECT_STACK,
  DISCOVER_REPO_SCOPE,
  INSPECT_FRAMEWORK_DEPENDENCIES,
  INSPECT_DEPENDENCY_BLOCKERS,
  INSPECT_OPS_RUNTIME,
  INSPECT_PLATFORM_CONFIG,
  INSPECT_SOURCE_RISKS,
  INSPECT_SOURCE_COMPATIBILITY,
  OPEN_REPORT_VIEWER,
  SAVE_MODERNIZATION_REPORT_V2,
  SAVE_MODERNIZATION_REPORT,
  type BaseToolInputV2,
  baseToolInputSchema,
  baseToolInputV2Schema,
  type SaveModernizationReportV2Input,
  openReportViewerInputSchema,
  saveModernizationReportV2InputSchema,
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
import { collectEnvironmentEvidenceTool } from './tools-v2/collect-environment-evidence';
import { compareUpgradePathsTool } from './tools-v2/compare-upgrade-paths';
import { discoverProjectStackTool } from './tools-v2/discover-project-stack';
import { inspectFrameworkDependenciesTool } from './tools-v2/inspect-framework-dependencies';
import { inspectPlatformConfigTool } from './tools-v2/inspect-platform-config';
import { inspectSourceRisksTool } from './tools-v2/inspect-source-risks';
import { saveModernizationReportV2 } from './tools-v2/save-modernization-report-v2';
import {
  buildBobMcpConfig,
  DEFAULT_MCP_COMMAND,
  resolveBobMcpConfigPath,
  writeBobMcpConfig
} from './install-config';

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
  },
  {
    name: DISCOVER_PROJECT_STACK,
    description:
      'Detect supported project stacks and framework descriptors across the repo or selected subdirectory.',
    inputSchema: baseToolInputV2Schema,
    handler: (input) => discoverProjectStackTool(input as BaseToolInputV2)
  },
  {
    name: COLLECT_ENVIRONMENT_EVIDENCE,
    description:
      'Collect framework-aware environment evidence such as runtime declarations, package manager signals, and build system markers.',
    inputSchema: baseToolInputV2Schema,
    handler: (input) => collectEnvironmentEvidenceTool(input as BaseToolInputV2)
  },
  {
    name: INSPECT_FRAMEWORK_DEPENDENCIES,
    description:
      'Inspect dependency compatibility with framework-specific checks layered on top of ecosystem analysis.',
    inputSchema: baseToolInputV2Schema,
    handler: (input) => inspectFrameworkDependenciesTool(input as BaseToolInputV2)
  },
  {
    name: INSPECT_PLATFORM_CONFIG,
    description:
      'Inspect CI, Docker, deployment, and platform configuration for framework-aware upgrade drift.',
    inputSchema: baseToolInputV2Schema,
    handler: (input) => inspectPlatformConfigTool(input as BaseToolInputV2)
  },
  {
    name: INSPECT_SOURCE_RISKS,
    description:
      'Inspect source compatibility risks using the selected framework adapter and ecosystem-specific scanners.',
    inputSchema: baseToolInputV2Schema,
    handler: (input) => inspectSourceRisksTool(input as BaseToolInputV2)
  },
  {
    name: COMPARE_UPGRADE_PATHS,
    description:
      'Compare direct and staged upgrade paths using the framework-aware v2 analysis lane.',
    inputSchema: baseToolInputV2Schema,
    handler: (input) => compareUpgradePathsTool(input as BaseToolInputV2)
  },
  {
    name: SAVE_MODERNIZATION_REPORT_V2,
    description:
      'Validate and persist the v2 modernization report to the parallel report-v2 history and manifest paths.',
    inputSchema: saveModernizationReportV2InputSchema,
    handler: (input) => saveModernizationReportV2(input as SaveModernizationReportV2Input)
  }
];

const toolsByName = new Map(toolDefinitions.map((t) => [t.name, t]));

type CliOptions = {
  args: string[];
  command: string;
  repoRoot: string;
  dryRun: boolean;
};

function printCliHelp(executableName: string): void {
  console.log(`Usage:
  ${executableName}                     Start the MCP server over stdio
  ${executableName} serve               Start the MCP server over stdio
  ${executableName} setup [options]     Write .bob/mcp.json for a repo
  ${executableName} print-config        Print a reusable .bob/mcp.json payload

Options for setup / print-config:
  --repo, -r <path>       Repo root to configure (default: current directory)
  --command, -c <name>    Command Bob should launch (default: ${DEFAULT_MCP_COMMAND})
  --arg <value>           Extra command arg, repeatable
  --dry-run               Show the generated config without writing it
  --help, -h              Show this help message`);
}

function parseCliOptions(argv: string[]): CliOptions {
  const options: CliOptions = {
    args: [],
    command: DEFAULT_MCP_COMMAND,
    repoRoot: process.cwd(),
    dryRun: false
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === '--repo' || arg === '-r') {
      options.repoRoot = argv[index + 1] ?? '';
      index += 1;
      continue;
    }

    if (arg === '--command' || arg === '-c') {
      options.command = argv[index + 1] ?? '';
      index += 1;
      continue;
    }

    if (arg === '--arg') {
      options.args.push(argv[index + 1] ?? '');
      index += 1;
      continue;
    }

    if (arg === '--dry-run') {
      options.dryRun = true;
      continue;
    }

    if (arg === '--help' || arg === '-h') {
      throw new Error('help');
    }

    throw new Error(`Unknown option: ${arg}`);
  }

  if (!options.repoRoot) {
    throw new Error('Missing value for --repo.');
  }

  if (!options.command) {
    throw new Error('Missing value for --command.');
  }

  if (options.args.some((arg) => !arg)) {
    throw new Error('Missing value for --arg.');
  }

  return options;
}

async function runSetupCommand(argv: string[]): Promise<void> {
  const options = parseCliOptions(argv);
  const generatedConfig = buildBobMcpConfig({}, {
    command: options.command,
    args: options.args
  });

  if (options.dryRun) {
    console.log(
      JSON.stringify(
        {
          configPath: resolveBobMcpConfigPath(options.repoRoot),
          config: generatedConfig
        },
        null,
        2
      )
    );
    return;
  }

  const result = await writeBobMcpConfig(options.repoRoot, {
    command: options.command,
    args: options.args
  });

  console.log(`Wrote ${result.configPath}`);
}

function runPrintConfigCommand(argv: string[]): void {
  const options = parseCliOptions(argv);
  const generatedConfig = buildBobMcpConfig({}, {
    command: options.command,
    args: options.args
  });

  console.log(JSON.stringify(generatedConfig, null, 2));
}

async function runCliEntryPoint(): Promise<void> {
  const executableName = path.basename(process.argv[1] ?? DEFAULT_MCP_COMMAND);
  const argv = process.argv.slice(2);
  const invokedAsSetupCommand = executableName === 'modernization-navigator-mcp-setup';

  const command =
    invokedAsSetupCommand && (argv.length === 0 || argv[0]?.startsWith('-'))
      ? 'setup'
      : argv[0];
  const commandArgs =
    invokedAsSetupCommand && (argv.length === 0 || argv[0]?.startsWith('-'))
      ? argv
      : argv.slice(1);

  if (!command || command === 'serve') {
    await main();
    return;
  }

  if (command === 'setup') {
    await runSetupCommand(commandArgs);
    return;
  }

  if (command === 'print-config') {
    runPrintConfigCommand(commandArgs);
    return;
  }

  if (command === '--help' || command === '-h' || command === 'help') {
    printCliHelp(executableName);
    return;
  }

  throw new Error(`Unknown command: ${command}`);
}

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
  runCliEntryPoint().catch((error) => {
    if (error instanceof Error && error.message === 'help') {
      printCliHelp(path.basename(process.argv[1] ?? DEFAULT_MCP_COMMAND));
      process.exit(0);
    }

    console.error('[modernization-navigator] fatal:', error);
    process.exit(1);
  });
}
