import fs from 'node:fs/promises';
import path from 'node:path';

import { detectPackageManager } from '@modernization-navigator/analysis-engine';
import {
  baseToolInputSchema,
  discoverRepoScopeResultSchema,
  type BaseToolInput,
  type DiscoverRepoScopeResult
} from '@modernization-navigator/shared';

async function readJsonIfExists(filePath: string): Promise<Record<string, unknown> | null> {
  try {
    const content = await fs.readFile(filePath, 'utf8');
    return JSON.parse(content) as Record<string, unknown>;
  } catch {
    return null;
  }
}

async function collectCandidateProjects(
  root: string,
  current = root,
  depth = 0
): Promise<string[]> {
  if (depth > 4) {
    return [];
  }

  let entries: Awaited<ReturnType<typeof fs.readdir>>;

  try {
    entries = await fs.readdir(current, { withFileTypes: true });
  } catch {
    return [];
  }

  const candidates: string[] = [];

  for (const entry of entries) {
    if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === 'dist') {
      continue;
    }

    const entryPath = path.join(current, entry.name);

    if (entry.isDirectory()) {
      candidates.push(...(await collectCandidateProjects(root, entryPath, depth + 1)));
      continue;
    }

    if (entry.name === 'package.json') {
      const relativeDir = path.relative(root, path.dirname(entryPath)) || '.';
      candidates.push(relativeDir);
    }
  }

  return Array.from(new Set(candidates)).sort();
}

function detectWorkspaceType(
  packageJson: Record<string, unknown> | null,
  candidateProjects: string[]
): 'single' | 'monorepo' {
  const workspaces = packageJson?.workspaces;

  if (Array.isArray(workspaces)) {
    return 'monorepo';
  }

  if (
    workspaces &&
    typeof workspaces === 'object' &&
    Array.isArray((workspaces as { packages?: unknown }).packages)
  ) {
    return 'monorepo';
  }

  return candidateProjects.length > 1 ? 'monorepo' : 'single';
}

export async function discoverRepoScope(
  input: BaseToolInput
): Promise<DiscoverRepoScopeResult> {
  const parsedInput = baseToolInputSchema.parse(input);
  const candidateProjects = await collectCandidateProjects(parsedInput.repoRoot);
  const rootPackageJson = await readJsonIfExists(
    path.join(parsedInput.repoRoot, 'package.json')
  );

  return discoverRepoScopeResultSchema.parse({
    repoRoot: parsedInput.repoRoot,
    subdirectory: parsedInput.subdirectory,
    detectedPackageManager: detectPackageManager(parsedInput.repoRoot),
    workspaceType: detectWorkspaceType(rootPackageJson, candidateProjects),
    candidateProjects
  });
}
