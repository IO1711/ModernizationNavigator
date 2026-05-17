import path from 'node:path';

export const VIEWER_HOST = '127.0.0.1';
export const DEFAULT_VIEWER_PORT = 4173;

export function getPackageRoot(): string {
  return path.resolve(__dirname, '../../..');
}

export function getViewerPort(): number {
  const rawPort = process.env.VIEWER_PORT;
  const parsedPort = rawPort ? Number.parseInt(rawPort, 10) : NaN;

  return Number.isFinite(parsedPort) ? parsedPort : DEFAULT_VIEWER_PORT;
}

export function getViewerUrl(port = getViewerPort()): string {
  return `http://${VIEWER_HOST}:${port}/`;
}

export function resolveViewerAssetPath(relativePath: string): string {
  return path.resolve(getPackageRoot(), 'apps/viewer', relativePath);
}

export function resolveWorkspaceFilePath(
  workspaceRoot: string,
  relativePath: string
): string {
  return path.resolve(path.resolve(workspaceRoot), relativePath);
}
