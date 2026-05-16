import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, test } from 'vitest';

import {
  discoverProjectStack,
  inspectFrameworkDependenciesV2
} from '../../packages/analysis-engine/src';

const tempRoots: string[] = [];

function writeJson(filePath: string, value: unknown): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function createTempRepo(files: Record<string, unknown>): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'react-framework-'));
  tempRoots.push(root);

  for (const [relativePath, value] of Object.entries(files)) {
    const absolutePath = path.join(root, relativePath);
    writeJson(absolutePath, value);
  }

  return root;
}

afterEach(() => {
  for (const root of tempRoots.splice(0)) {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

describe('react framework lane', () => {
  test('classifies a React/Vite project as framework react', async () => {
    const repoRoot = createTempRepo({
      'apps/web/package.json': {
        name: 'web',
        private: true,
        packageManager: 'pnpm@9.0.0',
        dependencies: {
          react: '^18.2.0',
          'react-dom': '^18.2.0'
        },
        devDependencies: {
          vite: '^5.2.0',
          '@vitejs/plugin-react': '^4.3.0',
          typescript: '^5.5.0'
        }
      },
      'apps/web/tsconfig.json': {}
    });

    const result = await discoverProjectStack({
      repoRoot,
      subdirectory: 'apps/web',
      targetVersion: '20',
      offline: true
    });

    expect(result.projectDescriptors).toHaveLength(1);
    expect(result.projectDescriptors[0]?.framework).toBe('react');
    expect(result.projectDescriptors[0]?.buildSystem).toBe('vite');
  });

  test('adds React-specific dependency issues on top of the Node dependency scan', async () => {
    const repoRoot = createTempRepo({
      'apps/web/package.json': {
        name: 'web',
        private: true,
        packageManager: 'pnpm@9.0.0',
        dependencies: {
          react: '^18.2.0',
          'react-dom': '^17.0.2',
          'react-scripts': '4.0.3',
          next: '^14.2.0'
        },
        devDependencies: {
          vite: '^5.2.0',
          '@vitejs/plugin-react': '^4.3.0'
        }
      }
    });

    const result = await inspectFrameworkDependenciesV2({
      repoRoot,
      subdirectory: 'apps/web',
      targetVersion: '20',
      offline: true
    });

    const titles = result.issues.map((issue) => issue.title);

    expect(titles).toContain('react-scripts is pinned to a legacy major');
    expect(titles).toContain('react and react-dom major versions do not match');
    expect(titles).toContain('Multiple React build toolchains are declared');
  });
});
