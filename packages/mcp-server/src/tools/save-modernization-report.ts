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
  const reportPath = await writeLatestReport(report);
  const historyPath = await writeHistoryReport(report);

  await updateReportManifest({
    reportId: report.reportId,
    createdAt: report.createdAt,
    reportPath: historyPath,
    requestedTargetNodeVersion: report.requestedTargetNodeVersion,
    subdirectory: report.subdirectory
  });

  return saveModernizationReportResultSchema.parse({
    reportId: report.reportId,
    reportPath,
    historyPath
  });
}
