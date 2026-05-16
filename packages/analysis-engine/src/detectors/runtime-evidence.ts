import path from 'node:path';

import type { RuntimeEvidenceEntry } from '@modernization-navigator/shared';
import YAML from 'yaml';

import {
  readJsonIfExists,
  readTextIfExists,
  resolveAnalysisRoot,
  toRelative,
  walkFiles
} from '../internal/file-utils';

function findVersionLine(content: string): string {
  return content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => line.length > 0) ?? '';
}

function pushEvidenceEntry(
  entries: RuntimeEvidenceEntry[],
  entry: RuntimeEvidenceEntry
): void {
  entries.push({
    ...entry,
    filePath: entry.filePath,
    source: entry.source,
    value: entry.value.trim()
  });
}

function collectNestedValues(
  value: unknown,
  matcher: (key: string, scalarValue: string) => boolean,
  pathSegments: string[] = []
): Array<{ keyPath: string; value: string }> {
  if (Array.isArray(value)) {
    return value.flatMap((item, index) =>
      collectNestedValues(item, matcher, [...pathSegments, String(index)])
    );
  }

  if (!value || typeof value !== 'object') {
    return [];
  }

  return Object.entries(value).flatMap(([key, nestedValue]) => {
    const nextPathSegments = [...pathSegments, key];

    if (
      (typeof nestedValue === 'string' || typeof nestedValue === 'number') &&
      matcher(key, String(nestedValue))
    ) {
      return [
        {
          keyPath: nextPathSegments.join('.'),
          value: String(nestedValue)
        }
      ];
    }

    return collectNestedValues(nestedValue, matcher, nextPathSegments);
  });
}

function sortRuntimeEvidence(
  entries: RuntimeEvidenceEntry[]
): RuntimeEvidenceEntry[] {
  return [...entries].sort((left, right) => {
    return (
      left.filePath.localeCompare(right.filePath) ||
      left.kind.localeCompare(right.kind) ||
      left.source.localeCompare(right.source) ||
      left.value.localeCompare(right.value)
    );
  });
}

