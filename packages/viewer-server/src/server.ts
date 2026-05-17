import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';

import {
  getViewerPort,
  getViewerUrl,
  resolveViewerAssetPath,
  resolveWorkspaceFilePath,
  VIEWER_HOST
} from './config';

type ViewerServerState = {
  server: http.Server;
  port: number;
  workspaceRoot: string;
};

let viewerServerState: ViewerServerState | null = null;

function createViewerHttpServer(workspaceRoot: string): http.Server {
  return http.createServer((request, response) => {
    void handleRequest(request, response, workspaceRoot);
  });
}

function isAddressInfo(
  address: string | import('node:net').AddressInfo | null
): address is import('node:net').AddressInfo {
  return address !== null && typeof address !== 'string';
}

function isPortInUseError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && (error as NodeJS.ErrnoException).code === 'EADDRINUSE';
}

async function listenOnPort(server: http.Server, port: number): Promise<number> {
  await new Promise<void>((resolve, reject) => {
    const handleError = (error: Error): void => {
      server.off('listening', handleListening);
      reject(error);
    };

    const handleListening = (): void => {
      server.off('error', handleError);
      resolve();
    };

    server.once('error', handleError);
    server.once('listening', handleListening);
    server.listen(port, VIEWER_HOST);
  });

  const address = server.address();

  if (!isAddressInfo(address)) {
    throw new Error('Viewer server did not expose a TCP address after startup.');
  }

  return address.port;
}

function getContentType(filePath: string): string {
  if (filePath.endsWith('.html')) {
    return 'text/html; charset=utf-8';
  }

  if (filePath.endsWith('.css')) {
    return 'text/css; charset=utf-8';
  }

  if (filePath.endsWith('.js')) {
    return 'application/javascript; charset=utf-8';
  }

  if (filePath.endsWith('.json')) {
    return 'application/json; charset=utf-8';
  }

  return 'text/plain; charset=utf-8';
}

function isInsideDirectory(root: string, targetPath: string): boolean {
  const relativePath = path.relative(root, targetPath);
  return relativePath === '' || (!relativePath.startsWith('..') && !path.isAbsolute(relativePath));
}

async function serveFile(
  response: http.ServerResponse,
  filePath: string,
  rootForGuard?: string
): Promise<void> {
  if (rootForGuard && !isInsideDirectory(rootForGuard, filePath)) {
    response.writeHead(403);
    response.end('Forbidden');
    return;
  }

  try {
    const body = await fs.readFile(filePath);
    response.writeHead(200, { 'content-type': getContentType(filePath) });
    response.end(body);
  } catch {
    response.writeHead(404);
    response.end('Not Found');
  }
}

async function handleRequest(
  request: http.IncomingMessage,
  response: http.ServerResponse,
  workspaceRoot: string
): Promise<void> {
  const url = new URL(request.url ?? '/', getViewerUrl());
  const pathname = decodeURIComponent(url.pathname);

  if (pathname === '/' || pathname === '/index.html') {
    await serveFile(response, resolveViewerAssetPath('index.html'));
    return;
  }

  if (pathname === '/index.demo.html') {
    await serveFile(response, resolveViewerAssetPath('index.demo.html'));
    return;
  }

  if (pathname === '/styles.css' || pathname === '/app.js' || pathname === '/viewer-config.demo.js') {
    await serveFile(response, resolveViewerAssetPath(pathname.slice(1)));
    return;
  }

  if (pathname.startsWith('/sample/')) {
    const sampleRoot = resolveViewerAssetPath('sample');
    const sampleFilePath = path.resolve(sampleRoot, pathname.replace(/^\/sample\//, ''));
    await serveFile(response, sampleFilePath, sampleRoot);
    return;
  }

  if (pathname.startsWith('/reports/')) {
    const reportsRoot = resolveWorkspaceFilePath(workspaceRoot, 'reports');
    const reportFilePath = path.resolve(
      resolveWorkspaceFilePath(workspaceRoot, '.'),
      pathname.slice(1)
    );
    await serveFile(response, reportFilePath, reportsRoot);
    return;
  }

  response.writeHead(404);
  response.end('Not Found');
}

export async function startViewerServer(options?: {
  workspaceRoot?: string;
}): Promise<{
  url: string;
  status: 'started' | 'reused';
}> {
  const workspaceRoot = path.resolve(options?.workspaceRoot ?? process.cwd());

  if (viewerServerState) {
    if (viewerServerState.workspaceRoot !== workspaceRoot) {
      await stopViewerServer();
    } else {
      return {
        url: getViewerUrl(viewerServerState.port),
        status: 'reused'
      };
    }
  }

  const preferredPort = getViewerPort();
  let server = createViewerHttpServer(workspaceRoot);
  let boundPort: number;

  try {
    boundPort = await listenOnPort(server, preferredPort);
  } catch (error) {
    if (!isPortInUseError(error)) {
      throw error;
    }

    server = createViewerHttpServer(workspaceRoot);
    boundPort = await listenOnPort(server, 0);
  }

  viewerServerState = { server, port: boundPort, workspaceRoot };

  return {
    url: getViewerUrl(boundPort),
    status: 'started'
  };
}

export async function stopViewerServer(): Promise<void> {
  if (!viewerServerState) {
    return;
  }

  await new Promise<void>((resolve, reject) => {
    viewerServerState?.server.close((error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });

  viewerServerState = null;
}

if (require.main === module) {
  void startViewerServer().then(({ url, status }) => {
    console.log(`Viewer server ${status} at ${url}`);
  });
}
