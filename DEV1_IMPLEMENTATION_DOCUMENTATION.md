# Dev 1 Implementation Documentation
## Bob + MCP Orchestration Layer

**Developer:** Dev 1  
**Responsibility:** Bob configuration and MCP server orchestration  
**Date:** May 16, 2026  
**Status:** Complete (Tasks 1-9)

---

## Overview

Dev 1 was responsible for implementing the Bob AI agent configuration and the Model Context Protocol (MCP) server that orchestrates the modernization analysis workflow. This layer acts as the bridge between Bob (the AI assistant) and the analysis engine, enabling Bob to intelligently guide users through Node.js modernization planning.

---

## What Was Built

### 1. Bob Project Configuration (`.bob/` directory)

#### 1.1 MCP Server Registration (`.bob/mcp.json`)
**Purpose:** Configures Bob to launch and communicate with the modernization-navigator MCP server.

**Key Features:**
- Registers the `modernization-navigator` MCP server
- Specifies the command to launch the server: `node packages/mcp-server/dist/index.js`
- Pre-authorizes all 8 MCP tools in the `alwaysAllow` list to avoid permission prompts
- Enables seamless tool invocation during analysis sessions

**Tool Names Registered:**
1. `discover_repo_scope`
2. `collect_runtime_evidence`
3. `inspect_dependency_blockers`
4. `inspect_ops_runtime`
5. `inspect_source_compatibility`
6. `compare_target_paths`
7. `save_modernization_report`
8. `open_report_viewer`

#### 1.2 Custom Mode Definition (`.bob/custom_modes.yaml`)
**Purpose:** Defines the "Modernization Architect" mode that Bob can switch into for modernization tasks.

**Key Features:**
- **Mode Name:** Modernization Architect
- **Role Definition:** Positions Bob as a Node.js modernization architect who uses MCP tools to gather evidence and recommend migration strategies
- **When to Use:** Specified for Node.js runtime upgrades, dependency analysis, CI/runtime compatibility checks, and phased modernization planning
- **Custom Instructions:** Points to detailed rules in `.bob/rules-modernization-architect/`
- **Enabled Groups:** read, edit, command, and mcp (full toolset access)

#### 1.3 Role Definition (`.bob/rules-modernization-architect/01-role.md`)
**Purpose:** Defines Bob's responsibilities and constraints when acting as a modernization architect.

**Key Responsibilities:**
- Ask for missing scope information (target Node version, subdirectory)
- Choose which MCP tools to call based on the analysis needs
- Compare direct vs staged upgrade paths when both are viable
- Make the final migration recommendation
- Write the user-facing report in chat

**Critical Rules:**
- Bob must NOT ask MCP to write the final recommendation (Bob owns the decision)
- MCP is only for gathering evidence, comparing paths, saving reports, and opening the viewer
- Must ask for target Node version if missing
- Must clarify monorepo scope if ambiguous
- Must call `compare_target_paths` when multiple upgrade paths are plausible
- Must cite MCP evidence in recommendations
- Cannot invent package replacements outside the ecosystem
- Cannot promise code patches in the MVP

#### 1.4 Workflow Definition (`.bob/rules-modernization-architect/02-workflow.md`)
**Purpose:** Provides a step-by-step workflow that Bob must follow during modernization analysis.

**Workflow Steps:**
1. **Gather Missing Scope**
   - Ask for `targetNodeVersion` if not provided
   - Ask for `subdirectory` only if repo is a monorepo and request is ambiguous
   - Ask about preference (safest vs fastest path) only if it changes the recommendation

2. **Call Evidence Tools**
   - Start with `discover_repo_scope`
   - Then `collect_runtime_evidence`
   - Then `inspect_dependency_blockers`

3. **Decide on Additional Evidence**
   - Call `inspect_ops_runtime` if CI/Docker/deployment matters
   - Call `inspect_source_compatibility` if source-level risk is likely
   - Call `compare_target_paths` if both direct and staged paths are plausible

4. **Choose Migration Path**
   - Recommend the best path using MCP evidence, not guesses

5. **Save the Report**
   - Call `save_modernization_report` with the normalized report object

6. **Open the Viewer**
   - Call `open_report_viewer` with the saved report path

