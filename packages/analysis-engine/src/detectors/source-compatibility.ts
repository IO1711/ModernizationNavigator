import path from 'node:path';

import {
  Project,
  ScriptTarget,
  SyntaxKind,
  type Node,
  type SourceFile
} from 'ts-morph';
import type {
  InspectSourceCompatibilityResult,
  Issue
} from '@modernization-navigator/shared';

import {
  readJsonIfExists,
  resolveAnalysisRoot,
  toRelative,
  walkFiles
} from '../internal/file-utils';
import { sanitizeIssueIdPart } from '../internal/version-utils';
import { detectPackageManager } from './package-manager';

type DetectionOptions = {
  subdirectory?: string;
  targetNodeVersion?: string;
};

type PackageJsonShape = {
  type?: string;
};

type SourceFinding = {
  id: string;
  title: string;
  issue: string;
  incompatibilityReason: string;
  defaultTechnicalRecommendation: string;
  evidenceSummary: string;
  commandPattern: string;
  node: Node | SourceFile;
};

function isSourceFilePath(filePath: string): boolean {
  return /\.(?:[cm]?js|[cm]?ts|jsx|tsx)$/.test(filePath);
}

function createSourceFinding(options: {
  filePath: string;
  findingKey: string;
  title: string;
  issue: string;
  incompatibilityReason: string;
  defaultTechnicalRecommendation: string;
  evidenceSummary: string;
  commandPattern: string;
  node: Node | SourceFile;
}): SourceFinding {
  return {
    id: `source-${options.findingKey}-${sanitizeIssueIdPart(options.filePath)}`,
    title: options.title,
    issue: options.issue,
    incompatibilityReason: options.incompatibilityReason,
    defaultTechnicalRecommendation: options.defaultTechnicalRecommendation,
    evidenceSummary: options.evidenceSummary,
    commandPattern: options.commandPattern,
    node: options.node
  };
}

function sourceFileUsesCommonJs(sourceFile: SourceFile): boolean {
  const text = sourceFile.getFullText();

  if (/module\.exports|(?:^|\W)exports\./m.test(text)) {
    return true;
  }

  return sourceFile
    .getDescendantsOfKind(SyntaxKind.CallExpression)
    .some((expression) => expression.getExpression().getText() === 'require');
}

function sourceFileUsesImportExport(sourceFile: SourceFile): boolean {
  return (
    sourceFile.getImportDeclarations().length > 0 ||
    sourceFile.getExportDeclarations().length > 0 ||
    sourceFile.getExportAssignments().length > 0
  );
}

function lineAndColumnForNode(node: Node | SourceFile): { line: number; column: number } {
  const sourceFile = node.getSourceFile();
  return sourceFile.getLineAndColumnAtPos(node.getStart());
}

function snippetForNode(node: Node | SourceFile): string {
  return node
    .getText()
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => line.length > 0)
    ?.slice(0, 200) ?? '';
}

function toIssue(
  repoRoot: string,
  packageManager: 'npm' | 'pnpm' | 'yarn',
  targetNodeVersion: string | undefined,
  sourceFile: SourceFile,
  finding: SourceFinding
): Issue {
  const relativePath = toRelative(repoRoot, sourceFile.getFilePath());
  const position = lineAndColumnForNode(finding.node);
  const testCommand = packageManager === 'npm' ? 'npm test' : `${packageManager} test`;
  const buildCommand =
    packageManager === 'npm' ? 'npm run build' : `${packageManager} build`;

  return {
    id: finding.id,
    category: 'source',
    title: finding.title,
    issue: finding.issue,
    incompatibilityReason: finding.incompatibilityReason,
    defaultTechnicalRecommendation: finding.defaultTechnicalRecommendation,
    alternativeSolutions: [],
    affectedFiles: [relativePath],
    evidence: [
      {
        kind: 'source',
        filePath: relativePath,
        summary: finding.evidenceSummary,
        line: position.line,
        column: position.column,
        snippet: snippetForNode(finding.node)
      }
    ],
    recommendedCommands: [
      `rg -n "${finding.commandPattern}" ${relativePath}`,
      testCommand,
      buildCommand
    ],
    validationSteps: [
      {
        title: `Validate source compatibility in ${relativePath}`,
        commands: [testCommand, buildCommand],
        expectedResult: `The package compiles and tests cleanly${targetNodeVersion ? ` on Node ${targetNodeVersion}` : ''} after resolving the flagged source pattern.`
      }
    ]
  };
}

