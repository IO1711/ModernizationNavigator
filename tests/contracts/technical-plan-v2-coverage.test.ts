import { describe, expect, test } from 'vitest';

import {
  TOOL_NAMES_V2,
  reportManifestEntryV2Schema,
  reportManifestV2Schema,
  reportV2Schema,
  toolInputSchemasV2,
  toolResultSchemasV2
} from '../../packages/shared/src';

describe('technical plan v2 contract coverage', () => {
  test('report v2 schema contains every required top-level field from the upgrade plan', () => {
    expect(reportV2Schema.keyof().options).toEqual([
      'reportVersion',
      'reportId',
      'createdAt',
      'repoRoot',
      'subdirectory',
      'stackProfile',
      'projectDescriptors',
      'requestedTargetVersion',
      'evaluatedTargetVersions',
      'offlineMode',
      'externalDataStatus',
      'toolTrace',
      'environmentEvidence',
      'issues',
      'bobDecision',
      'bobExecutionPlan',
      'validationChecklist'
    ]);
  });

  test('manifest v2 schemas expose the required report lookup fields', () => {
    expect(reportManifestV2Schema.keyof().options).toEqual(['latestReportPath', 'history']);
    expect(reportManifestEntryV2Schema.keyof().options).toEqual([
      'reportId',
      'createdAt',
      'reportPath',
      'ecosystem',
      'framework',
      'requestedTargetVersion',
      'subdirectory'
    ]);
  });

  test('tool registries cover every v2 tool promised in the upgrade plan', () => {
    expect(Object.keys(toolInputSchemasV2)).toEqual([...TOOL_NAMES_V2]);
    expect(Object.keys(toolResultSchemasV2)).toEqual([...TOOL_NAMES_V2]);
  });
});
