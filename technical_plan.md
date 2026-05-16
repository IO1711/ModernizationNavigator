# Modernization Navigator Implementation Handoff

This document is not a brainstorm. It is the assignment-ready implementation plan for the MVP.

Use this document when you tell a developer:
- which folders to create
- which files to own
- which functions to implement
- what input and output each part must use
- what must not be changed without approval

If a developer follows this document, they should be able to start implementation without asking what goes where.

## 1. Product Summary

Modernization Navigator is a Bob-first Node.js modernization copilot.

The user opens a repo in IBM Bob, selects the `Modernization Architect` custom mode, and asks for upgrade guidance.

Bob does the user-facing work:
- asks scope questions
- decides which MCP tools to call
- compares upgrade paths
- chooses the final recommendation
- writes the final chat report

MCP does the deterministic work:
- inspects repo files
- gathers compatibility evidence
- compares technical upgrade paths
- saves the report artifact to disk
- opens the local report viewer

The MVP has two first-class outputs:
- Bob chat report
- local viewer report

## 2. Non-Negotiable Rules

Do not change these without explicit approval:

1. Bob is the decision maker.
2. MCP is the evidence and artifact layer.
3. Use local `STDIO` MCP only.
4. Use multiple small MCP tools, not one giant tool.
5. Use project-level Bob config files:
   - `.bob/mcp.json`
   - `.bob/custom_modes.yaml`
6. Save reports to:
   - `reports/latest/report.json`
   - `reports/history/<timestamp>.json`
   - `reports/index.json`
7. Do not write changes into the analyzed repo.
8. Viewer is plain HTML/CSS/JS.
9. No hosted analysis backend in MVP.

## 3. First Setup Tasks

Before assigning work to multiple developers, do these exact setup tasks first.

### 3.1 Create the repository scaffold

Create this exact folder structure:

```text
.bob/
  mcp.json
  custom_modes.yaml
  rules-modernization-architect/
    01-role.md
    02-workflow.md

apps/
  viewer/
    package.json
    index.html
    styles.css
    app.js
    viewer-config.demo.js
    sample/
      index.json
      reports/
        sample-report.json

packages/
  shared/
    package.json
    tsconfig.json
    src/
      index.ts
      schemas/
        report.ts
        tool-results.ts
        manifest.ts
      types/
        report.ts
        tools.ts
      constants/
        tool-names.ts
        report-paths.ts
      utils/
        index.ts

  mcp-server/
    package.json
    tsconfig.json
    src/
      index.ts
      report-writer.ts
      viewer-runtime.ts
      tools/
        discover-repo-scope.ts
        collect-runtime-evidence.ts
        inspect-dependency-blockers.ts
        inspect-ops-runtime.ts
        inspect-source-compatibility.ts
        compare-target-paths.ts
        save-modernization-report.ts
        open-report-viewer.ts

  analysis-engine/
    package.json
    tsconfig.json
    src/
      index.ts
      detectors/
        package-manager.ts
        runtime-evidence.ts
        dependency-blockers.ts
        ops-runtime.ts
        source-compatibility.ts
      analyzers/
      rankers/
        target-paths.ts
      report/
        merge-issues.ts

  providers/
    package.json
    tsconfig.json
    src/
      index.ts
      npm-registry-provider.ts
      osv-provider.ts
      provider-types.ts

  knowledge-base/
    package.json
    tsconfig.json
    src/
      index.ts
    data/
      node-runtime-rules.json
      package-compatibility-rules.json
      ci-runtime-rules.json
      deployment-runtime-rules.json

  viewer-server/
    package.json
    tsconfig.json
    src/
      index.ts
      server.ts
      browser-open.ts
      config.ts

reports/
  latest/
  history/
  index.json

scripts/
  sync-demo-sample.ts

package.json
tsconfig.base.json
tsconfig.json
eslint.config.js
.prettierrc
README.md
```

### 3.2 Add root workspace setup

At repo root:

1. Create this exact root `package.json`:

```json
{
  "name": "modernization-navigator",
  "version": "0.1.0",
  "private": true,
  "workspaces": ["apps/*", "packages/*"],
  "scripts": {
    "build": "tsc -b packages/shared packages/knowledge-base packages/providers packages/analysis-engine packages/viewer-server packages/mcp-server",
    "typecheck": "tsc -b --pretty",
    "lint": "eslint .",
    "test": "vitest run",
    "test:watch": "vitest",
    "viewer:serve": "node packages/viewer-server/dist/server.js",
    "viewer:demo-sync": "tsx scripts/sync-demo-sample.ts",
    "mcp:dev": "tsx packages/mcp-server/src/index.ts",
    "mcp:build": "tsc -b packages/shared packages/knowledge-base packages/providers packages/analysis-engine packages/viewer-server packages/mcp-server"
  },
  "devDependencies": {
    "@types/node": "latest",
    "eslint": "latest",
    "prettier": "latest",
    "tsx": "latest",
    "typescript": "latest",
    "vitest": "latest"
  }
}
```

