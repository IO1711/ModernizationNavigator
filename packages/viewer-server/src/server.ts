import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';

import { getViewerPort, getViewerUrl, resolveProjectFilePath, resolveViewerAssetPath, VIEWER_HOST } from './config';

type ViewerServerState = {
  server: http.Server;
  port: number;
};

let viewerServerState: ViewerServerState | null = null;

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
  response: http.ServerResponse
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
    const reportsRoot = resolveProjectFilePath('reports');
    const reportFilePath = path.resolve(resolveProjectFilePath('.'), pathname.slice(1));
    await serveFile(response, reportFilePath, reportsRoot);
    return;
  }

  response.writeHead(404);
  response.end('Not Found');
}

export async function startViewerServer(): Promise<{
  url: string;
  status: 'started' | 'reused';
}> {
  if (viewerServerState) {
    return {
      url: getViewerUrl(viewerServerState.port),
      status: 'reused'
    };
  }

  const port = getViewerPort();
  const server = http.createServer((request, response) => {
    void handleRequest(request, response);
  });

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, VIEWER_HOST, () => resolve());
  });

  viewerServerState = { server, port };

  return {
    url: getViewerUrl(port),
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
