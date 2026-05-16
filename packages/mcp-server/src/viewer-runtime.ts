import fs from 'node:fs';
import path from 'node:path';

import { openBrowser, resolveProjectFilePath, startViewerServer } from '@modernization-navigator/viewer-server';

export async function ensureViewerServerRunning(): Promise<{
  viewerUrl: string;
  serverStatus: 'started' | 'reused';
}> {
  const { status, url } = await startViewerServer();

  return {
    viewerUrl: url,
    serverStatus: status
  };
}

export async function openViewer(
  reportPath: string,
  autoOpenViewer = true
): Promise<{
  viewerUrl: string;
  serverStatus: 'started' | 'reused';
}> {
  const absoluteReportPath = path.isAbsolute(reportPath)
    ? reportPath
    : resolveProjectFilePath(reportPath);

  if (!fs.existsSync(absoluteReportPath)) {
    throw new Error(`Report path does not exist: ${absoluteReportPath}`);
  }

  const viewerState = await ensureViewerServerRunning();

  if (autoOpenViewer) {
    await openBrowser(viewerState.viewerUrl);
  }

  return viewerState;
}