2. Create this exact `tsconfig.base.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "CommonJS",
    "moduleResolution": "Node",
    "lib": ["ES2022"],
    "strict": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "esModuleInterop": true,
    "resolveJsonModule": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true
  }
}
```

3. Create this exact root `tsconfig.json`:

```json
{
  "files": [],
  "references": [
    { "path": "packages/shared" },
    { "path": "packages/knowledge-base" },
    { "path": "packages/providers" },
    { "path": "packages/analysis-engine" },
    { "path": "packages/viewer-server" },
    { "path": "packages/mcp-server" }
  ]
}
```

4. Add `eslint.config.js` and `.prettierrc`.

### 3.3 Create empty file skeletons

Create every file listed in the folder structure, even if the first version only contains:
- an exported constant
- an empty function
- a TODO comment

Reason:
- each dev needs a known file location
- imports can be wired early
- ownership is clearer

### 3.4 Create workspace package manifests

Create these package names exactly.

- `apps/viewer/package.json`
  - `"name": "@modernization-navigator/viewer-app"`
  - `"private": true`

- `packages/shared/package.json`
  - `"name": "@modernization-navigator/shared"`
  - `"private": true`
  - `"type": "commonjs"`
  - `"main": "dist/index.js"`
  - `"types": "dist/index.d.ts"`
  - `"dependencies": { "zod": "latest" }`

- `packages/knowledge-base/package.json`
  - `"name": "@modernization-navigator/knowledge-base"`
  - `"private": true`
  - `"type": "commonjs"`
  - `"main": "dist/index.js"`
  - `"types": "dist/index.d.ts"`
  - `"files": ["dist", "data"]`

- `packages/providers/package.json`
  - `"name": "@modernization-navigator/providers"`
  - `"private": true`
  - `"type": "commonjs"`
  - `"main": "dist/index.js"`
  - `"types": "dist/index.d.ts"`
  - `"dependencies": { "@modernization-navigator/shared": "workspace:*" }`

- `packages/analysis-engine/package.json`
  - `"name": "@modernization-navigator/analysis-engine"`
  - `"private": true`
  - `"type": "commonjs"`
  - `"main": "dist/index.js"`
  - `"types": "dist/index.d.ts"`
  - `"dependencies"` must include:
    - `@modernization-navigator/shared`
    - `@modernization-navigator/providers`
    - `@modernization-navigator/knowledge-base`
    - `ts-morph`
    - `yaml`

- `packages/viewer-server/package.json`
  - `"name": "@modernization-navigator/viewer-server"`
  - `"private": true`
  - `"type": "commonjs"`
  - `"main": "dist/index.js"`
  - `"types": "dist/index.d.ts"`
  - `"dependencies": { "@modernization-navigator/shared": "workspace:*" }`

- `packages/mcp-server/package.json`
  - `"name": "@modernization-navigator/mcp-server"`
  - `"private": true`
  - `"type": "commonjs"`
  - `"main": "dist/index.js"`
  - `"types": "dist/index.d.ts"`
  - `"dependencies"` must include:
    - `@modernization-navigator/shared`
    - `@modernization-navigator/analysis-engine`
    - `@modernization-navigator/viewer-server`

### 3.5 Create per-package `tsconfig.json` files

For every TypeScript package in `packages/*`, create a package-local `tsconfig.json` using this template:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "composite": true,
    "rootDir": "src",
    "outDir": "dist"
  },
  "include": ["src/**/*.ts", "src/**/*.json"]
}
```

Then add references exactly as follows:

- `packages/shared/tsconfig.json`
  - no references

- `packages/knowledge-base/tsconfig.json`
  - no references

- `packages/providers/tsconfig.json`
  - references:
    - `../shared`

- `packages/analysis-engine/tsconfig.json`
  - references:
    - `../shared`
    - `../providers`
    - `../knowledge-base`

- `packages/viewer-server/tsconfig.json`
  - references:
    - `../shared`

- `packages/mcp-server/tsconfig.json`
  - references:
    - `../shared`
    - `../analysis-engine`
    - `../viewer-server`

### 3.6 CommonJS runtime choice

All server-side workspaces use CommonJS in the MVP:
- `packages/shared`
- `packages/knowledge-base`
- `packages/providers`
- `packages/analysis-engine`
- `packages/viewer-server`
- `packages/mcp-server`

Why:
- Bob launches the MCP server with `node packages/mcp-server/dist/index.js`
- CommonJS is the lowest-risk format for this local STDIO server MVP
- do not switch to ESM / `NodeNext` during the MVP

## 4. Bob Project Configuration

This project must be runnable from Bob using project-local configuration.

### 4.1 `.bob/mcp.json`

Create `.bob/mcp.json` with this starting content:

```json
{
  "mcpServers": {
    "modernization-navigator": {
      "command": "node",
      "args": ["packages/mcp-server/dist/index.js"],
      "alwaysAllow": [
        "discover_repo_scope",
        "collect_runtime_evidence",
        "inspect_dependency_blockers",
        "inspect_ops_runtime",
        "inspect_source_compatibility",
        "compare_target_paths",
        "save_modernization_report",
        "open_report_viewer"
      ]
    }
  }
}
```

Notes:
- This is project-level config for Bob.
- If Bob does not resolve the relative path cleanly on a developer machine, add `cwd` pointing to the repo root for local setup.
- Do not add secrets here.

### 4.2 `.bob/custom_modes.yaml`

Create `.bob/custom_modes.yaml` with this starting content:

```yaml
customModes:
  - slug: modernization-architect
    name: Modernization Architect
    roleDefinition: You are a Node.js modernization architect. You use MCP tools to gather evidence, compare upgrade paths, and recommend the best migration strategy for this repository.
    whenToUse: Use for Node.js runtime upgrade planning, dependency blocker analysis, CI/runtime compatibility checks, and phased modernization planning.
    customInstructions: Follow the rules in .bob/rules-modernization-architect/.
    groups:
      - read
      - edit
      - command
      - mcp
