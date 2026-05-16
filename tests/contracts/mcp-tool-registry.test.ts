import { describe, expect, test } from 'vitest';

import {
  TOOL_NAMES,
  TOOL_NAMES_V2
} from '../../packages/shared/src';
import { toolDefinitions } from '../../packages/mcp-server/src/index';

describe('mcp tool registry', () => {
  test('keeps the v1 tool names intact while registering the parallel v2 lane', () => {
    const toolNames = toolDefinitions.map((tool) => tool.name);

    expect(toolNames.slice(0, TOOL_NAMES.length)).toEqual([...TOOL_NAMES]);

    for (const toolName of TOOL_NAMES_V2) {
      expect(toolNames).toContain(toolName);
    }
  });
});
