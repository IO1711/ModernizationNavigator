import { describe, expect, test } from 'vitest';

import {
  OPEN_REPORT_VIEWER,
  SAVE_MODERNIZATION_REPORT,
  TOOL_NAMES,
  toolInputSchemas,
  toolResultSchemas,
  validateToolInput,
  validateToolResult
} from '../../packages/shared/src';
import { loadJsonFixture } from './helpers';

describe('tool contract registry', () => {
  test('exports one input schema and one result schema for every canonical tool name', () => {
    expect(Object.keys(toolInputSchemas)).toEqual([...TOOL_NAMES]);
    expect(Object.keys(toolResultSchemas)).toEqual([...TOOL_NAMES]);
  });

  test('accepts the shared base tool input for the six repo-analysis tools', () => {
    const payload = loadJsonFixture('fixtures/contracts/tools/valid-base-tool-input.json');

    for (const toolName of TOOL_NAMES.slice(0, 6)) {
      const result = validateToolInput(toolName, payload);
      expect(result.success).toBe(true);
    }
  });

  test('accepts open_report_viewer input and rejects the invalid version', () => {
    const validPayload = loadJsonFixture(
      'fixtures/contracts/tools/valid-open-report-viewer-input.json'
    );
    const invalidPayload = loadJsonFixture(
      'fixtures/contracts/tools/invalid-open-report-viewer-input.json'
    );

    expect(validateToolInput(OPEN_REPORT_VIEWER, validPayload).success).toBe(true);
    expect(validateToolInput(OPEN_REPORT_VIEWER, invalidPayload).success).toBe(false);
  });

  test('accepts save_modernization_report input built from the valid report fixture', () => {
    const report = loadJsonFixture('fixtures/contracts/reports/valid-report.json');
    const result = validateToolInput(SAVE_MODERNIZATION_REPORT, { report });

    expect(result.success).toBe(true);
  });

  test('accepts the saved report result fixture and rejects an invalid compare result', () => {
    const validPayload = loadJsonFixture(
      'fixtures/contracts/tools/valid-save-modernization-report-result.json'
    );
    const invalidPayload = loadJsonFixture(
      'fixtures/contracts/tools/invalid-compare-target-paths-result.json'
    );

    expect(validateToolResult(SAVE_MODERNIZATION_REPORT, validPayload).success).toBe(true);
    expect(validateToolResult('compare_target_paths', invalidPayload).success).toBe(false);
  });
});
