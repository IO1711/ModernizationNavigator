import fs from 'node:fs/promises';
import path from 'node:path';

import type { RuntimeEvidenceEntry } from '@modernization-navigator/shared';

function resolveAnalysisRoot(repoRoot: string, subdirectory?: string): string {
  return subdirectory ? path.resolve(repoRoot, subdirectory) : repoRoot;
}

async function readTextIfExists(filePath: string): Promise<string | null> {
  try {
    return await fs.readFile(filePath, 'utf8');
  } catch {
    return null;
  }
}

async function walkFiles(
  root: string,
  matcher: (filePath: string) => boolean,
  maxDepth = 4,
  currentDepth = 0
): Promise<string[]> {
  if (currentDepth > maxDepth) {
    return [];
  }

  let entries: Awaited<ReturnType<typeof fs.readdir>>;

  try {
    entries = await fs.readdir(root, { withFileTypes: true });
  } catch {
    return [];
  }

  const files: string[] = [];

  for (const entry of entries) {
    if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === 'dist') {
      continue;
    }

    const fullPath = path.join(root, entry.name);

    if (entry.isDirectory()) {
      files.push(
        ...(await walkFiles(fullPath, matcher, maxDepth, currentDepth + 1))
      );
      continue;
    }

    if (matcher(fullPath)) {
      files.push(fullPath);
    }
  }

  return files;
}

function toRelative(repoRoot: string, filePath: string): string {
  return path.relative(repoRoot, filePath) || '.';
}

function findVersionLine(content: string): string {
  return content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => line.length > 0) ?? '';
}

export async function collectRuntimeEvidenceEntries(
  repoRoot: string,
  subdirectory?: string
): Promise<RuntimeEvidenceEntry[]> {
  const analysisRoot = resolveAnalysisRoot(repoRoot, subdirectory);
  const evidence: RuntimeEvidenceEntry[] = [];
  const packageJsonPath = path.join(analysisRoot, 'package.json');
  const packageJsonText = await readTextIfExists(packageJsonPath);

  if (packageJsonText) {
    try {
      const packageJson = JSON.parse(packageJsonText) as {
        engines?: { node?: string };
        scripts?: Record<string, string>;
      };

      if (packageJson.engines?.node) {
        evidence.push({
          source: 'package.json',
          filePath: toRelative(repoRoot, packageJsonPath),
          value: packageJson.engines.node,
          kind: 'engines'
        });
      }

      for (const [scriptName, scriptValue] of Object.entries(packageJson.scripts ?? {})) {
        if (!/(^|[\s=:])(node|nvm|NODE_OPTIONS)([\s=:]|$)/.test(scriptValue)) {
          continue;
        }

        evidence.push({
          source: `package.json:scripts.${scriptName}`,
          filePath: toRelative(repoRoot, packageJsonPath),
          value: scriptValue,
          kind: 'script'
        });
      }
    } catch {
      // Keep the starter detector resilient to malformed package.json files.
    }
  }

  for (const [fileName, kind] of [
    ['.nvmrc', 'nvmrc'],
    ['.node-version', 'node-version']
  ] as const) {
    const filePath = path.join(analysisRoot, fileName);
    const content = await readTextIfExists(filePath);

    if (!content) {
      continue;
    }

    evidence.push({
      source: fileName,
      filePath: toRelative(repoRoot, filePath),
      value: findVersionLine(content),
      kind
    });
  }

  const dockerFiles = await walkFiles(
    analysisRoot,
    (filePath) => /(^|\/)Dockerfile/i.test(filePath) || filePath.endsWith('.dockerfile'),
    3
  );

  for (const dockerFile of dockerFiles) {
    const content = await readTextIfExists(dockerFile);

    if (!content) {
      continue;
    }

    const matches = content.match(/FROM\s+node:([^\s]+)/gi) ?? [];

    for (const match of matches) {
      evidence.push({
        source: 'Dockerfile',
        filePath: toRelative(repoRoot, dockerFile),
        value: match.replace(/^FROM\s+/i, ''),
        kind: 'docker'
      });
    }
  }

  const workflowRoot = path.join(analysisRoot, '.github', 'workflows');
  const workflowFiles = await walkFiles(
    workflowRoot,
    (filePath) => filePath.endsWith('.yml') || filePath.endsWith('.yaml'),
    2
  );

  for (const workflowFile of workflowFiles) {
    const content = await readTextIfExists(workflowFile);

    if (!content) {
      continue;
    }

    const matches = content.match(/node-version\s*:\s*["']?([^\n"']+)/gi) ?? [];

    for (const match of matches) {
      evidence.push({
        source: 'github-actions',
        filePath: toRelative(repoRoot, workflowFile),
        value: match.split(':').slice(1).join(':').trim().replace(/["']/g, ''),
        kind: 'github-actions'
      });
    }
  }

  const deploymentFiles = await walkFiles(
    analysisRoot,
    (filePath) =>
      ['vercel.json', 'netlify.toml', 'render.yaml', 'render.yml', 'fly.toml'].some(
        (name) => filePath.endsWith(name)
      ),
    3
  );

  for (const deploymentFile of deploymentFiles) {
    const content = await readTextIfExists(deploymentFile);

    if (!content) {
      continue;
    }

    const deploymentLines = content
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => /(node|NODE_VERSION|engines|runtime)/.test(line));

    for (const line of deploymentLines) {
      evidence.push({
        source: 'deployment-config',
        filePath: toRelative(repoRoot, deploymentFile),
        value: line,
        kind: 'deployment'
      });
    }
  }

  return evidence;
}
