import {
  reportSchema,
  saveModernizationReportInputSchema,
  saveModernizationReportResultSchema,
  type SaveModernizationReportInput,
  type SaveModernizationReportResult
} from '@modernization-navigator/shared';

import { updateReportManifest, writeHistoryReport, writeLatestReport } from '../report-writer';
import { registerSavedReportPath } from '../viewer-runtime';

export async function saveModernizationReport(
  input: SaveModernizationReportInput
): Promise<SaveModernizationReportResult> {
  const parsedInput = saveModernizationReportInputSchema.parse(input);
  const report = reportSchema.parse(parsedInput.report);

  // Write history and update the manifest BEFORE overwriting `latest`.
  // If a later step fails, `latest` still points to the previous valid
  // report instead of a half-saved one the viewer can't reconcile.
  const historyPath = await writeHistoryReport(report, report.repoRoot);

  await updateReportManifest({
    reportId: report.reportId,
    createdAt: report.createdAt,
    reportPath: historyPath,
    requestedTargetNodeVersion: report.requestedTargetNodeVersion,
    subdirectory: report.subdirectory
  }, report.repoRoot);

  const reportPath = await writeLatestReport(report, report.repoRoot);
  registerSavedReportPath(historyPath, report.repoRoot);
  registerSavedReportPath(reportPath, report.repoRoot);

  return saveModernizationReportResultSchema.parse({
    reportId: report.reportId,
    reportPath,
    historyPath
  });
}