```

### 4.3 `.bob/rules-modernization-architect/01-role.md`

Create this exact file content:

```md
# Modernization Architect Role

You are the modernization architect for this repository.

Your job is to:
- ask for missing scope when it affects the recommendation
- choose which MCP tools to call
- compare direct and staged upgrade paths when needed
- choose the final migration recommendation
- write the final user-facing report in chat

Rules:
- Do not ask MCP to write the final recommendation for you.
- Use MCP only to gather evidence, compare technical paths, save the report, and open the viewer.
- If the target Node version is missing, ask for it before analysis.
- If the repo is a monorepo and no subdirectory is specified, ask whether to analyze the whole repo or one subproject.
- If multiple upgrade paths seem plausible, call `compare_target_paths` before making a final recommendation.
- Cite MCP evidence in your final recommendation.
- Do not invent package replacements outside the current package ecosystem.
- Do not promise code patches in the MVP.
```

### 4.4 `.bob/rules-modernization-architect/02-workflow.md`

Create this exact file content:

```md
# Modernization Architect Workflow

Follow this workflow in order:

1. Gather missing scope.
   - Ask for `targetNodeVersion` if missing.
   - Ask for `subdirectory` only if the repo is a monorepo and the request is ambiguous.
   - Ask whether the user wants the safest path or fastest path only if it changes the recommendation.

2. Call evidence tools.
   - Start with `discover_repo_scope`.
   - Then call `collect_runtime_evidence`.
   - Then call `inspect_dependency_blockers`.

3. Decide whether more evidence is needed.
   - Call `inspect_ops_runtime` if CI, Docker, or deployment configuration matters.
   - Call `inspect_source_compatibility` if source-level compatibility risk is likely.
   - Call `compare_target_paths` if both direct and staged upgrade paths are plausible.

4. Choose the migration path.
   - Recommend the best path for this repo and this user request.
   - Use MCP evidence, not guesses.

5. Save the final report.
   - Call `save_modernization_report` with the normalized report object.

6. Open the report viewer.
   - Call `open_report_viewer` with the saved report path.

7. Write the final chat report using this order:
   - current state summary
   - key blockers
   - recommended path
   - implementation order
   - validation checklist
```

## 5. MCP Transport Protocol

The MCP server must use:
- local `STDIO` transport
- JSON-RPC 2.0 messages
- newline-delimited message exchange over `stdin` and `stdout`

Behavior:
1. Bob starts the MCP server as a child process.
2. Bob sends tool calls over `stdin`.
3. The server responds over `stdout`.
4. The server exposes exactly the tools listed in this document.

Do not implement:
- remote HTTP transport
- SSE transport
- browser-only analysis

## 6. Tool Names and Ownership

These tool names are fixed. Do not rename them.

1. `discover_repo_scope`
2. `collect_runtime_evidence`
3. `inspect_dependency_blockers`
4. `inspect_ops_runtime`
5. `inspect_source_compatibility`
6. `compare_target_paths`
7. `save_modernization_report`
8. `open_report_viewer`

Rule:
- each file in `packages/mcp-server/src/tools/` owns exactly one tool
- one file = one tool

## 7. Shared Contracts Package

Everything that multiple packages depend on must be defined here first.

Folder:
- `packages/shared/src/`

### 7.1 `constants/tool-names.ts`

Create:
- `TOOL_NAMES` array
- one exported string constant per tool name

Example:

```ts
export const DISCOVER_REPO_SCOPE = "discover_repo_scope";
export const COLLECT_RUNTIME_EVIDENCE = "collect_runtime_evidence";
export const INSPECT_DEPENDENCY_BLOCKERS = "inspect_dependency_blockers";
export const INSPECT_OPS_RUNTIME = "inspect_ops_runtime";
export const INSPECT_SOURCE_COMPATIBILITY = "inspect_source_compatibility";
export const COMPARE_TARGET_PATHS = "compare_target_paths";
export const SAVE_MODERNIZATION_REPORT = "save_modernization_report";
export const OPEN_REPORT_VIEWER = "open_report_viewer";
```

### 7.2 `constants/report-paths.ts`

Create exported constants:
- `LATEST_REPORT_PATH`
- `HISTORY_REPORTS_DIR`
- `REPORT_INDEX_PATH`

### 7.3 `schemas/tool-results.ts`

Create `zod` schemas and inferred TypeScript types for all MCP tool inputs and outputs.

Define these base types:

```ts
type BaseToolInput = {
  repoRoot: string;
  subdirectory?: string;
  targetNodeVersion?: string;
  offline?: boolean;
};
```

Create these result shapes:

```ts
type DiscoverRepoScopeResult = {
  repoRoot: string;
  subdirectory?: string;
  detectedPackageManager: "npm" | "pnpm" | "yarn";
  workspaceType: "single" | "monorepo";
  candidateProjects: string[];
};

