import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, test } from 'vitest';

import {
  collectEnvironmentEvidenceV2,
  discoverProjectStack,
  inspectFrameworkDependenciesV2,
  inspectPlatformConfigV2,
  inspectSourceRisksV2
} from '../../packages/analysis-engine/src';

const tempRoots: string[] = [];

function writeFixtureFile(
  filePath: string,
  value: string | Record<string, unknown>
): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(
    filePath,
    typeof value === 'string' ? value : `${JSON.stringify(value, null, 2)}\n`,
    'utf8'
  );
}

function createTempRepo(files: Record<string, string | Record<string, unknown>>): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'python-framework-'));
  tempRoots.push(root);

  for (const [relativePath, value] of Object.entries(files)) {
    writeFixtureFile(path.join(root, relativePath), value);
  }

  return root;
}

afterEach(() => {
  for (const root of tempRoots.splice(0)) {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

describe('python framework lane', () => {
  test('classifies a nested FastAPI project and reads repo-level python-version-file evidence', async () => {
    const repoRoot = createTempRepo({
      'services/api/pyproject.toml': `
[project]
name = "api"
requires-python = ">=3.11"
dependencies = [
  "fastapi==0.95.0",
  "uvicorn==0.30.0"
]

[build-system]
requires = ["setuptools>=68"]
build-backend = "setuptools.build_meta"
`,
      'services/api/.python-version': '3.11\n',
      'services/api/main.py': `
from fastapi import FastAPI

app = FastAPI()
`,
      '.github/workflows/ci.yml': `
name: ci
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/setup-python@v5
        with:
          python-version-file: services/api/.python-version
`
    });

    const stack = await discoverProjectStack({
      repoRoot,
      subdirectory: 'services/api',
      targetVersion: '3.12',
      offline: true
    });
    const environment = await collectEnvironmentEvidenceV2({
      repoRoot,
      subdirectory: 'services/api',
      targetVersion: '3.12',
      offline: true
    });

    expect(stack.projectDescriptors).toHaveLength(1);
    expect(stack.projectDescriptors[0]?.framework).toBe('fastapi');
    expect(environment.stackProfile.framework).toBe('fastapi');
    expect(environment.environmentEvidence).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'github-actions',
          value: '3.11'
        })
      ])
    );
  });

  test('routes Django projects through the Python lane for dependency, platform, and source checks', async () => {
    const repoRoot = createTempRepo({
      'apps/admin/requirements.txt': 'Django==3.2.0\n',
      'apps/admin/manage.py': `
from django.core.management import execute_from_command_line

execute_from_command_line()
`,
      'apps/admin/config/settings.py': 'DEBUG = True\n',
      'apps/admin/Procfile': 'web: python manage.py runserver 0.0.0.0:$PORT\n',
      'apps/admin/runtime.txt': 'python-3.12.3\n'
    });

    const stack = await discoverProjectStack({
      repoRoot,
      subdirectory: 'apps/admin',
      targetVersion: '3.12',
      offline: true
    });
    const dependencyResult = await inspectFrameworkDependenciesV2({
      repoRoot,
      subdirectory: 'apps/admin',
      targetVersion: '3.12',
      offline: true
    });
    const platformResult = await inspectPlatformConfigV2({
      repoRoot,
      subdirectory: 'apps/admin',
      targetVersion: '3.12',
      offline: true
    });
    const sourceResult = await inspectSourceRisksV2({
      repoRoot,
      subdirectory: 'apps/admin',
      targetVersion: '3.12',
      offline: true
    });

    expect(stack.projectDescriptors[0]?.framework).toBe('django');
    expect(dependencyResult.issues.map((issue) => issue.title)).toContain(
      'Django is pinned to a legacy major'
    );
    expect(platformResult.issues.map((issue) => issue.title)).toContain(
      'Django deployment path uses runserver'
    );
    expect(sourceResult.issues.map((issue) => issue.title)).toContain(
      'Django settings enable DEBUG = True'
    );
  });

  test('routes Flask projects through the Python lane for dependency, platform, and source checks', async () => {
    const repoRoot = createTempRepo({
      'apps/site/requirements.txt': 'Flask==2.2.0\n',
      'apps/site/app.py': `
from flask import Flask

app = Flask(__name__)
app.run(debug=True)
`,
      'apps/site/Procfile': 'web: flask run --host=0.0.0.0 --port=$PORT\n',
      'apps/site/runtime.txt': 'python-3.11.9\n'
    });

    const stack = await discoverProjectStack({
      repoRoot,
      subdirectory: 'apps/site',
      targetVersion: '3.12',
      offline: true
    });
    const dependencyResult = await inspectFrameworkDependenciesV2({
      repoRoot,
      subdirectory: 'apps/site',
      targetVersion: '3.12',
      offline: true
    });
    const platformResult = await inspectPlatformConfigV2({
      repoRoot,
      subdirectory: 'apps/site',
      targetVersion: '3.12',
      offline: true
    });
    const sourceResult = await inspectSourceRisksV2({
      repoRoot,
      subdirectory: 'apps/site',
      targetVersion: '3.12',
      offline: true
    });

    expect(stack.projectDescriptors[0]?.framework).toBe('flask');
    expect(dependencyResult.issues.map((issue) => issue.title)).toContain(
      'Flask is pinned to a legacy major'
    );
    expect(platformResult.issues.map((issue) => issue.title)).toContain(
      'Flask deployment path uses the development server'
    );
    expect(sourceResult.issues.map((issue) => issue.title)).toContain(
      'Flask source enables debug mode'
    );
  });
});
