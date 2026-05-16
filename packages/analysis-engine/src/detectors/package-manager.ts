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
  if (fs.existsSync(path.join(repoRoot, 'pnpm-lock.yaml'))) {
    return 'pnpm';
  }

  if (fs.existsSync(path.join(repoRoot, 'yarn.lock'))) {
    return 'yarn';
  }

  if (fs.existsSync(path.join(repoRoot, 'package-lock.json'))) {
    return 'npm';
  }

  if (fs.existsSync(path.join(repoRoot, 'pnpm-workspace.yaml'))) {
    return 'pnpm';
  }

  const packageJson = readPackageJson(repoRoot);
  const packageManagerField =
    typeof packageJson?.packageManager === 'string'
      ? packageJson.packageManager
      : '';

  if (packageManagerField.startsWith('pnpm')) {
    return 'pnpm';
  }

  if (packageManagerField.startsWith('yarn')) {
    return 'yarn';
  }

  return 'npm';
}
