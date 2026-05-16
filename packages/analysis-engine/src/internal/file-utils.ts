import type { Dirent } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';

const IGNORED_DIRECTORY_NAMES = new Set([
  '.git',
  '.next',
  '.turbo',
  'coverage',
  'dist',
  'node_modules'
]);

export function normalizePath(filePath: string): string {
  return filePath.split(path.sep).join('/');
}

export function resolveAnalysisRoot(
  repoRoot: string,
  subdirectory?: string
): string {
  return subdirectory ? path.resolve(repoRoot, subdirectory) : repoRoot;
}

export function toRelative(repoRoot: string, filePath: string): string {
  const relativePath = path.relative(repoRoot, filePath) || '.';
  return normalizePath(relativePath);
}

export async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

export async function readTextIfExists(filePath: string): Promise<string | null> {
  try {
    return await fs.readFile(filePath, 'utf8');
  } catch {
    return null;
  }
}

export async function readJsonIfExists<T>(filePath: string): Promise<T | null> {
  const raw = await readTextIfExists(filePath);

  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function sortEntries(entries: Dirent[]): Dirent[] {
  return [...entries].sort((left, right) => left.name.localeCompare(right.name));
}

export async function walkFiles(
  root: string,
  matcher: (filePath: string, entry: Dirent) => boolean,
  maxDepth = 4,
  currentDepth = 0
): Promise<string[]> {
  if (currentDepth > maxDepth || !(await fileExists(root))) {
    return [];
  }

  let entries: Dirent[];

  try {
    entries = sortEntries(await fs.readdir(root, { withFileTypes: true }));
  } catch {
    return [];
  }

  const files: string[] = [];

  for (const entry of entries) {
    const fullPath = path.join(root, entry.name);

    if (entry.isDirectory()) {
      if (IGNORED_DIRECTORY_NAMES.has(entry.name)) {
        continue;
      }

      files.push(
        ...(await walkFiles(fullPath, matcher, maxDepth, currentDepth + 1))
      );
      continue;
    }

    if (matcher(fullPath, entry)) {
      files.push(fullPath);
    }
  }

  return files;
}

export function uniqueStrings(values: string[]): string[] {
  return Array.from(new Set(values));
}