type CollectRuntimeEvidenceResult = {
  runtimeEvidence: Array<{
    source: string;
    filePath: string;
    value: string;
    kind:
      | "engines"
      | "nvmrc"
      | "node-version"
      | "docker"
      | "github-actions"
      | "deployment"
      | "script";
  }>;
};

type InspectDependencyBlockersResult = {
  issues: Issue[];
  summary: string;
};

type InspectOpsRuntimeResult = {
  issues: Issue[];
  summary: string;
};

type InspectSourceCompatibilityResult = {
  issues: Issue[];
  summary: string;
};

type CompareTargetPathsResult = {
  comparedPaths: Array<{
    label: string;
    targetVersion: string;
    riskScore: number;
    effortScore: number;
    blockers: string[];
  }>;
  recommendedPathCandidate: string;
};

type SaveModernizationReportInput = {
  report: Report;
};

type SaveModernizationReportResult = {
  reportId: string;
  reportPath: string;
  historyPath: string;
};

type OpenReportViewerInput = {
  reportPath: string;
  autoOpenViewer?: boolean;
};

type OpenReportViewerResult = {
  viewerUrl: string;
  serverStatus: "started" | "reused";
};
```

Viewer URL rule:
- the local viewer must default to port `4173`
- if `VIEWER_PORT` is set, use that instead
- returned URL shape must be `http://127.0.0.1:<port>/`

### 7.4 `schemas/report.ts`

Create `reportSchema` and nested schemas.

Top-level report must contain:
- `reportId`
- `createdAt`
- `repoRoot`
- `subdirectory`
- `requestedTargetNodeVersion`
- `evaluatedTargetNodeVersions`
- `detectedPackageManager`
- `offlineMode`
- `externalDataStatus`
- `toolTrace`
- `runtimeEvidence`
- `issues`
- `bobDecision`
- `bobExecutionPlan`
- `validationChecklist`

### 7.5 `schemas/manifest.ts`

Create `reportManifestSchema`.

Use this shape:

```ts
type ReportManifest = {
  latestReportPath: string;
  history: Array<{
    reportId: string;
    createdAt: string;
    reportPath: string;
    requestedTargetNodeVersion: string;
    subdirectory?: string;
  }>;
};
```

### 7.6 `types/report.ts` and `types/tools.ts`

Export the inferred TypeScript types from the schemas.

Rule:
- do not define duplicate types by hand if they already come from `zod`

## 8. Shared Report and Issue Model

Every package must use the same issue model.

### 8.1 `Issue`

Each issue must include:
- `id`
- `category`
- `title`
- `issue`
- `incompatibilityReason`
- `defaultTechnicalRecommendation`
- `alternativeSolutions`
- `affectedFiles`
- `evidence`
- `recommendedCommands`
- `validationSteps`

Use this exact TypeScript shape:

```ts
type AlternativeSolution = {
  rank: number;
  title: string;
  summary: string;
  targetVersionRange: string;
  rationale: string;
  tradeoffs: string[];
  commands: string[];
};

type EvidenceItem = {
  kind:
    | "package"
    | "lockfile"
    | "docker"
    | "github-actions"
    | "deployment"
    | "script"
    | "source";
  filePath: string;
  summary: string;
  line?: number;
  column?: number;
  packageName?: string;
  configKey?: string;
  snippet?: string;
  source?: string;
};

type ValidationStep = {
  title: string;
  commands: string[];
  expectedResult: string;
};

type Issue = {
  id: string;
  category:
    | "runtime"
    | "dependency"
    | "ci"
    | "docker"
    | "deployment"
    | "script"
    | "source";
  title: string;
  issue: string;
  incompatibilityReason: string;
  defaultTechnicalRecommendation: string;
  alternativeSolutions: AlternativeSolution[];
  affectedFiles: string[];
  evidence: EvidenceItem[];
  recommendedCommands: string[];
  validationSteps: ValidationStep[];
};
```

### 8.1.1 `RuntimeEvidenceEntry`

