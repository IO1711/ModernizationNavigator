import {
  reportV2Schema,
  saveModernizationReportV2InputSchema,
  saveModernizationReportV2ResultSchema,
  type SaveModernizationReportV2Input,
  type SaveModernizationReportV2Result
} from '@modernization-navigator/shared';

import {
  updateReportManifestV2,
  writeHistoryReportV2,
  writeLatestReportV2
} from '../report-writer';

export async function saveModernizationReportV2(
  input: SaveModernizationReportV2Input
): Promise<SaveModernizationReportV2Result> {
  const parsedInput = saveModernizationReportV2InputSchema.parse(input);
  const report = reportV2Schema.parse(parsedInput.report);

  const historyPath = await writeHistoryReportV2(report);

  await updateReportManifestV2({
    reportId: report.reportId,
    createdAt: report.createdAt,
    reportPath: historyPath,
    ecosystem: report.stackProfile.ecosystem,
    framework: report.stackProfile.framework,
    requestedTargetVersion: report.requestedTargetVersion,
    subdirectory: report.subdirectory
  });

  const reportPath = await writeLatestReportV2(report);

  return saveModernizationReportV2ResultSchema.parse({
    reportId: report.reportId,
    reportPath,
    historyPath
  });
}
