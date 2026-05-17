import path from 'node:path';

import type {
  EnvironmentEvidenceEntry,
  ProjectDescriptor
} from '@modernization-navigator/shared';

import {
  fileExists,
  readTextIfExists,
  resolveAnalysisRoot,
  toRelative,
  walkFiles
} from '../../internal/file-utils';

export type PythonFramework = Extract<
  ProjectDescriptor['framework'],
  'fastapi' | 'django' | 'flask'
>;

export type PythonDependencyManager = 'pip' | 'pipenv' | 'poetry' | 'uv';

export type PythonDependency = {
  name: string;
  spec: string;
  exactVersion: string | null;
  filePath: string;
  source: string;
};

export type PythonProject = {
  absoluteRoot: string;
  rootPath: string;
  framework: PythonFramework;
  confidence: number;
  markers: string[];
  dependencies: PythonDependency[];
  dependencyManager: PythonDependencyManager;
  buildSystem?: string;
  environmentEvidence: EnvironmentEvidenceEntry[];
};

type RuntimeDeclaration = {
  source: string;
  filePath: string;
  value: string;
  kind: EnvironmentEvidenceEntry['kind'];
};

type ProjectFilePaths = {
  pyprojectPath?: string;
  pipfilePath?: string;
  poetryLockPath?: string;
  uvLockPath?: string;
  runtimeTxtPath?: string;
  pythonVersionPath?: string;
  managePyPath?: string;
  requirementsPaths: string[];
};

type FrameworkScoreState = Record<PythonFramework, number>;

type DetectedFramework = {
  framework: PythonFramework;
  confidence: number;
  markers: string[];
};

const PYTHON_PROJECT_MARKER_FILE_NAMES = new Set([
  'pyproject.toml',
  'Pipfile',
  'poetry.lock',
  'uv.lock',
  'requirements.txt',
  'requirements-dev.txt',
  'requirements-test.txt',
  'runtime.txt',
  '.python-version',
  'manage.py'
]);

const PYTHON_DEPENDENCY_NAMES: PythonFramework[] = ['fastapi', 'django', 'flask'];
const PYTHON_DEPLOYMENT_FILE_NAMES = [
  'Procfile',
  'render.yaml',
  'render.yml',
  'vercel.json',
  'netlify.toml'
] as const;

function normalizePackageName(name: string): string {
  return name.trim().toLowerCase().replace(/_/g, '-');
}

