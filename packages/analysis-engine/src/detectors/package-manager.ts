import fs from 'node:fs';
import path from 'node:path';

type PackageManager = 'npm' | 'pnpm' | 'yarn';

function readPackageJson(repoRoot: string): Record<string, unknown> | null {
  const packageJsonPath = path.join(repoRoot, 'package.json');

  if (!fs.existsSync(packageJsonPath)) {
    return null;
  }

  return JSON.parse(fs.readFileSync(packageJsonPath, 'utf8')) as Record<
    string,
    unknown
  >;
}

export function detectPackageManager(repoRoot: string): PackageManager {
  const packageJson = readPackageJson(repoRoot);
  const packageManagerField =
    typeof packageJson?.packageManager === 'string'
      ? packageJson.packageManager
      : '';
  const lockfileChecks: Array<{ fileName: string; manager: PackageManager }> = [
    { fileName: 'pnpm-lock.yaml', manager: 'pnpm' },
    { fileName: 'yarn.lock', manager: 'yarn' },
    { fileName: 'package-lock.json', manager: 'npm' }
  ];

  for (const lockfileCheck of lockfileChecks) {
    if (fs.existsSync(path.join(repoRoot, lockfileCheck.fileName))) {
      return lockfileCheck.manager;
    }
  }

  if (fs.existsSync(path.join(repoRoot, 'pnpm-workspace.yaml'))) {
    return 'pnpm';
  }

  if (
    fs.existsSync(path.join(repoRoot, '.yarnrc.yml')) ||
    fs.existsSync(path.join(repoRoot, '.yarnrc')) ||
    fs.existsSync(path.join(repoRoot, '.yarn'))
  ) {
    return 'yarn';
  }

  if (packageManagerField.startsWith('pnpm')) {
    return 'pnpm';
  }

  if (packageManagerField.startsWith('yarn')) {
    return 'yarn';
  }

  return 'npm';
}