Use this exact shape:

```ts
type RuntimeEvidenceEntry = {
  source: string;
  filePath: string;
  value: string;
  kind:
    | "engines"
    | "nvmrc"
    | "node-version"
    | "docker"
    | "github-actions"
    | "deployment"
    | "script";
};
```

### 8.1.2 `ExternalDataStatus`

Use this exact shape:

```ts
type ExternalDataStatus = {
  npmRegistry: "used" | "skipped_offline" | "error";
  osv: "used" | "skipped_offline" | "error";
  notes: string[];
};
```

### 8.2 `ToolTraceEntry`

Each saved report must store a tool trace entry with:
- `toolName`
- `purpose`
- `status`
- `startedAt`
- `finishedAt`
- `resultSummary`

Use this exact shape:

```ts
type ToolTraceEntry = {
  toolName: string;
  purpose: string;
  status: "success" | "error" | "skipped";
  startedAt: string;
  finishedAt: string;
  resultSummary: string;
};
```

Rule for MVP:
- keep `toolTrace` concise
- do not save separate raw per-tool payload files
- do not create a separate debug payload directory in the MVP

### 8.3 `BobDecision`

Each saved report must store:
- `summary`
- `selectedTargetPath`
- `rationale`
- `prioritizedRisks`
- `chosenSolutions`
- `tradeoffs`

Use this exact shape:

```ts
type BobDecision = {
  summary: string;
  selectedTargetPath: string;
  rationale: string;
  prioritizedRisks: string[];
  chosenSolutions: string[];
  tradeoffs: string[];
};
```

### 8.4 `BobExecutionPlan`

Each plan item must store:
- `phase`
- `order`
- `title`
- `actions`
- `dependsOn`
- `validation`

Use this exact shape:

```ts
type BobExecutionPlanItem = {
  phase: string;
  order: number;
  title: string;
  actions: string[];
  dependsOn: string[];
  validation: string[];
};
```

### 8.5 `ValidationChecklist`

Use this exact shape:

```ts
type ValidationChecklistItem = {
  title: string;
  commands: string[];
  expectedResult: string;
};
```

### 8.6 `Report`

Use this exact shape for the normalized saved report:

```ts
type Report = {
  reportId: string;
  createdAt: string;
  repoRoot: string;
  subdirectory?: string;
  requestedTargetNodeVersion: string;
  evaluatedTargetNodeVersions: string[];
  detectedPackageManager: "npm" | "pnpm" | "yarn";
  offlineMode: boolean;
  externalDataStatus: ExternalDataStatus;
  toolTrace: ToolTraceEntry[];
  runtimeEvidence: RuntimeEvidenceEntry[];
  issues: Issue[];
  bobDecision: BobDecision;
  bobExecutionPlan: BobExecutionPlanItem[];
  validationChecklist: ValidationChecklistItem[];
};
```

## 9. MCP Server Package

Folder:
- `packages/mcp-server/src/`

This package is responsible for:
- starting the MCP server
- registering tools
- validating inputs
- calling analysis functions
- saving reports
- opening the viewer

This package is not responsible for:
- Bob decision logic
- rendering the viewer UI
- writing into the analyzed repo

### 9.1 `index.ts`

Implement:
- MCP server bootstrap
- tool registration
- process startup

Export or wire:
- server creation
- tool definitions for all 8 tools

### 9.2 `report-writer.ts`

Implement:
- `buildReportId()`
- `writeLatestReport(report)`
- `writeHistoryReport(report)`
- `updateReportManifest(entry)`

This file writes to:
- `reports/latest/report.json`
- `reports/history/<timestamp>.json`
- `reports/index.json`

### 9.3 `viewer-runtime.ts`

Implement:
- `ensureViewerServerRunning()`
- `openViewer(reportPath, autoOpenViewer)`

This file should call into `packages/viewer-server/src/`.

### 9.4 `tools/discover-repo-scope.ts`

Implement:
- input validation
- workspace detection
- package manager detection
- selected subdirectory handling

Export function:

```ts
export async function discoverRepoScope(
  input: BaseToolInput
): Promise<DiscoverRepoScopeResult>
```

### 9.5 `tools/collect-runtime-evidence.ts`

Implement:
- read `package.json`
- read `.nvmrc`
- read `.node-version`
- inspect Docker base image tags
- inspect GitHub Actions `setup-node`
- inspect deployment config
- inspect script-level Node references

Export function:

```ts
export async function collectRuntimeEvidence(
  input: BaseToolInput
): Promise<CollectRuntimeEvidenceResult>
```

### 9.6 `tools/inspect-dependency-blockers.ts`

Implement:
- read manifest and lockfiles
- call provider layer
- create dependency issues

Export function:

```ts
export async function inspectDependencyBlockers(
  input: BaseToolInput
): Promise<InspectDependencyBlockersResult>
```

### 9.7 `tools/inspect-ops-runtime.ts`

Implement:
- CI runtime checks
- Docker runtime checks
- deployment config runtime checks