export async function collectRuntimeEvidenceEntries(
  repoRoot: string,
  subdirectory?: string
): Promise<RuntimeEvidenceEntry[]> {
  const analysisRoot = resolveAnalysisRoot(repoRoot, subdirectory);
  const evidence: RuntimeEvidenceEntry[] = [];
  const packageJsonPath = path.join(analysisRoot, 'package.json');
  const packageJson = await readJsonIfExists<{
    engines?: { node?: string };
    scripts?: Record<string, string>;
  }>(packageJsonPath);

  if (packageJson) {
    if (packageJson.engines?.node) {
      pushEvidenceEntry(evidence, {
        source: 'package.json',
        filePath: toRelative(repoRoot, packageJsonPath),
        value: packageJson.engines.node,
        kind: 'engines'
      });
    }

    for (const [scriptName, scriptValue] of Object.entries(
      packageJson.scripts ?? {}
    ).sort(([leftName], [rightName]) => leftName.localeCompare(rightName))) {
      if (
        !/\b(node|nvm|volta)\b|NODE_(?:OPTIONS|VERSION)|\.nvmrc|\.node-version/i.test(
          scriptValue
        )
      ) {
        continue;
      }

      pushEvidenceEntry(evidence, {
        source: `package.json:scripts.${scriptName}`,
        filePath: toRelative(repoRoot, packageJsonPath),
        value: scriptValue,
        kind: 'script'
      });
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

    pushEvidenceEntry(evidence, {
      source: fileName,
      filePath: toRelative(repoRoot, filePath),
      value: findVersionLine(content),
      kind
    });
  }

  const dockerFiles = await walkFiles(
    analysisRoot,
    (filePath) =>
      /(^|\/)Dockerfile(?:\.[^/]+)?$/i.test(filePath) ||
      filePath.toLowerCase().endsWith('.dockerfile'),
    3
  );

  for (const dockerFile of dockerFiles) {
    const content = await readTextIfExists(dockerFile);

    if (!content) {
      continue;
    }

    const lines = content.split(/\r?\n/);

    for (const line of lines) {
      const trimmedLine = line.trim();
      const fromMatch = trimmedLine.match(/^FROM\s+node:([^\s]+)/i);
      const argMatch = trimmedLine.match(/^(ARG|ENV)\s+NODE_VERSION[=\s]+(.+)$/i);

      if (fromMatch) {
        pushEvidenceEntry(evidence, {
          source: 'Dockerfile:FROM',
          filePath: toRelative(repoRoot, dockerFile),
          value: `node:${fromMatch[1]}`,
          kind: 'docker'
        });
      }

      if (argMatch) {
        pushEvidenceEntry(evidence, {
          source: `Dockerfile:${argMatch[1].toUpperCase()}`,
          filePath: toRelative(repoRoot, dockerFile),
          value: argMatch[2],
          kind: 'docker'
        });
      }
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

    try {
      const parsedWorkflow = YAML.parse(content) as unknown;
      const workflowNodeVersions = collectNestedValues(
        parsedWorkflow,
        (key) => key === 'node-version' || key === 'node-version-file'
      );

      for (const workflowNodeVersion of workflowNodeVersions) {
        pushEvidenceEntry(evidence, {
          source: `github-actions:${workflowNodeVersion.keyPath}`,
          filePath: toRelative(repoRoot, workflowFile),
          value: workflowNodeVersion.value,
          kind: 'github-actions'
        });
      }
    } catch {
      const matches = content.match(/node-version(?:-file)?\s*:\s*["']?([^\n"']+)/gi) ?? [];

      for (const match of matches) {
        pushEvidenceEntry(evidence, {
          source: 'github-actions',
          filePath: toRelative(repoRoot, workflowFile),
          value: match.split(':').slice(1).join(':').trim().replace(/["']/g, ''),
          kind: 'github-actions'
        });
      }
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

    const relativeFilePath = toRelative(repoRoot, deploymentFile);

    if (deploymentFile.endsWith('vercel.json')) {
      const parsedConfig = await readJsonIfExists<Record<string, unknown>>(
        deploymentFile
      );
      const matches = collectNestedValues(
        parsedConfig,
        (key, value) =>
          /node/i.test(key) || /runtime/i.test(key) || /node/i.test(value)
      );

      for (const match of matches) {
        pushEvidenceEntry(evidence, {
          source: `deployment:${match.keyPath}`,
          filePath: relativeFilePath,
          value: match.value,
          kind: 'deployment'
        });
      }

      continue;
    }

    if (deploymentFile.endsWith('render.yaml') || deploymentFile.endsWith('render.yml')) {
      try {
        const parsedConfig = YAML.parse(content) as unknown;
        const matches = collectNestedValues(
          parsedConfig,
          (key, value) =>
            /node/i.test(key) || /runtime/i.test(key) || /node/i.test(value)
        );

        for (const match of matches) {
          pushEvidenceEntry(evidence, {
            source: `deployment:${match.keyPath}`,
            filePath: relativeFilePath,
            value: match.value,
            kind: 'deployment'
          });
        }

        continue;
      } catch {
        // Fall back to line scanning below.
      }
    }

    const deploymentLines = content
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => /(node|NODE_VERSION|engines|runtime)/i.test(line));

    for (const line of deploymentLines) {
      pushEvidenceEntry(evidence, {
        source: 'deployment-config',
        filePath: relativeFilePath,
        value: line,
        kind: 'deployment'
      });
    }
  }

  const deduplicatedEvidence = new Map<string, RuntimeEvidenceEntry>();

  for (const entry of evidence) {
    const key = `${entry.kind}|${entry.filePath}|${entry.source}|${entry.value}`;
    deduplicatedEvidence.set(key, entry);
  }

  return sortRuntimeEvidence(Array.from(deduplicatedEvidence.values()));
}
