import fs from 'node:fs/promises';
import path from 'node:path';

import { TOOL_NAMES, TOOL_NAMES_V2 } from '@modernization-navigator/shared';

export const MCP_SERVER_NAME = 'modernization-navigator';
export const DEFAULT_MCP_COMMAND = 'modernization-navigator-mcp';
export const DEFAULT_ALWAYS_ALLOW_TOOLS = [...TOOL_NAMES, ...TOOL_NAMES_V2];

export interface McpServerConfig {
  command: string;
  args: string[];
  alwaysAllow: string[];
}

export interface BobMcpConfig {
  mcpServers: Record<string, McpServerConfig>;
}

export interface BuildMcpServerConfigOptions {
  command?: string;
  args?: string[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function buildMcpServerConfig(
  options: BuildMcpServerConfigOptions = {}
): McpServerConfig {
  return {
    command: options.command ?? DEFAULT_MCP_COMMAND,
    args: options.args ?? [],
    alwaysAllow: [...DEFAULT_ALWAYS_ALLOW_TOOLS]
  };
}

export function buildBobMcpConfig(
  existingConfig: Record<string, unknown> = {},
  options: BuildMcpServerConfigOptions = {}
): Record<string, unknown> & BobMcpConfig {
  const existingServers = isRecord(existingConfig.mcpServers)
    ? existingConfig.mcpServers
    : {};

  return {
    ...existingConfig,
    mcpServers: {
      ...existingServers,
      [MCP_SERVER_NAME]: buildMcpServerConfig(options)
    }
  };
}

export function resolveBobMcpConfigPath(repoRoot: string): string {
  return path.join(path.resolve(repoRoot), '.bob', 'mcp.json');
}

async function readExistingBobMcpConfig(
  configPath: string
): Promise<Record<string, unknown>> {
  try {
    const existingContent = await fs.readFile(configPath, 'utf8');
    const parsed = JSON.parse(existingContent) as unknown;

    if (!isRecord(parsed)) {
      throw new Error('Expected the root JSON value to be an object.');
    }

    return parsed;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return {};
    }

    if (error instanceof SyntaxError) {
      throw new Error(
        `Could not parse existing Bob MCP config at ${configPath}: ${error.message}`
      );
    }

    throw error;
  }
}

export async function writeBobMcpConfig(
  repoRoot: string,
  options: BuildMcpServerConfigOptions = {}
): Promise<{ configPath: string; config: Record<string, unknown> & BobMcpConfig }> {
  const configPath = resolveBobMcpConfigPath(repoRoot);
  const existingConfig = await readExistingBobMcpConfig(configPath);
  const config = buildBobMcpConfig(existingConfig, options);

  await fs.mkdir(path.dirname(configPath), { recursive: true });
  await fs.writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`, 'utf8');

  return { configPath, config };
}
