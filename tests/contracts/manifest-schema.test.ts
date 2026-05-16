import { describe, expect, test } from 'vitest';

import {
  formatValidationErrors,
  parseManifest,
  stringifyCanonicalJson,
  validateManifest
} from '../../packages/shared/src';
import { loadJsonFixture, loadTextFixture } from './helpers';

describe('reportManifestSchema', () => {
  test('accepts the valid manifest fixture', () => {
    const payload = loadJsonFixture('fixtures/contracts/manifests/valid-manifest.json');
    const parsed = parseManifest(payload);

    expect(parsed.history).toHaveLength(2);
    expect(parsed.latestReportPath).toBe('reports/latest/report.json');
  });

  test('rejects the malformed manifest fixture', () => {
    const payload = loadJsonFixture('fixtures/contracts/manifests/malformed-manifest.json');
    const result = validateManifest(payload);

    expect(result.success).toBe(false);

    if (!result.success) {
      const errors = formatValidationErrors(result);
      expect(errors).toContain('latestReportPath');
      expect(errors).toContain('history.0.reportId');
      expect(errors).toContain('extra');
    }
  });

  test('serializes the canonical manifest shape deterministically', () => {
    const payload = loadJsonFixture('fixtures/contracts/manifests/valid-manifest.json');
    const snapshot = loadTextFixture('snapshots/contracts/valid-manifest.snapshot.json');

    expect(stringifyCanonicalJson(payload)).toBe(snapshot);
  });
});
