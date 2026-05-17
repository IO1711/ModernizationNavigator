import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, test } from 'vitest';

import type { Report, ReportV2 } from '../../packages/shared/src';
import {
  updateReportManifest,
  updateReportManifestV2,
  writeHistoryReport,
  writeHistoryReportV2,
  writeLatestReport,
  writeLatestReportV2
} from '../../packages/mcp-server/src/report-writer';
import { loadJsonFixture } from './helpers';

const tempDirs: string[] = [];

async function createTempRepo(): Promise<string> {
  const repoRoot = await fs.mkdtemp(
    path.join(os.tmpdir(), 'modernization-navigator-report-writer-')
  );
  tempDirs.push(repoRoot);
  return repoRoot;
}

afterEach(async () => {
  await Promise.all(
    tempDirs.splice(0).map((tempDir) =>
      fs.rm(tempDir, { recursive: true, force: true })
    )
  );
});

describe('report writer repo root handling', () => {
  test('writes v1 reports and manifest under the report repo root', async () => {
    const repoRoot = await createTempRepo();
    const report = loadJsonFixture<Report>('fixtures/contracts/reports/valid-report.json');
    report.repoRoot = repoRoot;

    const historyPath = await writeHistoryReport(report, report.repoRoot);
    const latestPath = await writeLatestReport(report, report.repoRoot);

    await updateReportManifest(
      {
        reportId: report.reportId,
        createdAt: report.createdAt,
        reportPath: historyPath,
        requestedTargetNodeVersion: report.requestedTargetNodeVersion,
        subdirectory: report.subdirectory
      },
      report.repoRoot
    );

    await expect(
      fs.readFile(path.join(repoRoot, historyPath), 'utf8')
    ).resolves.toContain(`"${report.reportId}"`);
    await expect(
      fs.readFile(path.join(repoRoot, latestPath), 'utf8')
    ).resolves.toContain(`"${report.reportId}"`);
    await expect(
      fs.readFile(path.join(repoRoot, 'reports', 'index.json'), 'utf8')
    ).resolves.toContain(`"${historyPath}"`);
  });

  test('writes v2 reports and manifest under the report repo root', async () => {
    const repoRoot = await createTempRepo();
    const report = loadJsonFixture<ReportV2>('fixtures/contracts/reports/valid-report-v2.json');
    report.repoRoot = repoRoot;

    const historyPath = await writeHistoryReportV2(report, report.repoRoot);
    const latestPath = await writeLatestReportV2(report, report.repoRoot);

    await updateReportManifestV2(
      {
        reportId: report.reportId,
        createdAt: report.createdAt,
        reportPath: historyPath,
        ecosystem: report.stackProfile.ecosystem,
        framework: report.stackProfile.framework,
        requestedTargetVersion: report.requestedTargetVersion,
        subdirectory: report.subdirectory
      },
      report.repoRoot
    );

    await expect(
      fs.readFile(path.join(repoRoot, historyPath), 'utf8')
    ).resolves.toContain(`"${report.reportId}"`);
    await expect(
      fs.readFile(path.join(repoRoot, latestPath), 'utf8')
    ).resolves.toContain(`"${report.reportId}"`);
    await expect(
      fs.readFile(path.join(repoRoot, 'reports', 'index-v2.json'), 'utf8')
    ).resolves.toContain(`"${historyPath}"`);
  });
});