function collectFindingsForSourceFile(
  sourceFile: SourceFile,
  isEsmContext: boolean,
  targetNodeVersion?: string
): SourceFinding[] {
  const relativePath = sourceFile.getFilePath();
  const findings: SourceFinding[] = [];
  const newBufferExpression =
    sourceFile
      .getDescendantsOfKind(SyntaxKind.NewExpression)
      .find((expression) => expression.getExpression().getText() === 'Buffer') ??
    sourceFile
      .getDescendantsOfKind(SyntaxKind.CallExpression)
      .find((expression) => expression.getExpression().getText() === 'Buffer');

  if (newBufferExpression) {
    findings.push(
      createSourceFinding({
        filePath: relativePath,
        findingKey: 'buffer-constructor',
        title: 'Legacy Buffer constructor detected',
        issue: `This file uses the legacy Buffer constructor, which is a risky source pattern to carry into a Node modernization effort${targetNodeVersion ? ` targeting Node ${targetNodeVersion}` : ''}.`,
        incompatibilityReason:
          'The legacy Buffer constructor is deprecated and can hide unsafe or ambiguous behavior during runtime upgrades.',
        defaultTechnicalRecommendation:
          'Replace Buffer constructor usage with Buffer.from() or Buffer.alloc().',
        evidenceSummary: 'Legacy Buffer constructor usage found in source.',
        commandPattern: 'Buffer\\(',
        node: newBufferExpression
      })
    );
  }

  const propertyPatterns = [
    {
      key: 'process-binding',
      text: 'process.binding',
      title: 'Internal process.binding usage detected',
      issue:
        'This file uses process.binding(), which relies on undocumented Node internals that can change across majors.',
      incompatibilityReason:
        'Undocumented Node internals are brittle across runtime upgrades and should be replaced with public APIs.',
      recommendation:
        'Replace process.binding() usage with a documented public API or isolate it behind runtime-specific guards.'
    },
    {
      key: 'require-extensions',
      text: 'require.extensions',
      title: 'require.extensions usage detected',
      issue:
        'This file mutates require.extensions, which is a fragile hook during tooling and runtime upgrades.',
      incompatibilityReason:
        'require.extensions introduces loader behavior that can break under modern Node or build-tool changes.',
      recommendation:
        'Remove require.extensions hooks and move the behavior into supported build or loader configuration.'
    },
    {
      key: 'module-parent',
      text: 'module.parent',
      title: 'module.parent usage detected',
      issue:
        'This file reads module.parent, which can behave differently across module system transitions.',
      incompatibilityReason:
        'module.parent is closely tied to CommonJS loader behavior and can become unreliable during ESM/CJS migrations.',
      recommendation:
        'Refactor module.parent checks to explicit entrypoint or dependency injection logic.'
    }
  ] as const;

  const propertyAccesses = sourceFile.getDescendantsOfKind(
    SyntaxKind.PropertyAccessExpression
  );

  for (const propertyPattern of propertyPatterns) {
    const matchingNode = propertyAccesses.find(
      (propertyAccess) => propertyAccess.getText() === propertyPattern.text
    );

    if (!matchingNode) {
      continue;
    }

    findings.push(
      createSourceFinding({
        filePath: relativePath,
        findingKey: propertyPattern.key,
        title: propertyPattern.title,
        issue: propertyPattern.issue,
        incompatibilityReason: propertyPattern.incompatibilityReason,
        defaultTechnicalRecommendation: propertyPattern.recommendation,
        evidenceSummary: `${propertyPattern.text} appears in source.`,
        commandPattern: propertyPattern.text.replace('.', '\\.'),
        node: matchingNode
      })
    );
  }

  const hasImportExport = sourceFileUsesImportExport(sourceFile);
  const hasCommonJs = sourceFileUsesCommonJs(sourceFile);

  if (hasImportExport && hasCommonJs) {
    findings.push(
      createSourceFinding({
        filePath: relativePath,
        findingKey: 'mixed-modules',
        title: 'Mixed ESM and CommonJS patterns detected',
        issue:
          'This file mixes import/export syntax with CommonJS loader patterns, which can create friction during runtime and toolchain upgrades.',
        incompatibilityReason:
          'Mixed module syntax is harder to migrate safely because runtime semantics can vary between transpilers and Node majors.',
        defaultTechnicalRecommendation:
          'Choose one module style per file and align it with the package-level module setting before the upgrade.',
        evidenceSummary: 'The file contains both ESM and CommonJS patterns.',
        commandPattern: 'require\\(|module\\.exports|exports\\.|import |export ',
        node: sourceFile
      })
    );
  }

  if (isEsmContext) {
    const esmGlobals = ['__dirname', '__filename', 'require.main'];
    const matchingGlobal = esmGlobals.find((token) =>
      sourceFile.getFullText().includes(token)
    );

    if (matchingGlobal) {
      findings.push(
        createSourceFinding({
          filePath: relativePath,
          findingKey: `esm-${matchingGlobal.replace('.', '-')}`,
          title: `CommonJS global ${matchingGlobal} used in ESM context`,
          issue: `This file appears to run in an ESM context but still references ${matchingGlobal}, which does not behave the same way as in CommonJS.`,
          incompatibilityReason:
            'CommonJS globals are not available by default in ESM modules and can break during runtime or module-system upgrades.',
          defaultTechnicalRecommendation:
            'Replace CommonJS globals with ESM-safe equivalents before the runtime cutover.',
          evidenceSummary: `${matchingGlobal} appears in an ESM-context file.`,
          commandPattern: matchingGlobal.replace('.', '\\.'),
          node: sourceFile
        })
      );
    }
  }

  return findings;
}

