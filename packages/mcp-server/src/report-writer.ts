import fs from 'node:fs/promises';
import path from 'node:path';

import {
  HISTORY_REPORTS_DIR,
  LATEST_REPORT_PATH,
  REPORT_INDEX_PATH,
  reportManifestSchema,
  type Report,
  type ReportManifest
} from '@modernization-navigator/shared';

type ManifestEntry = ReportManifest['history'][number];

function getProjectRoot(): string {
  return process.cwd();
}

function getAbsolutePath(relativePath: string): string {
  return path.resolve(getProjectRoot(), relativePath);
}

async function ensureParentDirectory(filePath: string): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
}

async function writeJsonFile(filePath: string, data: unknown): Promise<void> {
  await ensureParentDirectory(filePath);
  await fs.writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

async function readManifest(): Promise<ReportManifest> {
  try {
    const content = await fs.readFile(getAbsolutePath(REPORT_INDEX_PATH), 'utf8');
    return reportManifestSchema.parse(JSON.parse(content));
  } catch {
    return {
      latestReportPath: LATEST_REPORT_PATH,
      history: []
    };
  }
}

export function buildReportId(now = new Date()): string {
  return now
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}Z$/, 'Z');
}

export async function writeLatestReport(report: Report): Promise<string> {
  await writeJsonFile(getAbsolutePath(LATEST_REPORT_PATH), report);
  return LATEST_REPORT_PATH;
}

export async function writeHistoryReport(report: Report): Promise<string> {
  const historyPath = path.posix.join(HISTORY_REPORTS_DIR, `${report.reportId}.json`);
  await writeJsonFile(getAbsolutePath(historyPath), report);
  return historyPath;
}

export async function updateReportManifest(entry: ManifestEntry): Promise<ReportManifest> {
  const currentManifest = await readManifest();
  const history = [
    entry,
    ...currentManifest.history.filter((item) => item.reportId !== entry.reportId)
  ];

  const nextManifest: ReportManifest = {
    latestReportPath: LATEST_REPORT_PATH,
    history
  };

  await writeJsonFile(getAbsolutePath(REPORT_INDEX_PATH), nextManifest);
  return nextManifest;
}
