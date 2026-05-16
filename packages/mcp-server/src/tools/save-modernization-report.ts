import {
  reportSchema,
  saveModernizationReportInputSchema,
  saveModernizationReportResultSchema,
  type SaveModernizationReportInput,
  type SaveModernizationReportResult
} from '@modernization-navigator/shared';

import { updateReportManifest, writeHistoryReport, writeLatestReport } from '../report-writer';

export async function saveModernizationReport(
  input: SaveModernizationReportInput
): Promise<SaveModernizationReportResult> {
  const parsedInput = saveModernizationReportInputSchema.parse(input);
  const report = reportSchema.parse(parsedInput.report);

  // Write history and update the manifest BEFORE overwriting `latest`.
  // If a later step fails, `latest` still points to the previous valid
  // report instead of a half-saved one the viewer can't reconcile.
  const historyPath = await writeHistoryReport(report);

  await updateReportManifest({
    reportId: report.reportId,
    createdAt: report.createdAt,
    reportPath: historyPath,
    requestedTargetNodeVersion: report.requestedTargetNodeVersion,
    subdirectory: report.subdirectory
  });

  const reportPath = await writeLatestReport(report);

  return saveModernizationReportResultSchema.parse({
    reportId: report.reportId,
    reportPath,
    historyPath
  });
}