7. **Write Final Chat Report**
   - Current state summary
   - Key blockers
   - Recommended path
   - Implementation order
   - Validation checklist

---

### 2. MCP Server Implementation (`packages/mcp-server/src/`)

#### 2.1 Server Entry Point (`index.ts`)
**Purpose:** Main MCP server that speaks JSON-RPC 2.0 over STDIO with Bob.

**Key Features:**
- **Transport:** STDIO-based JSON-RPC 2.0 communication
- **Strict Rule:** Nothing written to stdout except JSON-RPC frames (all logs go to stderr)
- **Tool Registration:** Registers all 8 tools with their schemas and handlers
- **Schema Conversion:** Uses `zod-to-json-schema` to convert Zod schemas to JSON Schema for Bob
- **Error Handling:** Catches tool failures and returns structured error responses

**Tool Definitions:**
Each tool is registered with:
- **name:** The exact tool name from shared constants
- **description:** What the tool does and when to use it
- **inputSchema:** Zod schema for input validation
- **handler:** Async function that executes the tool logic

**Request Handlers:**
- `ListToolsRequestSchema`: Returns list of available tools with their schemas
- `CallToolRequestSchema`: Executes a tool with provided arguments and returns results

#### 2.2 Report Writer (`report-writer.ts`)
**Purpose:** Handles all report persistence operations with atomic writes and manifest updates.

**Key Functions:**

**`buildReportId(now?: Date): string`**
- Generates ISO 8601-based report IDs
- Format: `YYYYMMDDTHHmmssZ` (e.g., `20260516T084320Z`)
- Ensures unique, sortable identifiers

**`writeLatestReport(report: Report): Promise<string>`**
- Writes report to `reports/latest/report.json`
- Overwrites previous latest report
- Returns the relative path to the written file
- Creates parent directories if needed

**`writeHistoryReport(report: Report): Promise<string>`**
- Writes report to `reports/history/<reportId>.json`
- Preserves historical reports permanently
- Returns the relative path to the written file
- Uses report's own `reportId` for the filename

**`updateReportManifest(entry: ManifestEntry): Promise<ReportManifest>`**
- Updates `reports/index.json` with new report metadata
- Adds new entry to the beginning of history array
- Removes duplicate entries (same reportId)
- Maintains the `latestReportPath` reference
- Returns the updated manifest