Export function:

```ts
export async function inspectOpsRuntime(
  input: BaseToolInput
): Promise<InspectOpsRuntimeResult>
```

### 9.8 `tools/inspect-source-compatibility.ts`

Implement:
- JS/TS AST checks using `ts-morph`
- source-level Node API compatibility checks
- ESM/CJS friction detection

Export function:

```ts
export async function inspectSourceCompatibility(
  input: BaseToolInput
): Promise<InspectSourceCompatibilityResult>
```

### 9.9 `tools/compare-target-paths.ts`

Implement:
- compare direct upgrade path
- compare staged upgrade path when applicable
- calculate:
  - `riskScore`
  - `effortScore`
  - blocker counts

Export function:

```ts
export async function compareTargetPaths(
  input: BaseToolInput
): Promise<CompareTargetPathsResult>
```

### 9.10 `tools/save-modernization-report.ts`

Implement:
- validate full report input
- call `report-writer.ts`
- return persisted file paths

Export function:

```ts
export async function saveModernizationReport(
  input: SaveModernizationReportInput
): Promise<SaveModernizationReportResult>
```

### 9.11 `tools/open-report-viewer.ts`

Implement:
- ensure local viewer server is running
- optionally open browser
- return viewer URL

Export function:

```ts
export async function openReportViewer(
  input: OpenReportViewerInput
): Promise<OpenReportViewerResult>
```

## 10. Analysis Engine Package

Folder:
- `packages/analysis-engine/src/`

This package contains pure analysis logic and should not know about Bob.

### 10.1 `detectors/package-manager.ts`

Implement:
- `detectPackageManager(repoRoot): "npm" | "pnpm" | "yarn"`

Detection order:
1. lockfile
2. workspace config
3. `packageManager` field
4. fallback to `npm`

### 10.2 `detectors/runtime-evidence.ts`

Implement:
- functions that collect runtime declarations from files

### 10.3 `detectors/dependency-blockers.ts`

Implement:
- dependency compatibility checks
- same-ecosystem upgrade options only

### 10.4 `detectors/ops-runtime.ts`

Implement:
- Docker runtime checks
- GitHub Actions runtime checks
- deployment config runtime checks

### 10.5 `detectors/source-compatibility.ts`

Implement:
- `ts-morph` based source checks
- deprecated API detection
- module system friction checks

### 10.6 `rankers/target-paths.ts`

Implement:
- score direct path
- score staged path
- use:
  - compatibility
  - implementation effort
  - source/config churn
  - vulnerability exposure
  - confidence of repo evidence

## 11. Providers Package

Folder:
- `packages/providers/src/`

This package owns external metadata access.

### 11.1 `provider-types.ts`

Define interfaces for:
- `NpmRegistryProvider`
- `OsvProvider`

### 11.2 `npm-registry-provider.ts`

Implement:
- fetch npm metadata
- return typed results
- handle offline mode by skipping calls

### 11.3 `osv-provider.ts`

Implement:
- fetch OSV vulnerability data
- return typed results
- handle offline mode by skipping calls

Rule:
- network errors must not crash the full analysis

## 12. Knowledge Base Package

Folder:
- `packages/knowledge-base/data/`

Create and maintain:
- `node-runtime-rules.json`
- `package-compatibility-rules.json`
- `ci-runtime-rules.json`
- `deployment-runtime-rules.json`

Each rule entry must contain:
- match conditions
- incompatibility reason
- default technical recommendation
- optional ranked alternatives
- evidence hints

## 13. Viewer Server Package

Folder:
- `packages/viewer-server/src/`

### 13.1 `server.ts`

Implement:
- `startViewerServer()`
- serve static viewer assets
- serve report JSON files
- serve runtime config if needed

### 13.2 `browser-open.ts`

Implement:
- open browser on:
  - macOS
  - Linux
  - Windows

### 13.3 `config.ts`

Implement:
- viewer server config
- local port definition
- path resolution helpers

Use these exact rules:
- default port: `4173`
- override port with `process.env.VIEWER_PORT`
- bind to `127.0.0.1`
- generate viewer URL as `http://127.0.0.1:<port>/`

## 14. Viewer App

Folder:
- `apps/viewer/`

This app renders saved report artifacts.

### 14.1 `index.html`

Must contain sections for:
- Bob recommendation
- evaluated target paths
- issues
- evidence
- execution plan
- validation checklist
- tool trace
- history selector

### 14.2 `styles.css`

Style the viewer for:
- desktop
- laptop
- clean judge demo

### 14.3 `app.js`

Implement:
- load `reports/index.json`
- load latest report by default
- render report sections
- switch history entries

### 14.4 `viewer-config.demo.js`

Implement:
- sample-data mode for hosted demo viewer

## 15. Saved Artifact Rules

### 15.1 Files to write

Always write:
- `reports/latest/report.json`
- `reports/history/<timestamp>.json`
- `reports/index.json`

### 15.2 What the saved report must contain

