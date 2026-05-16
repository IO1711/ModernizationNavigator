import { describe, expect, test } from 'vitest';

import {
  parseReportV2,
  validateReportV2
} from '../../packages/shared/src';
import { loadJsonFixture } from './helpers';

describe('reportV2Schema', () => {
  test('accepts the canonical valid v2 report fixture', () => {
    const payload = loadJsonFixture('fixtures/contracts/reports/valid-report-v2.json');
    const parsed = parseReportV2(payload);

    expect(parsed.reportVersion).toBe('v2');
    expect(parsed.stackProfile.framework).toBe('react');
    expect(parsed.projectDescriptors).toHaveLength(1);
  });

  test('rejects a v1 report when validated against the v2 schema', () => {
    const payload = loadJsonFixture('fixtures/contracts/reports/valid-report.json');
    const result = validateReportV2(payload);

    expect(result.success).toBe(false);
  });
});
