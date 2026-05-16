import { describe, expect, test } from 'vitest';

import {
  formatValidationErrors,
  parseReport,
  stringifyCanonicalJson,
  validateReport
} from '../../packages/shared/src';
import { loadJsonFixture, loadTextFixture } from './helpers';

describe('reportSchema', () => {
  test('accepts the canonical valid report fixture', () => {
    const payload = loadJsonFixture('fixtures/contracts/reports/valid-report.json');
    const parsed = parseReport(payload);

    expect(parsed.reportId).toBe('contract-20260516T110000Z');
    expect(parsed.toolTrace).toHaveLength(3);
  });

  test('accepts the backward-compatible report fixture without subdirectory', () => {
    const payload = loadJsonFixture(
      'fixtures/contracts/reports/backward-compatible-report.json'
    );
    const result = validateReport(payload);

    expect(result.success).toBe(true);
  });

  test('rejects the intentionally partial report fixture', () => {
    const payload = loadJsonFixture('fixtures/contracts/reports/partial-report.json');
    const result = validateReport(payload);

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(formatValidationErrors(result)).toContain('bobDecision');
      expect(formatValidationErrors(result)).toContain('bobExecutionPlan');
    }
  });

  test('rejects the intentionally invalid report fixture', () => {
    const payload = loadJsonFixture('fixtures/contracts/reports/invalid-report.json');
    const result = validateReport(payload);

    expect(result.success).toBe(false);

    if (!result.success) {
      const errors = formatValidationErrors(result);
      expect(errors).toContain('reportId');
      expect(errors).toContain('toolTrace.0.toolName');
      expect(errors).toContain('unexpectedField');
    }
  });

  test('serializes the canonical report shape deterministically', () => {
    const payload = loadJsonFixture('fixtures/contracts/reports/valid-report.json');
    const snapshot = loadTextFixture('snapshots/contracts/valid-report.snapshot.json');

    expect(stringifyCanonicalJson(payload)).toBe(snapshot);
  });
});