The saved report must contain both:
- MCP evidence
- Bob's chosen decision and execution plan

This is important:
- MCP is not only a scanner
- Bob is not only a UI
- the saved artifact must preserve both layers

### 15.3 One normalized report only

For the MVP, save only:
- one normalized final report JSON
- one concise `toolTrace` inside that report
- one report manifest

Do not save:
- raw per-tool payload files
- separate debug payload directories
- duplicate report formats

## 16. Developer Assignment Plan

Use this exact split for 4 developers.

### Dev 1: Bob + MCP Orchestration

Own these paths:
- `.bob/*`
- `packages/mcp-server/*`

Exact files to implement first:
- `.bob/mcp.json`
- `.bob/custom_modes.yaml`
- `.bob/rules-modernization-architect/01-role.md`
- `.bob/rules-modernization-architect/02-workflow.md`
- `packages/mcp-server/src/index.ts`
- `packages/mcp-server/src/report-writer.ts`
- `packages/mcp-server/src/viewer-runtime.ts`
- `packages/mcp-server/src/tools/discover-repo-scope.ts`
- `packages/mcp-server/src/tools/save-modernization-report.ts`
- `packages/mcp-server/src/tools/open-report-viewer.ts`

Build:
- project Bob config
- custom mode
- MCP tool registration
- report save flow
- viewer open flow

Exact tasks:
1. Configure `.bob/mcp.json` so Bob can launch `packages/mcp-server/dist/index.js`.
2. Configure `.bob/custom_modes.yaml` with the `modernization-architect` mode.
3. Write Bob rules files so Bob:
   - asks for missing scope
   - calls MCP tools adaptively
   - saves the report
   - opens the viewer
   - writes the final chat report
4. In `packages/mcp-server/src/index.ts`, register all 8 MCP tools.
5. In `report-writer.ts`, implement latest-report write, history-report write, and manifest update.
6. In `viewer-runtime.ts`, implement local viewer startup and browser-open flow.
7. Implement the three orchestration-side tools first:
   - `discover_repo_scope`
   - `save_modernization_report`
   - `open_report_viewer`
8. Wire validation to shared `zod` schemas from `packages/shared`.

Do not build:
- deep repo scanning logic
- viewer rendering

Done when:
- Bob can see all 8 tools
- tool validation works
- save and open flows work

### Dev 2: Evidence Engine

Own these paths:
- `packages/analysis-engine/*`
- `packages/providers/*`
- `packages/knowledge-base/*`

Exact files to implement first:
- `packages/analysis-engine/src/detectors/package-manager.ts`
- `packages/analysis-engine/src/detectors/runtime-evidence.ts`
- `packages/analysis-engine/src/detectors/dependency-blockers.ts`
- `packages/analysis-engine/src/detectors/ops-runtime.ts`
- `packages/analysis-engine/src/detectors/source-compatibility.ts`
- `packages/analysis-engine/src/rankers/target-paths.ts`
- `packages/providers/src/provider-types.ts`
- `packages/providers/src/npm-registry-provider.ts`
- `packages/providers/src/osv-provider.ts`
- `packages/knowledge-base/data/*.json`

Build:
- runtime evidence collection
- dependency blocker analysis
- ops/runtime analysis
- source compatibility analysis
- target path comparison

Exact tasks:
1. Implement package manager detection with the required precedence order.
2. Implement runtime evidence extraction from:
   - `package.json`
   - `.nvmrc`
   - `.node-version`
   - Docker files
   - GitHub Actions workflows
   - deployment config
   - scripts
3. Implement dependency blocker analysis using manifests, lockfiles, providers, and knowledge-base rules.
4. Implement ops/runtime mismatch detection for CI, Docker, and deployment config.
5. Implement source-level compatibility checks with `ts-morph`.
6. Implement target-path comparison with:
   - direct path
   - staged path
   - `riskScore`
   - `effortScore`
7. Implement provider interfaces and offline-safe provider behavior.
8. Keep outputs deterministic and shaped exactly like shared schemas.

Do not build:
- Bob config
- viewer UI

Done when:
- all evidence tools can return deterministic outputs
- offline mode is supported

### Dev 3: Viewer

Own these paths:
- `apps/viewer/*`
- `packages/viewer-server/*`

Exact files to implement first:
- `packages/viewer-server/src/server.ts`
- `packages/viewer-server/src/browser-open.ts`
- `packages/viewer-server/src/config.ts`
- `apps/viewer/index.html`
- `apps/viewer/styles.css`
- `apps/viewer/app.js`
- `apps/viewer/viewer-config.demo.js`

Build:
- local viewer server
- viewer rendering
- history selector
- Bob recommendation section
- tool trace section

Exact tasks:
1. In `server.ts`, serve:
   - viewer static files
   - `reports/latest/report.json`
   - `reports/history/*.json`
   - `reports/index.json`
