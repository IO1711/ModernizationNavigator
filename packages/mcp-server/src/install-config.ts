import fs from 'node:fs/promises';
import path from 'node:path';
import YAML from 'yaml';

import { TOOL_NAMES, TOOL_NAMES_V2 } from '@modernization-navigator/shared';
import {
  modernizationArchitectMode,
  modernizationArchitectRoleMarkdown,
  modernizationArchitectWorkflowMarkdown,
  MODERNIZATION_ARCHITECT_MODE_SLUG,
  MODERNIZATION_ARCHITECT_RULES_DIR
} from './bob-mode';

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

export interface BobCustomModeConfig {
  customModes: Array<Record<string, unknown>>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isCustomModeArray(
  value: unknown
): value is Array<Record<string, unknown>> {
  return Array.isArray(value) && value.every((item) => isRecord(item));
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

export function resolveBobCustomModesPath(repoRoot: string): string {
  return path.join(path.resolve(repoRoot), '.bob', 'custom_modes.yaml');
}

export function resolveBobRulesDirectory(repoRoot: string): string {
  return path.join(
    path.resolve(repoRoot),
    '.bob',
    MODERNIZATION_ARCHITECT_RULES_DIR
  );
}

async function ensureRepoRootExists(repoRoot: string): Promise<string> {
  const resolvedRepoRoot = path.resolve(repoRoot);

  try {
    const stats = await fs.stat(resolvedRepoRoot);

    if (!stats.isDirectory()) {
      throw new Error(
        `Repo root must be a directory: ${resolvedRepoRoot}`
      );
    }

    return resolvedRepoRoot;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      throw new Error(
        `Repo root does not exist: ${resolvedRepoRoot}. Replace placeholder paths like /path/to/any/repo with the real project path.`
      );
    }

    throw error;
  }
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

async function readExistingCustomModesConfig(
  configPath: string
): Promise<Record<string, unknown>> {
  try {
    const existingContent = await fs.readFile(configPath, 'utf8');
    const parsed = YAML.parse(existingContent) as unknown;

    if (parsed == null) {
      return {};
    }

    if (!isRecord(parsed)) {
      throw new Error('Expected the root YAML value to be an object.');
    }

    return parsed;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return {};
    }

    if (error instanceof Error) {
      throw new Error(
        `Could not parse existing Bob custom modes config at ${configPath}: ${error.message}`
      );
    }

    throw error;
  }
}

export function buildBobCustomModesConfig(
  existingConfig: Record<string, unknown> = {}
): Record<string, unknown> & BobCustomModeConfig {
  const existingModes = isCustomModeArray(existingConfig.customModes)
    ? existingConfig.customModes
    : [];

  return {
    ...existingConfig,
    customModes: [
      ...existingModes.filter(
        (mode) => mode.slug !== MODERNIZATION_ARCHITECT_MODE_SLUG
      ),
      modernizationArchitectMode
    ]
  };
}

export async function writeBobCustomModesConfig(
  repoRoot: string
): Promise<{ configPath: string; config: Record<string, unknown> & BobCustomModeConfig }> {
  const configPath = resolveBobCustomModesPath(repoRoot);
  const existingConfig = await readExistingCustomModesConfig(configPath);
  const config = buildBobCustomModesConfig(existingConfig);

  await fs.mkdir(path.dirname(configPath), { recursive: true });
  await fs.writeFile(configPath, YAML.stringify(config), 'utf8');

  return { configPath, config };
}

export async function writeBobModeRuleFiles(
  repoRoot: string
): Promise<{ rulesDirectoryPath: string }> {
  const rulesDirectoryPath = resolveBobRulesDirectory(repoRoot);

  await fs.mkdir(rulesDirectoryPath, { recursive: true });
  await fs.writeFile(
    path.join(rulesDirectoryPath, '01-role.md'),
    modernizationArchitectRoleMarkdown,
    'utf8'
  );
  await fs.writeFile(
    path.join(rulesDirectoryPath, '02-workflow.md'),
    modernizationArchitectWorkflowMarkdown,
    'utf8'
  );

  return { rulesDirectoryPath };
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

export async function setupBobRepository(
  repoRoot: string,
  options: BuildMcpServerConfigOptions = {}
): Promise<{
  repoRoot: string;
  mcpConfigPath: string;
  customModesPath: string;
  rulesDirectoryPath: string;
}> {
  const resolvedRepoRoot = await ensureRepoRootExists(repoRoot);
  const mcpConfigResult = await writeBobMcpConfig(resolvedRepoRoot, options);
  const customModesResult =
    await writeBobCustomModesConfig(resolvedRepoRoot);
  const rulesResult = await writeBobModeRuleFiles(resolvedRepoRoot);

  return {
    repoRoot: resolvedRepoRoot,
    mcpConfigPath: mcpConfigResult.configPath,
    customModesPath: customModesResult.configPath,
    rulesDirectoryPath: rulesResult.rulesDirectoryPath
  };
}
