import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, test } from 'vitest';

import {
  buildBobMcpConfig,
  DEFAULT_ALWAYS_ALLOW_TOOLS,
  DEFAULT_MCP_COMMAND,
  MCP_SERVER_NAME,
  writeBobMcpConfig
} from '../../packages/mcp-server/src/install-config';
import { toolDefinitions } from '../../packages/mcp-server/src/index';

const tempDirs: string[] = [];

async function createTempRepo(): Promise<string> {
  const tempDir = await fs.mkdtemp(
    path.join(os.tmpdir(), 'modernization-navigator-mcp-')
  );
  tempDirs.push(tempDir);
  return tempDir;
}

afterEach(async () => {
  await Promise.all(
    tempDirs.splice(0).map((tempDir) =>
      fs.rm(tempDir, { recursive: true, force: true })
    )
  );
});

describe('mcp installation config', () => {
  test('keeps the generated alwaysAllow list aligned with the tool registry', () => {
    expect(DEFAULT_ALWAYS_ALLOW_TOOLS).toEqual(
      toolDefinitions.map((tool) => tool.name)
    );
  });

  test('merges the modernization server into an existing Bob config', () => {
    const config = buildBobMcpConfig(
      {
        mcpServers: {
          existing: {
            command: 'existing-command',
            args: ['--flag'],
            alwaysAllow: ['existing_tool']
          }
        }
      },
      {
        command: 'custom-modernization-command',
        args: ['--stdio']
      }
    );

    expect(config.mcpServers.existing).toEqual({
      command: 'existing-command',
      args: ['--flag'],
      alwaysAllow: ['existing_tool']
    });
    expect(config.mcpServers[MCP_SERVER_NAME]).toEqual({
      command: 'custom-modernization-command',
      args: ['--stdio'],
      alwaysAllow: DEFAULT_ALWAYS_ALLOW_TOOLS
    });
  });

  test('writes a portable .bob/mcp.json file into the target repo', async () => {
    const repoRoot = await createTempRepo();
    const existingConfigPath = path.join(repoRoot, '.bob', 'mcp.json');

    await fs.mkdir(path.dirname(existingConfigPath), { recursive: true });
    await fs.writeFile(
      existingConfigPath,
      JSON.stringify(
        {
          mcpServers: {
            existing: {
              command: 'keep-me',
              args: [],
              alwaysAllow: ['other_tool']
            }
          }
        },
        null,
        2
      ),
      'utf8'
    );

    const result = await writeBobMcpConfig(repoRoot);
    const written = JSON.parse(
      await fs.readFile(result.configPath, 'utf8')
    ) as {
      mcpServers: Record<string, { command: string; args: string[]; alwaysAllow: string[] }>;
    };

    expect(written.mcpServers.existing?.command).toBe('keep-me');
    expect(written.mcpServers[MCP_SERVER_NAME]).toEqual({
      command: DEFAULT_MCP_COMMAND,
      args: [],
      alwaysAllow: DEFAULT_ALWAYS_ALLOW_TOOLS
    });
  });
});
