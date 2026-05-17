import path from 'node:path';
import http from 'node:http';
import os from 'node:os';
import fs from 'node:fs/promises';

import { afterEach, describe, expect, test } from 'vitest';

import {
  buildViewerNavigationUrl,
  inferViewerManifestPath,
  normalizeViewerReportPath
} from '../../packages/mcp-server/src/viewer-runtime';
import {
  startViewerServer,
  stopViewerServer
} from '../../packages/viewer-server/src/server';

afterEach(async () => {
  delete process.env.VIEWER_PORT;
  await stopViewerServer();
});

describe('viewer runtime navigation', () => {
  test('infers the correct manifest path for v1 and v2 reports', () => {
    expect(inferViewerManifestPath('reports/latest/report.json')).toBe('/reports/index.json');
    expect(inferViewerManifestPath('reports/history/example-20260516T120000Z.json')).toBe(
      '/reports/index.json'
    );
    expect(inferViewerManifestPath('reports/latest/report-v2.json')).toBe(
      '/reports/index-v2.json'
    );
    expect(inferViewerManifestPath('reports/history/v2/example-20260516T120000Z.json')).toBe(
      '/reports/index-v2.json'
    );
  });

  test('normalizes relative and absolute report paths into project-relative viewer paths', () => {
    expect(normalizeViewerReportPath('reports/latest/report-v2.json')).toBe(
      'reports/latest/report-v2.json'
    );
    expect(
      normalizeViewerReportPath(
        path.join(process.cwd(), 'reports', 'latest', 'report-v2.json')
      )
    ).toBe('reports/latest/report-v2.json');
  });

  test('builds a viewer URL that targets the saved report and its manifest', () => {
    const url = new URL(
      buildViewerNavigationUrl(
        'http://127.0.0.1:4173/',
        'reports/latest/report-v2.json'
      )
    );

    expect(url.origin).toBe('http://127.0.0.1:4173');
    expect(url.searchParams.get('manifest')).toBe('/reports/index-v2.json');
    expect(url.searchParams.get('report')).toBe('/reports/latest/report-v2.json');
  });

  test('builds viewer URLs for reports that live under a different workspace root', async () => {
    const tempRepoRoot = await fs.mkdtemp(
      path.join(os.tmpdir(), 'modernization-navigator-viewer-')
    );

    try {
      await fs.mkdir(path.join(tempRepoRoot, 'reports', 'latest'), { recursive: true });
      await fs.writeFile(
        path.join(tempRepoRoot, 'reports', 'latest', 'report-v2.json'),
        '{}',
        'utf8'
      );

      expect(
        normalizeViewerReportPath('reports/latest/report-v2.json', tempRepoRoot)
      ).toBe('reports/latest/report-v2.json');

      const url = new URL(
        buildViewerNavigationUrl(
          'http://127.0.0.1:4173/',
          'reports/latest/report-v2.json',
          tempRepoRoot
        )
      );

      expect(url.searchParams.get('manifest')).toBe('/reports/index-v2.json');
      expect(url.searchParams.get('report')).toBe('/reports/latest/report-v2.json');
    } finally {
      await fs.rm(tempRepoRoot, { recursive: true, force: true });
    }
  });

  test('falls back to a free port when the preferred viewer port is already in use', async () => {
    const blockedServer = http.createServer();

    await new Promise<void>((resolve, reject) => {
      blockedServer.once('error', reject);
      blockedServer.listen(4558, '127.0.0.1', () => resolve());
    });

    process.env.VIEWER_PORT = '4558';

    try {
      const { url, status } = await startViewerServer();
      const parsedUrl = new URL(url);

      expect(status).toBe('started');
      expect(parsedUrl.hostname).toBe('127.0.0.1');
      expect(parsedUrl.port).not.toBe('4558');
    } finally {
      await new Promise<void>((resolve, reject) => {
        blockedServer.close((error) => {
          if (error) {
            reject(error);
            return;
          }

          resolve();
        });
      });
    }
  });
});