**Implementation Details:**
- All file operations use `fs/promises` for async I/O
- JSON files are formatted with 2-space indentation and trailing newline
- Parent directories are created recursively as needed
- Manifest reads are safe (returns default if file doesn't exist)
- All paths are resolved relative to `process.cwd()`

#### 2.3 Viewer Runtime (`viewer-runtime.ts`)
**Purpose:** Manages the local viewer server lifecycle and browser opening.

**Key Functions:**

**`ensureViewerServerRunning(): Promise<{viewerUrl, serverStatus}>`**
- Starts the viewer server if not already running
- Reuses existing server if already started
- Returns the viewer URL (e.g., `http://127.0.0.1:4173/`)
- Returns status: `'started'` or `'reused'`

**`openViewer(reportPath, autoOpenViewer?): Promise<{viewerUrl, serverStatus}>`**
- Validates that the report file exists
- Ensures the viewer server is running
- Optionally opens the browser to the viewer URL
- Handles both absolute and relative report paths
- Throws error if report path doesn't exist

**Integration:**
- Uses `@modernization-navigator/viewer-server` package for server management
- Uses cross-platform browser opening logic
- Supports both automatic and manual browser opening modes

---

### 3. MCP Tool Implementations

#### 3.1 Discover Repo Scope (`tools/discover-repo-scope.ts`)
**Purpose:** Detects workspace structure, package manager, and candidate projects.

**What It Does:**
- Scans the repository for `package.json` files (up to 4 levels deep)
- Detects the package manager (npm, pnpm, yarn, or bun)
- Determines if the repo is a monorepo or single project
- Returns a list of candidate projects (directories with package.json)
- Skips `node_modules`, `.git`, and `dist` directories

**Input Schema:** `BaseToolInput` (repoRoot, subdirectory, targetNodeVersion)

**Output Schema:** `DiscoverRepoScopeResult`
```typescript
{
  repoRoot: string;
  subdirectory?: string;
  detectedPackageManager: 'npm' | 'pnpm' | 'yarn' | 'bun';
  workspaceType: 'single' | 'monorepo';
  candidateProjects: string[];
}
```

**Workspace Type Detection:**
- Checks for `workspaces` field in root package.json
- Considers it a monorepo if multiple package.json files are found
- Defaults to 'single' if only one package.json exists

#### 3.2 Collect Runtime Evidence (`tools/collect-runtime-evidence.ts`)
**Purpose:** Gathers all runtime version declarations from the repository.

**What It Does:**
- Delegates to `@modernization-navigator/analysis-engine`
- Collects evidence from multiple sources:
  - `package.json` engines field
  - `.nvmrc` file
  - `.node-version` file
  - Dockerfiles
  - GitHub Actions workflows
  - Deployment configurations
  - Package scripts

**Input Schema:** `BaseToolInput`

**Output Schema:** `CollectRuntimeEvidenceResult`
```typescript
{
  runtimeEvidence: RuntimeEvidenceEntry[];
}
```

Each evidence entry contains:
- `kind`: Type of evidence (engines, nvmrc, docker, etc.)
- `declaredVersion`: The version string found
- `filePath`: Where it was found
- `confidence`: How reliable this evidence is

#### 3.3 Inspect Dependency Blockers (`tools/inspect-dependency-blockers.ts`)
**Purpose:** Analyzes dependencies for compatibility issues with the target Node version.

**What It Does:**
- Reads package.json and lockfiles
- Checks each dependency against the target Node version
- Uses npm registry and OSV database for compatibility data
- Identifies packages that don't support the target version
- Returns structured issues with severity and recommendations

**Input Schema:** `BaseToolInput`

**Output Schema:** `InspectDependencyBlockersResult`
```typescript
{
  issues: Issue[];
}
```

#### 3.4 Inspect Ops Runtime (`tools/inspect-ops-runtime.ts`)
**Purpose:** Detects runtime mismatches in CI, Docker, and deployment configurations.

**What It Does:**
- Analyzes GitHub Actions workflows for Node version
- Parses Dockerfiles for base image versions
- Checks deployment configs (Vercel, Netlify, etc.)
- Compares operational runtime with package.json engines
- Identifies mismatches that could cause production issues

**Input Schema:** `BaseToolInput`

**Output Schema:** `InspectOpsRuntimeResult`
```typescript
{
  issues: Issue[];
}
```

#### 3.5 Inspect Source Compatibility (`tools/inspect-source-compatibility.ts`)
**Purpose:** Analyzes source code for deprecated APIs and module system issues.

**What It Does:**
- Uses `ts-morph` to parse TypeScript/JavaScript files
- Detects usage of deprecated Node.js APIs
- Identifies CommonJS vs ESM module system risks
- Checks for dynamic require() patterns
- Flags potential breaking changes in the target version

**Input Schema:** `BaseToolInput`

**Output Schema:** `InspectSourceCompatibilityResult`
```typescript
{
  issues: Issue[];
}
```

#### 3.6 Compare Target Paths (`tools/compare-target-paths.ts`)
**Purpose:** Scores direct vs staged upgrade paths by risk and effort.

**What It Does:**
- Evaluates a direct upgrade path (e.g., Node 14 → 22)
- Evaluates a staged upgrade path (e.g., Node 14 → 18 → 22)
- Calculates risk scores based on:
  - Number of breaking changes
  - Dependency compatibility
  - Ecosystem maturity
- Calculates effort scores based on:
  - Number of steps required
  - Code changes needed
  - Testing complexity
- Recommends the optimal path

**Input Schema:** `BaseToolInput`

**Output Schema:** `CompareTargetPathsResult`
```typescript
{
  comparedPaths: Array<{
    pathType: 'direct' | 'staged';
    targetVersion: string;
    riskScore: number;
    effortScore: number;
    blockers: string[];
  }>;
  recommendedPathCandidate: string;
}
```

#### 3.7 Save Modernization Report (`tools/save-modernization-report.ts`)
**Purpose:** Validates and persists the final normalized report.

**What It Does:**
- Validates the report against the Zod schema
- Writes to `reports/latest/report.json` (overwrites)
- Writes to `reports/history/<reportId>.json` (permanent)
- Updates `reports/index.json` manifest
- Returns paths to all written files

**Input Schema:** `SaveModernizationReportInput`
```typescript
{
  report: Report; // Full report object
}
```

**Output Schema:** `SaveModernizationReportResult`
```typescript
{
  reportId: string;
  reportPath: string;      // reports/latest/report.json
  historyPath: string;     // reports/history/<reportId>.json
}
```

**Atomicity:**
- All three files are written in sequence
- If any write fails, the error propagates
- Manifest is updated last to ensure consistency

#### 3.8 Open Report Viewer (`tools/open-report-viewer.ts`)
**Purpose:** Starts the viewer server and optionally opens the browser.

**What It Does:**
- Validates that the report file exists
- Starts the local viewer server (or reuses if running)
- Opens the default browser to the viewer URL
- Supports `autoOpenViewer` flag to skip browser opening

**Input Schema:** `OpenReportViewerInput`
```typescript
{
  reportPath: string;
  autoOpenViewer?: boolean; // default: true
}
```

**Output Schema:** `OpenReportViewerResult`
```typescript
{
  viewerUrl: string;           // http://127.0.0.1:4173/
  serverStatus: 'started' | 'reused';
}
```

---

## Architecture Decisions

### 1. STDIO Transport for MCP
**Decision:** Use STDIO-based JSON-RPC 2.0 instead of HTTP.

**Rationale:**
- Bob launches the MCP server as a child process
- STDIO is simpler and more secure than HTTP
- No port conflicts or firewall issues
- Direct process lifecycle management

**Critical Rule:** Nothing can be written to stdout except JSON-RPC frames. All logging must go to stderr.

### 2. Zod for Schema Validation
**Decision:** Use Zod schemas for all tool inputs and outputs.

**Rationale:**
- Type-safe validation at runtime
- Automatic TypeScript type inference
- Easy conversion to JSON Schema for Bob
- Shared schemas across all packages
- Clear error messages for invalid data

### 3. Three-File Report Persistence
**Decision:** Write reports to three locations: latest, history, and manifest.

**Rationale:**
- **Latest:** Always accessible at a fixed path for quick access
- **History:** Permanent archive of all reports for comparison
- **Manifest:** Index for the viewer to list available reports
- Enables time-travel debugging and trend analysis

### 4. Lazy Viewer Server Startup
**Decision:** Start the viewer server only when needed, reuse if already running.

**Rationale:**
- Faster subsequent report openings
- Single server instance for multiple reports
- Automatic cleanup when Bob session ends
- Configurable port via environment variable

### 5. Deterministic Report IDs
**Decision:** Use ISO 8601 timestamps as report IDs.

**Rationale:**
- Sortable by creation time
- Human-readable
- Collision-resistant (second-level precision)
- No need for UUID generation

---

## Integration Points

### With Analysis Engine (Dev 2)
- MCP tools delegate to analysis-engine functions
- Analysis engine returns structured data
- MCP tools validate and wrap the results
- No direct file I/O in MCP tools (delegated to engine)

### With Shared Contracts (Dev 4)
- All schemas imported from `@modernization-navigator/shared`
- Tool names imported from shared constants
- Report paths imported from shared constants
- Type safety enforced across package boundaries

### With Viewer (Dev 3)
- Viewer server package provides server management
- MCP server calls viewer-server functions
- Report files written to paths viewer expects
- Manifest format matches viewer's expectations

---

## Testing & Validation

### Acceptance Criteria Met

✅ **1. MCP Configuration**
- `.bob/mcp.json` contains one `modernization-navigator` server entry
- All 8 tool names are in `alwaysAllow`

✅ **2. Tool Registration**
- `packages/mcp-server/src/index.ts` registers exactly 8 tools
- Tool names match Section 6 of technical plan exactly
- No tools renamed or omitted

✅ **3. Discover Repo Scope**
- Returns schema-valid JSON with all required fields:
  - `repoRoot`
  - `detectedPackageManager`
  - `workspaceType`
  - `candidateProjects`

✅ **4. Save Modernization Report**
- Writes all 3 required files:
  - `reports/latest/report.json`
  - `reports/history/<reportId>.json`
  - `reports/index.json`
- Returns `reportId`, `reportPath`, and `historyPath` matching actual files

✅ **5. Open Report Viewer**
- Returns `viewerUrl` in format `http://127.0.0.1:<port>/`
- Returns `serverStatus` as `started` or `reused`
- Works with `autoOpenViewer: false` flag

✅ **6. Custom Mode**
- "Modernization Architect" mode is visible in Bob
- Points to `.bob/rules-modernization-architect/`

---

## File Structure

```
.bob/
├── mcp.json                                    # MCP server registration
├── custom_modes.yaml                           # Custom mode definition
└── rules-modernization-architect/
    ├── 01-role.md                             # Role definition
    └── 02-workflow.md                         # Workflow steps

packages/mcp-server/
├── package.json                                # Package manifest
├── tsconfig.json                               # TypeScript config
└── src/
    ├── index.ts                               # MCP server entry point
    ├── report-writer.ts                       # Report persistence
    ├── viewer-runtime.ts                      # Viewer server management
    └── tools/
        ├── discover-repo-scope.ts             # Tool 1
        ├── collect-runtime-evidence.ts        # Tool 2
        ├── inspect-dependency-blockers.ts     # Tool 3
        ├── inspect-ops-runtime.ts             # Tool 4
        ├── inspect-source-compatibility.ts    # Tool 5
        ├── compare-target-paths.ts            # Tool 6
        ├── save-modernization-report.ts       # Tool 7
        └── open-report-viewer.ts              # Tool 8
```

---

## Key Dependencies

- `@modelcontextprotocol/sdk`: MCP protocol implementation
- `@modernization-navigator/shared`: Shared schemas and types
- `@modernization-navigator/analysis-engine`: Analysis logic
- `@modernization-navigator/viewer-server`: Viewer server
- `zod`: Schema validation
- `zod-to-json-schema`: Schema conversion for Bob

---

## Usage Example

### Bob Session Flow

1. **User Request:**
   ```
   "Analyze this repo for upgrading to Node 22"
   ```

2. **Bob Switches Mode:**
   - Activates "Modernization Architect" mode
   - Loads rules from `.bob/rules-modernization-architect/`

3. **Bob Calls MCP Tools:**
   ```javascript
   // Step 1: Discover scope
   discover_repo_scope({ repoRoot: "/path/to/repo" })
   
   // Step 2: Collect evidence
   collect_runtime_evidence({ repoRoot: "/path/to/repo", targetNodeVersion: "22" })
   
   // Step 3: Check blockers
   inspect_dependency_blockers({ repoRoot: "/path/to/repo", targetNodeVersion: "22" })
   
   // Step 4: Compare paths (if needed)
   compare_target_paths({ repoRoot: "/path/to/repo", targetNodeVersion: "22" })
   
   // Step 5: Save report
   save_modernization_report({ report: { /* full report object */ } })
   
   // Step 6: Open viewer
   open_report_viewer({ reportPath: "reports/latest/report.json" })
   ```

4. **Bob Writes Final Report:**
   - Summarizes current state
   - Lists key blockers
   - Recommends migration path
   - Provides implementation order
   - Includes validation checklist

---

## What Was NOT Built (Out of Scope)

- Deep repository scanning logic (delegated to Dev 2)
- Viewer UI rendering (delegated to Dev 3)
- Shared schema definitions (delegated to Dev 4)
- Analysis engine implementations (delegated to Dev 2)
- Provider integrations (delegated to Dev 2)

---

## Summary

Dev 1 successfully implemented the complete Bob + MCP orchestration layer, enabling Bob to act as an intelligent modernization architect. The implementation includes:

- ✅ Full Bob configuration with custom mode and rules
- ✅ MCP server with 8 registered tools
- ✅ Report persistence with atomic writes
- ✅ Viewer server integration
- ✅ All 8 tool implementations with proper delegation
- ✅ Schema validation using Zod
- ✅ Error handling and logging
- ✅ Cross-platform compatibility

The system is ready for integration with Dev 2's analysis engine, Dev 3's viewer, and Dev 4's shared contracts. All acceptance criteria have been met, and the implementation follows the technical plan exactly.