function sortIssues(issues: Issue[]): Issue[] {
  return [...issues].sort((left, right) => {
    return (
      left.id.localeCompare(right.id) ||
      left.affectedFiles[0].localeCompare(right.affectedFiles[0])
    );
  });
}

export async function detectSourceCompatibilityIssues(
  repoRoot: string,
  options?: DetectionOptions
): Promise<InspectSourceCompatibilityResult> {
  const analysisRoot = resolveAnalysisRoot(repoRoot, options?.subdirectory);
  const packageJson = await readJsonIfExists<PackageJsonShape>(
    path.join(analysisRoot, 'package.json')
  );
  const project = new Project({
    skipAddingFilesFromTsConfig: true,
    skipFileDependencyResolution: true,
    compilerOptions: {
      allowJs: true,
      checkJs: false,
      target: ScriptTarget.ES2022
    }
  });
  const sourceFilePaths = await walkFiles(
    analysisRoot,
    (filePath) => isSourceFilePath(filePath),
    8
  );

  if (sourceFilePaths.length === 0) {
    return {
      issues: [],
      summary: 'No JS or TS source files were found for compatibility analysis.'
    };
  }

  for (const sourceFilePath of sourceFilePaths) {
    project.addSourceFileAtPathIfExists(sourceFilePath);
  }

  const packageManager = detectPackageManager(repoRoot);
  const issues: Issue[] = [];

  for (const sourceFile of project
    .getSourceFiles()
    .sort((left, right) => left.getFilePath().localeCompare(right.getFilePath()))) {
    const extension = path.extname(sourceFile.getFilePath()).toLowerCase();
    const isEsmContext =
      packageJson?.type === 'module' || extension === '.mjs' || extension === '.mts';
    const findings = collectFindingsForSourceFile(
      sourceFile,
      isEsmContext,
      options?.targetNodeVersion
    );

    for (const finding of findings) {
      issues.push(
        toIssue(
          repoRoot,
          packageManager,
          options?.targetNodeVersion,
          sourceFile,
          finding
        )
      );
    }
  }

  const sortedIssues = sortIssues(issues);
  const summaryPrefix =
    sortedIssues.length === 0
      ? 'No source compatibility issues detected.'
      : `Detected ${sortedIssues.length} source compatibility issue(s).`;

  return {
    issues: sortedIssues,
    summary: `${summaryPrefix} Checked ${sourceFilePaths.length} source file(s) with ts-morph.`
  };
}
