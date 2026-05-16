import fs from 'node:fs/promises';
import path from 'node:path';

const projectRoot = process.cwd();
const sampleReportPath = path.join(
  projectRoot,
  'apps/viewer/sample/reports/sample-report.json'
);
const latestReportPath = path.join(projectRoot, 'reports/latest/report.json');
const historyReportPath = path.join(
  projectRoot,
  'reports/history/sample-20260516T090000Z.json'
);
const manifestPath = path.join(projectRoot, 'reports/index.json');

async function writeFile(targetPath: string, content: string): Promise<void> {
  await fs.mkdir(path.dirname(targetPath), { recursive: true });
  await fs.writeFile(targetPath, content, 'utf8');
}

async function main(): Promise<void> {
  const report = await fs.readFile(sampleReportPath, 'utf8');

  await writeFile(latestReportPath, report);
  await writeFile(historyReportPath, report);
  await writeFile(
    manifestPath,
    `${JSON.stringify(
      {
        latestReportPath: 'reports/latest/report.json',
        history: [
          {
            reportId: 'sample-20260516T090000Z',
            createdAt: '2026-05-16T09:00:00.000Z',
            reportPath: 'reports/history/sample-20260516T090000Z.json',
            requestedTargetNodeVersion: '20',
            subdirectory: 'services/api'
          }
        ]
      },
      null,
      2
    )}\n`
  );
}

void main();
