import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, test } from 'vitest';
import YAML from 'yaml';

import {
  buildBobCustomModesConfig
} from '../../packages/mcp-server/src/install-config';
import {
  modernizationArchitectRoleMarkdown,
  modernizationArchitectWorkflowMarkdown
} from '../../packages/mcp-server/src/bob-mode';

function readFile(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');
}

describe('Bob modernization mode config', () => {
  test('checked-in Bob rule files stay in sync with the generated rule markdown', () => {
    expect(readFile('.bob/rules-modernization-architect/01-role.md')).toBe(
      modernizationArchitectRoleMarkdown
    );
    expect(readFile('.bob/rules-modernization-architect/02-workflow.md')).toBe(
      modernizationArchitectWorkflowMarkdown
    );
  });

  test('workflow requires stack discovery before version-specific questions', () => {
    const workflow = modernizationArchitectWorkflowMarkdown;

    expect(workflow).toContain('Start with `discover_project_stack` before asking version-specific questions.');
    expect(workflow.indexOf('discover_project_stack')).toBeLessThan(
      workflow.indexOf('targetNodeVersion')
    );
    expect(workflow).toContain(
      'If the request is generic and the detected framework is React, ask whether the user wants a Node runtime upgrade, a React/framework/tooling upgrade, or both.'
    );
    expect(workflow).toContain(
      'Call `open_report_viewer` for saved v2 reports after saving them and include `repoRoot` when available.'
    );
  });

  test('custom mode metadata describes stack-first behavior', () => {
    const yamlText = readFile('.bob/custom_modes.yaml');
    const parsed = YAML.parse(yamlText) as Record<string, unknown>;
    const generated = buildBobCustomModesConfig();

    expect(parsed).toEqual(generated);

    const customModes = generated.customModes as Array<Record<string, unknown>>;
    const modernizationMode = customModes.find(
      (mode) => mode.slug === 'modernization-architect'
    );

    expect(modernizationMode?.roleDefinition).toContain('detect the current stack first');
    expect(modernizationMode?.whenToUse).toContain('React framework/toolchain analysis');
  });
});
