import { describe, expect, test } from 'vitest';

import {
  TOOL_NAMES,
  reportManifestEntrySchema,
  reportManifestSchema,
  reportSchema,
  toolInputSchemas,
  toolResultSchemas
} from '../../packages/shared/src';

describe('technical plan contract coverage', () => {
  test('report schema contains every required top-level field from the plan', () => {
    expect(reportSchema.keyof().options).toEqual([
      'reportId',
      'createdAt',
      'repoRoot',
      'subdirectory',
      'requestedTargetNodeVersion',
      'evaluatedTargetNodeVersions',
      'detectedPackageManager',
      'offlineMode',
      'externalDataStatus',
      'toolTrace',
      'runtimeEvidence',
      'issues',
      'bobDecision',
      'bobExecutionPlan',
      'validationChecklist'
    ]);
  });

  test('manifest schemas expose the required viewer lookup fields', () => {
    expect(reportManifestSchema.keyof().options).toEqual(['latestReportPath', 'history']);
    expect(reportManifestEntrySchema.keyof().options).toEqual([
      'reportId',
      'createdAt',
      'reportPath',
      'requestedTargetNodeVersion',
      'subdirectory'
    ]);
  });

  test('tool registries cover every tool promised in the technical plan', () => {
    expect(Object.keys(toolInputSchemas)).toEqual([...TOOL_NAMES]);
    expect(Object.keys(toolResultSchemas)).toEqual([...TOOL_NAMES]);
  });
});
