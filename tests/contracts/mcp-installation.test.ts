import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import YAML from 'yaml';

import { afterEach, describe, expect, test } from 'vitest';

import {
  buildBobMcpConfig,
  buildBobCustomModesConfig,
  DEFAULT_ALWAYS_ALLOW_TOOLS,
  DEFAULT_MCP_COMMAND,
  MCP_SERVER_NAME,
  setupBobRepository
} from '../../packages/mcp-server/src/install-config';
import {
  modernizationArchitectMode,
  modernizationArchitectRoleMarkdown,
  modernizationArchitectWorkflowMarkdown,
  MODERNIZATION_ARCHITECT_RULES_DIR
} from '../../packages/mcp-server/src/bob-mode';
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

  test('merges the modernization mode into an existing Bob custom modes file', () => {
    const config = buildBobCustomModesConfig({
      customModes: [
        {
          slug: 'existing-mode',
          name: 'Existing Mode',
          roleDefinition: 'Keep me',
          whenToUse: 'Keep me',
          customInstructions: 'Keep me',
          groups: ['read']
        }
      ]
    });

    expect(config.customModes).toEqual([
      {
        slug: 'existing-mode',
        name: 'Existing Mode',
        roleDefinition: 'Keep me',
        whenToUse: 'Keep me',
        customInstructions: 'Keep me',
        groups: ['read']
      },
      modernizationArchitectMode
    ]);
  });

  test('writes the Bob MCP config, custom mode, and rule files into the target repo', async () => {
    const repoRoot = await createTempRepo();
    const existingConfigPath = path.join(repoRoot, '.bob', 'mcp.json');
    const existingModesPath = path.join(repoRoot, '.bob', 'custom_modes.yaml');

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
    await fs.writeFile(
      existingModesPath,
      YAML.stringify({
        customModes: [
          {
            slug: 'existing-mode',
            name: 'Existing Mode',
            roleDefinition: 'Keep me',
            whenToUse: 'Keep me',
            customInstructions: 'Keep me',
            groups: ['read']
          }
        ]
      }),
      'utf8'
    );

    const result = await setupBobRepository(repoRoot);
    const written = JSON.parse(
      await fs.readFile(result.mcpConfigPath, 'utf8')
    ) as {
      mcpServers: Record<string, { command: string; args: string[]; alwaysAllow: string[] }>;
    };
    const writtenModes = YAML.parse(
      await fs.readFile(result.customModesPath, 'utf8')
    ) as {
      customModes: Array<{ slug: string }>;
    };
    const roleFile = await fs.readFile(
      path.join(result.rulesDirectoryPath, '01-role.md'),
      'utf8'
    );
    const workflowFile = await fs.readFile(
      path.join(result.rulesDirectoryPath, '02-workflow.md'),
      'utf8'
    );

    expect(written.mcpServers.existing?.command).toBe('keep-me');
    expect(written.mcpServers[MCP_SERVER_NAME]).toEqual({
      command: DEFAULT_MCP_COMMAND,
      args: [],
      alwaysAllow: DEFAULT_ALWAYS_ALLOW_TOOLS
    });
    expect(writtenModes.customModes.map((mode) => mode.slug)).toEqual([
      'existing-mode',
      modernizationArchitectMode.slug
    ]);
    expect(roleFile).toBe(modernizationArchitectRoleMarkdown);
    expect(workflowFile).toBe(modernizationArchitectWorkflowMarkdown);
    expect(result.rulesDirectoryPath).toBe(
      path.join(repoRoot, '.bob', MODERNIZATION_ARCHITECT_RULES_DIR)
    );
  });
});
