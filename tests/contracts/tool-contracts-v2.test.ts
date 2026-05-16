import { describe, expect, test } from 'vitest';

import {
  SAVE_MODERNIZATION_REPORT_V2,
  TOOL_NAMES_V2,
  toolInputSchemasV2,
  toolResultSchemasV2,
  validateToolInputV2,
  validateToolResultV2
} from '../../packages/shared/src';
import { loadJsonFixture } from './helpers';

describe('tool contract registry v2', () => {
  test('exports one input schema and one result schema for every v2 tool name', () => {
    expect(Object.keys(toolInputSchemasV2)).toEqual([...TOOL_NAMES_V2]);
    expect(Object.keys(toolResultSchemasV2)).toEqual([...TOOL_NAMES_V2]);
  });

  test('accepts the shared base v2 tool input for the six analysis tools', () => {
    const payload = loadJsonFixture('fixtures/contracts/tools/valid-base-tool-input-v2.json');

    for (const toolName of TOOL_NAMES_V2.slice(0, 6)) {
      const result = validateToolInputV2(toolName, payload);
      expect(result.success).toBe(true);
    }
  });

  test('accepts save_modernization_report_v2 input built from the valid v2 report fixture', () => {
    const report = loadJsonFixture('fixtures/contracts/reports/valid-report-v2.json');
    const result = validateToolInputV2(SAVE_MODERNIZATION_REPORT_V2, { report });

    expect(result.success).toBe(true);
  });

  test('accepts the saved v2 report result fixture', () => {
    const payload = loadJsonFixture(
      'fixtures/contracts/tools/valid-save-modernization-report-v2-result.json'
    );

    expect(validateToolResultV2(SAVE_MODERNIZATION_REPORT_V2, payload).success).toBe(true);
  });
});
