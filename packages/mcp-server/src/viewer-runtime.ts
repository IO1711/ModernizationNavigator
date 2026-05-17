import fs from 'node:fs';
import path from 'node:path';

import { openBrowser, startViewerServer } from '@modernization-navigator/viewer-server';

const V1_MANIFEST_PATH = '/reports/index.json';
const V2_MANIFEST_PATH = '/reports/index-v2.json';
const rememberedReportRoots = new Map<string, string>();

function normalizePathKey(filePath: string): string {
  return filePath.split(path.sep).join('/');
}

function resolveWorkspaceRoot(repoRoot?: string): string {
  return path.resolve(repoRoot ?? process.cwd());
}

function resolveWorkspaceFilePath(
  workspaceRoot: string,
  reportPath: string
): string {
  return path.resolve(workspaceRoot, reportPath);
}

function inferWorkspaceRootFromAbsoluteReportPath(reportPath: string): string | null {
  const normalizedPath = normalizePathKey(path.resolve(reportPath));
  const suffixMatch = normalizedPath.match(
    /^(.*)\/reports\/(?:latest\/report(?:-v2)?|history(?:\/v2)?\/[A-Za-z0-9-]+)\.json$/
  );

  return suffixMatch?.[1] ?? null;
}

function resolveRememberedWorkspaceRoot(reportPath: string): string | undefined {
  const normalizedInput = normalizePathKey(reportPath);
  const directMatch = rememberedReportRoots.get(normalizedInput);

  if (directMatch) {
    return directMatch;
  }

  if (!path.isAbsolute(reportPath)) {
    return rememberedReportRoots.get(
      normalizePathKey(resolveWorkspaceFilePath(process.cwd(), reportPath))
    );
  }

  return undefined;
}

function resolveReportWorkspaceRoot(
  reportPath: string,
  repoRoot?: string
): string {
  if (repoRoot) {
    return resolveWorkspaceRoot(repoRoot);
  }

  const rememberedRoot = resolveRememberedWorkspaceRoot(reportPath);

  if (rememberedRoot) {
    return rememberedRoot;
  }

  const inferredRoot = path.isAbsolute(reportPath)
    ? inferWorkspaceRootFromAbsoluteReportPath(reportPath)
    : null;

  if (inferredRoot) {
    return inferredRoot;
  }

  return resolveWorkspaceRoot();
}

export function registerSavedReportPath(reportPath: string, repoRoot: string): void {
  const workspaceRoot = resolveWorkspaceRoot(repoRoot);
  const absoluteReportPath = resolveWorkspaceFilePath(workspaceRoot, reportPath);

  rememberedReportRoots.set(normalizePathKey(reportPath), workspaceRoot);
  rememberedReportRoots.set(normalizePathKey(absoluteReportPath), workspaceRoot);
}

export async function ensureViewerServerRunning(repoRoot?: string): Promise<{
  viewerUrl: string;
  serverStatus: 'started' | 'reused';
}> {
  const { status, url } = await startViewerServer({
    workspaceRoot: resolveWorkspaceRoot(repoRoot)
  });

  return {
    viewerUrl: url,
    serverStatus: status
  };
}

export function normalizeViewerReportPath(
  reportPath: string,
  repoRoot?: string
): string {
  const workspaceRoot = resolveReportWorkspaceRoot(reportPath, repoRoot);
  const absoluteReportPath = path.isAbsolute(reportPath)
    ? reportPath
    : resolveWorkspaceFilePath(workspaceRoot, reportPath);
  const relativeReportPath = path
    .relative(workspaceRoot, absoluteReportPath)
    .split(path.sep)
    .join('/');

  if (
    relativeReportPath.length === 0 ||
    relativeReportPath.startsWith('../') ||
    path.isAbsolute(relativeReportPath)
  ) {
    throw new Error(`Report path must resolve inside the project root: ${reportPath}`);
  }

  return relativeReportPath;
}

export function inferViewerManifestPath(reportPath: string): string {
  return reportPath.startsWith('reports/latest/report-v2.json') ||
    reportPath.startsWith('reports/history/v2/')
    ? V2_MANIFEST_PATH
    : V1_MANIFEST_PATH;
}

export function buildViewerNavigationUrl(
  baseViewerUrl: string,
  reportPath: string,
  repoRoot?: string
): string {
  const normalizedReportPath = normalizeViewerReportPath(reportPath, repoRoot);
  const url = new URL(baseViewerUrl);
  url.searchParams.set('manifest', inferViewerManifestPath(normalizedReportPath));
  url.searchParams.set('report', `/${normalizedReportPath}`);
  return url.toString();
}

export async function openViewer(
  reportPath: string,
  autoOpenViewer = true,
  repoRoot?: string
): Promise<{
  viewerUrl: string;
  serverStatus: 'started' | 'reused';
}> {
  const workspaceRoot = resolveReportWorkspaceRoot(reportPath, repoRoot);
  const absoluteReportPath = path.isAbsolute(reportPath)
    ? reportPath
    : resolveWorkspaceFilePath(workspaceRoot, reportPath);

  if (!fs.existsSync(absoluteReportPath)) {
    throw new Error(`Report path does not exist: ${absoluteReportPath}`);
  }

  const viewerState = await ensureViewerServerRunning(workspaceRoot);
  const viewerUrl = buildViewerNavigationUrl(
    viewerState.viewerUrl,
    absoluteReportPath,
    workspaceRoot
  );

  if (autoOpenViewer) {
    await openBrowser(viewerUrl);
  }

  return {
    viewerUrl,
    serverStatus: viewerState.serverStatus
  };
}
