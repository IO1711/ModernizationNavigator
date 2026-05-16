import {
  openReportViewerInputSchema,
  openReportViewerResultSchema,
  type OpenReportViewerInput,
  type OpenReportViewerResult
} from '@modernization-navigator/shared';

import { openViewer } from '../viewer-runtime';

export async function openReportViewer(
  input: OpenReportViewerInput
): Promise<OpenReportViewerResult> {
  const parsedInput = openReportViewerInputSchema.parse(input);
  const result = await openViewer(
    parsedInput.reportPath,
    parsedInput.autoOpenViewer ?? true
  );

  return openReportViewerResultSchema.parse(result);
}