2. In `browser-open.ts`, implement browser-open behavior for macOS, Linux, and Windows.
3. In `config.ts`, define local port and report-path resolution helpers.
4. In `apps/viewer/index.html`, create containers for:
   - Bob recommendation
   - evaluated target paths
   - issues
   - evidence
   - execution plan
   - validation checklist
   - tool trace
   - history selector
5. In `apps/viewer/app.js`, implement:
   - manifest loading
   - latest report loading
   - history switching
   - section rendering
6. In `viewer-config.demo.js`, support hosted sample-data mode.

Do not build:
- analysis logic
- Bob custom mode

Done when:
- latest report loads
- history switching works
- viewer shows Bob recommendation and MCP evidence clearly

### Dev 4: Shared Contracts + Tests

Own these paths:
- `packages/shared/*`
- test fixtures
- report snapshots
- schema and integration tests

Exact files to implement first:
- `packages/shared/src/schemas/report.ts`
- `packages/shared/src/schemas/tool-results.ts`
- `packages/shared/src/schemas/manifest.ts`
- `packages/shared/src/types/report.ts`
- `packages/shared/src/types/tools.ts`
- `packages/shared/src/constants/tool-names.ts`
- `packages/shared/src/constants/report-paths.ts`

Build:
- `zod` schemas
- shared types
- tool name constants
- report path constants
- fixture and snapshot tests

Exact tasks:
1. Define all shared schemas before other devs implement logic against them.
2. Export inferred TypeScript types from schemas.
3. Create tool-name constants and report-path constants.
4. Add fixture data for:
   - npm repo
   - pnpm repo
   - yarn repo
   - Docker mismatch
   - CI mismatch
   - source compatibility mismatch
5. Add report snapshot tests for saved artifacts.
6. Add schema validation tests so all teams can rely on stable contracts.

Do not build:
- final analysis logic
- viewer styling

Done when:
- schemas compile
- snapshots are stable
- other devs can import contracts without redefining them

## 17. Implementation Sequence

Do these steps in order.

### Step 1

Create the full folder/file scaffold and root workspace setup.

Actual work:
1. Create every folder listed in Section 3.
2. Create every file listed in Section 3.
3. Add root workspace `package.json`.
4. Add root TypeScript, ESLint, and Prettier config.

### Step 2

Implement `packages/shared` contracts first.

Actual work:
1. Define tool input/output schemas.
2. Define report schema.
3. Define report manifest schema.
4. Export constants and inferred types.
5. Do not let other devs invent their own local copies of these types.

### Step 3

Implement Bob config and MCP server skeleton.

Actual work:
1. Create `.bob/mcp.json`.
2. Create `.bob/custom_modes.yaml`.
3. Create Bob rules files.
4. Register all 8 tools in `packages/mcp-server/src/index.ts`.
5. Stub each tool file with the correct exported function.

### Step 4

Implement evidence engine and provider logic.

Actual work:
1. Implement package manager detection.
2. Implement runtime evidence detector.
3. Implement dependency blocker detector.
4. Implement ops/runtime detector.
5. Implement source compatibility detector.
6. Implement provider fetchers and offline behavior.
7. Implement target path ranking.

### Step 5

Implement report writing and viewer server.

Actual work:
1. Implement latest report write.
2. Implement history report write.
3. Implement manifest update.
4. Implement local viewer server.
5. Implement browser-open helper.

### Step 6

Implement viewer UI against saved report files.

Actual work:
1. Build viewer layout.
2. Render Bob recommendation.
3. Render issues and evidence.
4. Render tool trace and history selector.
5. Load reports from the local manifest.

### Step 7

Wire Bob mode to use the MCP tools and save/open the final report.

Actual work:
1. Make Bob ask missing questions.
2. Make Bob call evidence tools.
3. Make Bob call comparison tool when needed.
4. Make Bob choose the final path.
5. Make Bob call `save_modernization_report`.
6. Make Bob call `open_report_viewer`.

### Step 8

Add fixture tests and sample demo data.

Actual work:
1. Add fixture repos and sample report data.
2. Add schema tests.
3. Add snapshot tests.
4. Add viewer render tests.

## 18. Meaning of "Create the Repo Scaffold"

This replaces the vague wording "freeze folder structure."

What it means in practice:
- create the agreed folders now
- create the agreed files now
- do not move files to different packages after work is assigned
- do not rename MCP tools after work is assigned
- do not rename report fields after work is assigned

Why:
- each dev needs a stable home for their work
- imports, schemas, and ownership depend on these paths
- moving files after parallel work starts creates merge conflicts and broken assumptions

## 19. Final Acceptance Criteria

The MVP is ready when:

1. Bob can run the `Modernization Architect` mode in the project.
2. Bob can call the MCP toolbox locally through `STDIO`.
3. MCP tools return structured evidence.
4. Bob chooses the final migration path and writes the final chat report.
5. The saved artifact contains both evidence and Bob's chosen plan.
6. The viewer opens locally and renders the saved report correctly.
7. Hosted demo viewer can show committed sample data without live analysis.