function normalizeVersion(value: string): string {
  return value.trim().replace(/^['"]|['"]$/g, '');
}

function extractExactVersion(spec: string): string | null {
  const trimmedSpec = normalizeVersion(spec);
  const exactMatch = trimmedSpec.match(/^==\s*([0-9][0-9A-Za-z.+-]*)$/);

  if (exactMatch) {
    return exactMatch[1];
  }

  const plainVersionMatch = trimmedSpec.match(/^\d+\.\d+(?:\.\d+)?(?:[-+][0-9A-Za-z.-]+)?$/);
  return plainVersionMatch ? plainVersionMatch[0] : null;
}

function parseVersionTuple(value?: string): [number, number, number] | null {
  if (!value) {
    return null;
  }

  const match = value.match(/(\d+)(?:\.(\d+))?(?:\.(\d+))?/);

  if (!match) {
    return null;
  }

  return [
    Number.parseInt(match[1] ?? '0', 10),
    Number.parseInt(match[2] ?? '0', 10),
    Number.parseInt(match[3] ?? '0', 10)
  ];
}

export function compareVersionStrings(left?: string, right?: string): number {
  const leftTuple = parseVersionTuple(left);
  const rightTuple = parseVersionTuple(right);

  if (!leftTuple || !rightTuple) {
    return 0;
  }

  for (let index = 0; index < leftTuple.length; index += 1) {
    if (leftTuple[index] !== rightTuple[index]) {
      return leftTuple[index] < rightTuple[index] ? -1 : 1;
    }
  }

  return 0;
}

export function parsePythonVersionTuple(value?: string): [number, number] | null {
  const versionTuple = parseVersionTuple(value);

  if (!versionTuple) {
    return null;
  }

  return [versionTuple[0], versionTuple[1]];
}

export function comparePythonVersionTuples(
  left: [number, number],
  right: [number, number]
): number {
  if (left[0] !== right[0]) {
    return left[0] < right[0] ? -1 : 1;
  }

  if (left[1] !== right[1]) {
    return left[1] < right[1] ? -1 : 1;
  }

  return 0;
}

export function formatPythonVersionTuple(version: [number, number]): string {
  return `${version[0]}.${version[1]}`;
}

function uniqueDependencies(
  dependencies: PythonDependency[]
): PythonDependency[] {
  const dependencyMap = new Map<string, PythonDependency>();

  for (const dependency of dependencies) {
    const current = dependencyMap.get(dependency.name);

    if (!current) {
      dependencyMap.set(dependency.name, dependency);
      continue;
    }

    if (!current.exactVersion && dependency.exactVersion) {
      dependencyMap.set(dependency.name, dependency);
    }
  }

  return [...dependencyMap.values()].sort((left, right) => left.name.localeCompare(right.name));
}

function collectRequirementStrings(content: string): string[] {
  return content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith('#'))
    .map((line) => line.replace(/\s+#.*$/, '').trim())
    .filter((line) => line.length > 0);
}

function toDependencyFromRequirement(
  requirement: string,
  filePath: string,
  source: string
): PythonDependency | null {
  if (
    requirement.startsWith('-r ') ||
    requirement.startsWith('--requirement ') ||
    requirement.startsWith('-c ') ||
    requirement.startsWith('--constraint ') ||
    requirement.startsWith('-e ') ||
    requirement.startsWith('--editable ') ||
    requirement.startsWith('git+') ||
    requirement.startsWith('http://') ||
    requirement.startsWith('https://')
  ) {
    return null;
  }

  const nameMatch = requirement.match(/^([A-Za-z0-9_.-]+)/);

  if (!nameMatch) {
    return null;
  }

  return {
    name: normalizePackageName(nameMatch[1]),
    spec: requirement.slice(nameMatch[1].length).trim() || '*',
    exactVersion: extractExactVersion(requirement.slice(nameMatch[1].length).trim()),
    filePath,
    source
  };
}

function readTomlSection(content: string, sectionName: string): string | null {
  const lines = content.split(/\r?\n/);
  const sectionHeader = `[${sectionName}]`;
  const startIndex = lines.findIndex((line) => line.trim() === sectionHeader);

  if (startIndex < 0) {
    return null;
  }

  const sectionLines: string[] = [];

  for (let index = startIndex + 1; index < lines.length; index += 1) {
    const line = lines[index];

    if (/^\s*\[.+\]\s*$/.test(line)) {
      break;
    }

    sectionLines.push(line);
  }

  return sectionLines.join('\n');
}

function extractQuotedTomlValue(sectionText: string | null, key: string): string | null {
  if (!sectionText) {
    return null;
  }

  const match = sectionText.match(
    new RegExp(`^\\s*${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*=\\s*["']([^"']+)["']`, 'm')
  );

  return match?.[1]?.trim() ?? null;
}

function extractTomlStringArray(sectionText: string | null, key: string): string[] {
  if (!sectionText) {
    return [];
  }

  const match = sectionText.match(
    new RegExp(
      `${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*=\\s*\\[(.*?)\\]`,
      's'
    )
  );

  if (!match) {
    return [];
  }

  return Array.from(match[1].matchAll(/["']([^"']+)["']/g)).map((entry) =>
    entry[1].trim()
  );
}

function parseProjectDependenciesFromPyproject(
  content: string,
  relativeFilePath: string
): PythonDependency[] {
  const projectSection = readTomlSection(content, 'project');
  const dependencies = extractTomlStringArray(projectSection, 'dependencies');

  return dependencies
    .map((dependency) =>
      toDependencyFromRequirement(dependency, relativeFilePath, 'pyproject.toml:project.dependencies')
    )
    .filter((dependency): dependency is PythonDependency => dependency !== null);
}

function parsePoetryDependenciesFromPyproject(
  content: string,
  relativeFilePath: string
): PythonDependency[] {
  const poetryDependenciesSection = readTomlSection(content, 'tool.poetry.dependencies');

  if (!poetryDependenciesSection) {
    return [];
  }

  return poetryDependenciesSection
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith('#'))
    .flatMap((line) => {
      const match = line.match(/^([A-Za-z0-9_.-]+)\s*=\s*(.+)$/);

      if (!match) {
        return [];
      }

      const packageName = normalizePackageName(match[1]);

      if (packageName === 'python') {
        return [];
      }

      const rawValue = match[2].trim();
      const versionMatch =
        rawValue.match(/^["']([^"']+)["']/) ??
        rawValue.match(/version\s*=\s*["']([^"']+)["']/);
      const spec = versionMatch?.[1]?.trim() ?? rawValue;

      return [
        {
          name: packageName,
          spec,
          exactVersion: extractExactVersion(spec),
          filePath: relativeFilePath,
          source: 'pyproject.toml:tool.poetry.dependencies'
        } satisfies PythonDependency
      ];
    });
}

function parsePipfileDependencies(
  content: string,
  relativeFilePath: string
): PythonDependency[] {
  const dependencies: PythonDependency[] = [];

  for (const sectionName of ['packages', 'dev-packages']) {
    const section = readTomlSection(content, sectionName);

    if (!section) {
      continue;
    }

    for (const line of section.split(/\r?\n/).map((entry) => entry.trim())) {
      if (line.length === 0 || line.startsWith('#')) {
        continue;
      }

      const match = line.match(/^([A-Za-z0-9_.-]+)\s*=\s*(.+)$/);

      if (!match) {
        continue;
      }

      const packageName = normalizePackageName(match[1]);
      const rawValue = match[2].trim();
      const versionMatch =
        rawValue.match(/^["']([^"']+)["']/) ??
        rawValue.match(/version\s*=\s*["']([^"']+)["']/);
      const spec = versionMatch?.[1]?.trim() ?? rawValue;

      dependencies.push({
        name: packageName,
        spec,
        exactVersion: extractExactVersion(spec),
        filePath: relativeFilePath,
        source: `Pipfile:${sectionName}`
      });
    }
  }

  return dependencies;
}

function parseLockedDependencyVersions(
  content: string,
  filePath: string,
  source: string
): PythonDependency[] {
  const dependencies: PythonDependency[] = [];

  for (const match of content.matchAll(
    /(?:^|\n)\s*name\s*=\s*"([^"]+)"[\s\S]*?\n\s*version\s*=\s*"([^"]+)"/g
  )) {
    dependencies.push({
      name: normalizePackageName(match[1]),
      spec: `==${match[2]}`,
      exactVersion: match[2],
      filePath,
      source
    });
  }

  return dependencies;
}

function collectFrameworkMarkersFromDependencies(
  dependencies: PythonDependency[],
  frameworkScores: FrameworkScoreState,
  markers: string[]
): void {
  for (const dependency of dependencies) {
    if (!PYTHON_DEPENDENCY_NAMES.includes(dependency.name as PythonFramework)) {
      continue;
    }

    frameworkScores[dependency.name as PythonFramework] += 4;
    markers.push(`dependency:${dependency.name}`);
  }
}

function collectFrameworkMarkersFromSource(
  relativeFilePath: string,
  content: string,
  frameworkScores: FrameworkScoreState,
  markers: string[]
): void {
  const checks: Array<{ framework: PythonFramework; pattern: RegExp; marker: string }> = [
    {
      framework: 'fastapi',
      pattern: /\b(?:from\s+fastapi\s+import|import\s+fastapi\b|FastAPI\s*\()/,
      marker: 'import:fastapi'
    },
    {
      framework: 'django',
      pattern:
        /\b(?:from\s+django(?:\.|$)|import\s+django\b|DJANGO_SETTINGS_MODULE|execute_from_command_line\b)/,
      marker: 'import:django'
    },
    {
      framework: 'flask',
      pattern: /\b(?:from\s+flask\s+import|import\s+flask\b|Flask\s*\()/,
      marker: 'import:flask'
    }
  ];

  for (const check of checks) {
    if (!check.pattern.test(content)) {
      continue;
    }

    frameworkScores[check.framework] += 3;
    markers.push(`${check.marker}:${relativeFilePath}`);
  }
}

function chooseDetectedFramework(
  frameworkScores: FrameworkScoreState,
  markers: string[]
): DetectedFramework | null {
  const ranked = (Object.entries(frameworkScores) as Array<[PythonFramework, number]>)
    .filter(([, score]) => score > 0)
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]));

  if (ranked.length === 0) {
    return null;
  }

  const [framework, score] = ranked[0];
  const confidence = Math.min(0.98, 0.68 + score * 0.05);

  return {
    framework,
    confidence,
    markers: [...new Set(markers)].sort((left, right) => left.localeCompare(right))
  };
}

function detectDependencyManager(
  filePaths: ProjectFilePaths,
  pyprojectContent: string | null
): PythonDependencyManager {
  if (filePaths.uvLockPath || /\[tool\.uv(?:\.|])/.test(pyprojectContent ?? '')) {
    return 'uv';
  }

  if (filePaths.poetryLockPath || /\[tool\.poetry(?:\.|])/.test(pyprojectContent ?? '')) {
    return 'poetry';
  }

  if (filePaths.pipfilePath) {
    return 'pipenv';
  }

  return 'pip';
}

function detectBuildSystem(pyprojectContent: string | null): string | undefined {
  if (!pyprojectContent) {
    return undefined;
  }

  const buildSystemSection = readTomlSection(pyprojectContent, 'build-system');
  const buildBackend = extractQuotedTomlValue(buildSystemSection, 'build-backend');

  if (buildBackend?.includes('poetry')) {
    return 'poetry';
  }

  if (buildBackend?.includes('setuptools')) {
    return 'setuptools';
  }

  if (buildBackend?.includes('hatchling')) {
    return 'hatchling';
  }

  if (buildBackend?.includes('flit')) {
    return 'flit';
  }

  if (buildBackend?.includes('pdm')) {
    return 'pdm';
  }

  if (/\[tool\.uv(?:\.|])/.test(pyprojectContent)) {
    return 'uv';
  }

  return buildBackend ?? undefined;
}

function extractRequiresPythonEvidence(
  pyprojectContent: string | null,
  relativeFilePath: string
): RuntimeDeclaration[] {
  if (!pyprojectContent) {
    return [];
  }

  const declarations: RuntimeDeclaration[] = [];
  const projectSection = readTomlSection(pyprojectContent, 'project');
  const poetryDependenciesSection = readTomlSection(
    pyprojectContent,
    'tool.poetry.dependencies'
  );
  const projectRequiresPython = extractQuotedTomlValue(
    projectSection,
    'requires-python'
  );
  const poetryPythonVersion = extractQuotedTomlValue(poetryDependenciesSection, 'python');

  if (projectRequiresPython) {
    declarations.push({
      source: 'pyproject.toml:project.requires-python',
      filePath: relativeFilePath,
      value: projectRequiresPython,
      kind: 'runtime'
    });
  }

  if (poetryPythonVersion) {
    declarations.push({
      source: 'pyproject.toml:tool.poetry.dependencies.python',
      filePath: relativeFilePath,
      value: poetryPythonVersion,
      kind: 'runtime'
    });
  }

  return declarations;
}

function normalizeRuntimeTxtValue(content: string): string {
  const line = content
    .split(/\r?\n/)
    .map((entry) => entry.trim())
    .find((entry) => entry.length > 0);

  if (!line) {
    return '';
  }

  return line.replace(/^python-?/i, '').trim();
}

async function collectRuntimeEvidence(
  repoRoot: string,
  absoluteRoot: string,
  rootPath: string,
  filePaths: ProjectFilePaths,
  pyprojectContent: string | null
): Promise<EnvironmentEvidenceEntry[]> {
  const evidenceEntries: RuntimeDeclaration[] = [];

  if (filePaths.pyprojectPath) {
    evidenceEntries.push(
      ...extractRequiresPythonEvidence(
        pyprojectContent,
        toRelative(repoRoot, filePaths.pyprojectPath)
      )
    );
  }

  if (filePaths.pythonVersionPath) {
    const content = await readTextIfExists(filePaths.pythonVersionPath);

    if (content) {
      evidenceEntries.push({
        source: '.python-version',
        filePath: toRelative(repoRoot, filePaths.pythonVersionPath),
        value: content.split(/\r?\n/).find((line) => line.trim().length > 0)?.trim() ?? '',
        kind: 'runtime'
      });
    }
  }

  if (filePaths.runtimeTxtPath) {
    const content = await readTextIfExists(filePaths.runtimeTxtPath);

    if (content) {
      evidenceEntries.push({
        source: 'runtime.txt',
        filePath: toRelative(repoRoot, filePaths.runtimeTxtPath),
        value: normalizeRuntimeTxtValue(content),
        kind: 'runtime'
      });
    }
  }

  const dockerFiles = await walkFiles(
    absoluteRoot,
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

    for (const line of content.split(/\r?\n/)) {
      const trimmedLine = line.trim();
      const fromMatch = trimmedLine.match(/^FROM\s+python:([^\s]+)/i);
      const argMatch = trimmedLine.match(
        /^(ARG|ENV)\s+PYTHON_VERSION[=\s]+(.+)$/i
      );

      if (fromMatch) {
        evidenceEntries.push({
          source: 'Dockerfile:FROM',
          filePath: toRelative(repoRoot, dockerFile),
          value: fromMatch[1],
          kind: 'docker'
        });
      }

      if (argMatch) {
        evidenceEntries.push({
          source: `Dockerfile:${argMatch[1].toUpperCase()}`,
          filePath: toRelative(repoRoot, dockerFile),
          value: argMatch[2].trim(),
          kind: 'docker'
        });
      }
    }
  }

  const workflowRoots = [
    path.join(repoRoot, '.github', 'workflows'),
    path.join(absoluteRoot, '.github', 'workflows')
  ].filter((value, index, values) => values.indexOf(value) === index);
  const workflowFiles = new Set<string>();

  for (const workflowRoot of workflowRoots) {
    for (const workflowFile of await walkFiles(
      workflowRoot,
      (filePath) => filePath.endsWith('.yml') || filePath.endsWith('.yaml'),
      2
    )) {
      workflowFiles.add(workflowFile);
    }
  }

  for (const workflowFile of [...workflowFiles].sort((left, right) => left.localeCompare(right))) {
    const content = await readTextIfExists(workflowFile);

    if (!content) {
      continue;
    }

    for (const match of content.matchAll(/python-version\s*:\s*["']?([^\n"']+)/gi)) {
      evidenceEntries.push({
        source: 'github-actions',
        filePath: toRelative(repoRoot, workflowFile),
        value: match[1].trim(),
        kind: 'github-actions'
      });
    }

    for (const match of content.matchAll(/python-version-file\s*:\s*["']?([^\n"']+)/gi)) {
      const versionFileValue = match[1].trim();
      const versionFilePath = path.resolve(repoRoot, versionFileValue);
      const versionFileContent = await readTextIfExists(versionFilePath);
      const version = versionFileContent
        ?.split(/\r?\n/)
        .find((line) => line.trim().length > 0)
        ?.trim();

      if (!version) {
        continue;
      }

      evidenceEntries.push({
        source: 'github-actions:python-version-file',
        filePath: toRelative(repoRoot, workflowFile),
        value: version,
        kind: 'github-actions'
      });
    }
  }

  const deploymentFiles = await walkFiles(
    absoluteRoot,
    (filePath) =>
      PYTHON_DEPLOYMENT_FILE_NAMES.some((name) => filePath.endsWith(name)),
    3
  );

  for (const deploymentFile of deploymentFiles) {
    const content = await readTextIfExists(deploymentFile);

    if (!content) {
      continue;
    }

    for (const match of content.matchAll(
      /python(?:Version|_version|-version| runtime)?["'\s:=]+([0-9]+\.[0-9]+)/gi
    )) {
      evidenceEntries.push({
        source: `deployment:${path.basename(deploymentFile)}`,
        filePath: toRelative(repoRoot, deploymentFile),
        value: match[1].trim(),
        kind: 'deployment'
      });
    }
  }

  return evidenceEntries
    .filter((entry) => entry.value.trim().length > 0)
    .sort((left, right) => {
      return (
        left.filePath.localeCompare(right.filePath) ||
        left.kind.localeCompare(right.kind) ||
        left.source.localeCompare(right.source) ||
        left.value.localeCompare(right.value)
      );
    });
}

function collectProjectFilePaths(
  absoluteRoot: string,
  markerFiles: string[]
): ProjectFilePaths {
  const requirementsPaths = markerFiles.filter((filePath) =>
    /^requirements(?:-[A-Za-z0-9_-]+)?\.txt$/i.test(path.basename(filePath))
  );

  return {
    pyprojectPath: markerFiles.find((filePath) => path.basename(filePath) === 'pyproject.toml'),
    pipfilePath: markerFiles.find((filePath) => path.basename(filePath) === 'Pipfile'),
    poetryLockPath: markerFiles.find((filePath) => path.basename(filePath) === 'poetry.lock'),
    uvLockPath: markerFiles.find((filePath) => path.basename(filePath) === 'uv.lock'),
    runtimeTxtPath: markerFiles.find((filePath) => path.basename(filePath) === 'runtime.txt'),
    pythonVersionPath: markerFiles.find((filePath) => path.basename(filePath) === '.python-version'),
    managePyPath: markerFiles.find((filePath) => path.basename(filePath) === 'manage.py'),
    requirementsPaths
  };
}

async function scanPythonSourceMarkers(
  repoRoot: string,
  absoluteRoot: string,
  frameworkScores: FrameworkScoreState,
  markers: string[]
): Promise<void> {
  const sourceFiles = await walkFiles(
    absoluteRoot,
    (filePath) => filePath.endsWith('.py'),
    6
  );

  for (const sourceFile of sourceFiles) {
    const content = await readTextIfExists(sourceFile);

    if (!content) {
      continue;
    }

    collectFrameworkMarkersFromSource(
      toRelative(repoRoot, sourceFile),
      content,
      frameworkScores,
      markers
    );
  }
}

async function buildPythonProject(
  repoRoot: string,
  absoluteRoot: string
): Promise<PythonProject | null> {
  const rootPath = toRelative(repoRoot, absoluteRoot);
  const markerFiles = await walkFiles(
    absoluteRoot,
    (filePath) =>
      filePath === path.join(absoluteRoot, path.basename(filePath)) &&
      PYTHON_PROJECT_MARKER_FILE_NAMES.has(path.basename(filePath)),
    0
  );

  const filePaths = collectProjectFilePaths(absoluteRoot, markerFiles);
  const pyprojectContent = filePaths.pyprojectPath
    ? await readTextIfExists(filePaths.pyprojectPath)
    : null;
  const pipfileContent = filePaths.pipfilePath
    ? await readTextIfExists(filePaths.pipfilePath)
    : null;
  const poetryLockContent = filePaths.poetryLockPath
    ? await readTextIfExists(filePaths.poetryLockPath)
    : null;
  const uvLockContent = filePaths.uvLockPath
    ? await readTextIfExists(filePaths.uvLockPath)
    : null;
  const dependencies: PythonDependency[] = [];

  if (filePaths.pyprojectPath && pyprojectContent) {
    const relativeFilePath = toRelative(repoRoot, filePaths.pyprojectPath);
    dependencies.push(
      ...parseProjectDependenciesFromPyproject(pyprojectContent, relativeFilePath),
      ...parsePoetryDependenciesFromPyproject(pyprojectContent, relativeFilePath)
    );
  }

  if (filePaths.pipfilePath && pipfileContent) {
    dependencies.push(
      ...parsePipfileDependencies(
        pipfileContent,
        toRelative(repoRoot, filePaths.pipfilePath)
      )
    );
  }

  for (const requirementsPath of filePaths.requirementsPaths) {
    const content = await readTextIfExists(requirementsPath);

    if (!content) {
      continue;
    }

    const relativeFilePath = toRelative(repoRoot, requirementsPath);
    dependencies.push(
      ...collectRequirementStrings(content)
        .map((requirement) =>
          toDependencyFromRequirement(
            requirement,
            relativeFilePath,
            path.basename(requirementsPath)
          )
        )
        .filter((dependency): dependency is PythonDependency => dependency !== null)
    );
  }

  if (poetryLockContent && filePaths.poetryLockPath) {
    dependencies.push(
      ...parseLockedDependencyVersions(
        poetryLockContent,
        toRelative(repoRoot, filePaths.poetryLockPath),
        'poetry.lock'
      )
    );
  }

  if (uvLockContent && filePaths.uvLockPath) {
    dependencies.push(
      ...parseLockedDependencyVersions(
        uvLockContent,
        toRelative(repoRoot, filePaths.uvLockPath),
        'uv.lock'
      )
    );
  }

  const uniqueDependencyEntries = uniqueDependencies(dependencies);
  const frameworkScores: FrameworkScoreState = {
    fastapi: 0,
    django: 0,
    flask: 0
  };
  const markers: string[] = [];

  collectFrameworkMarkersFromDependencies(
    uniqueDependencyEntries,
    frameworkScores,
    markers
  );

  if (filePaths.managePyPath) {
    frameworkScores.django += 4;
    markers.push(`file:manage.py:${toRelative(repoRoot, filePaths.managePyPath)}`);
  }

  await scanPythonSourceMarkers(repoRoot, absoluteRoot, frameworkScores, markers);

  const detectedFramework = chooseDetectedFramework(frameworkScores, markers);

  if (!detectedFramework) {
    return null;
  }

  const dependencyManager = detectDependencyManager(filePaths, pyprojectContent);
  const buildSystem = detectBuildSystem(pyprojectContent);
  const environmentEvidence = await collectRuntimeEvidence(
    repoRoot,
    absoluteRoot,
    rootPath,
    filePaths,
    pyprojectContent
  );

  return {
    absoluteRoot,
    rootPath,
    framework: detectedFramework.framework,
    confidence: detectedFramework.confidence,
    markers: detectedFramework.markers,
    dependencies: uniqueDependencyEntries,
    dependencyManager,
    buildSystem,
    environmentEvidence
  };
}

export async function collectPythonProjectRoots(
  repoRoot: string,
  subdirectory?: string
): Promise<string[]> {
  const analysisRoot = resolveAnalysisRoot(repoRoot, subdirectory);
  const markerFiles = await walkFiles(
    analysisRoot,
    (filePath) => PYTHON_PROJECT_MARKER_FILE_NAMES.has(path.basename(filePath)),
    6
  );
  const candidateRoots = new Set<string>();

  for (const markerFile of markerFiles) {
    candidateRoots.add(path.dirname(markerFile));
  }

  return [...candidateRoots].sort((left, right) => left.localeCompare(right));
}

export async function collectPythonProjects(
  repoRoot: string,
  subdirectory?: string
): Promise<PythonProject[]> {
  const candidateRoots = await collectPythonProjectRoots(repoRoot, subdirectory);
  const projects = await Promise.all(
    candidateRoots.map((candidateRoot) => buildPythonProject(repoRoot, candidateRoot))
  );

  return projects
    .filter((project): project is PythonProject => project !== null)
    .sort((left, right) => left.rootPath.localeCompare(right.rootPath));
}

export async function loadPythonProject(
  repoRoot: string,
  rootPath: string
): Promise<PythonProject | null> {
  const absoluteRoot =
    rootPath === '.' ? repoRoot : path.resolve(repoRoot, rootPath);

  if (!(await fileExists(absoluteRoot))) {
    return null;
  }

  return buildPythonProject(repoRoot, absoluteRoot);
}
