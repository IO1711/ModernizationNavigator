# Modernization Navigator Technical Plan

## Locked MVP Decisions

- Product type: local IBM Bob modernization copilot for Node.js upgrade planning
- Product posture: Bob-first experience with MCP-backed repo intelligence
- Backend stack: Node.js + TypeScript
- Monorepo: single repo with `npm` workspaces
- Bob integration: local `STDIO` MCP server only
- Bob mode: one focused custom mode
- MCP model: multiple smaller MCP tools, adaptively orchestrated by Bob
- Bob responsibility:
  - gather scope
  - decide what evidence to collect
  - compare migration paths
  - choose the recommended path
  - produce the user-facing report in chat
- MCP responsibility:
  - inspect repo state
  - gather deterministic evidence
  - compare technical paths
  - persist report artifacts
  - open the local viewer
- Final outputs:
  - Bob chat report
  - local viewer report
- Viewer: plain HTML/CSS/JS
- Viewer delivery:
  - local offline viewer for real usage
  - hosted static demo viewer for judges
- Viewer data model: generic viewer page + generated JSON reports containing MCP evidence and Bob's chosen plan
- Viewer server: built-in local static server in the Node monorepo
- Viewer auto-open: enabled by default, user can turn it off
- Repo input: current local repo opened in Bob
- Repo scope: current repo + optional subdirectory target
- Monorepo target handling: single selected subproject analysis only
- Analysis scope: any Node.js repo
- Package manager support: `npm`, `pnpm`, `yarn`
- Recommendation model: Bob makes the final recommendation using MCP evidence, no patch generation in MVP
- Resolution model:
  - issue
  - incompatibility reason
  - evidence
  - default technical recommendation
  - multiple ranked alternative solutions
  - affected files
  - validation steps
- Solution ranking: rule-based using repo state + external metadata
- Dependency alternatives: same package ecosystem only, no package replacement suggestions
- External sources: npm registry metadata + OSV
- GitHub advisories: removed from MVP
- Offline behavior: explicit offline mode
- Compatibility knowledge: small internal JSON knowledge base
- Source analysis: heuristic scanning + AST analysis
- AST tooling: `ts-morph`
- Runtime validation / report schemas: `zod`
- Test framework: `vitest`
- UI theme: light theme only
- Report formats:
  - `JSON` primary output
  - no Markdown export in MVP
- Local report storage:
  - `reports/latest/report.json`
  - `reports/history/<timestamp>.json`
  - `reports/index.json`
- Hosted viewer hosting: `Vercel or Netlify`, implementation owner chooses
- Planning scope: MVP + post-hackathon roadmap

## Goals

- Let a user open a local Node.js repo in Bob and ask for upgrade guidance against a target Node version.
- Let Bob ask smart scoping questions before analysis when needed.
- Let Bob choose which MCP tools to call and in what order based on the repo and the user request.
- Detect runtime, dependency, config, CI/CD, container, deployment, script, and source-level incompatibilities.
- Provide deterministic evidence so Bob does not need to improvise repo facts.
- Let Bob compare migration paths such as direct upgrade versus staged upgrade.
- Produce both:
  - a conversational Bob report
  - a local viewer report with saved evidence and Bob's chosen plan
- Demonstrate clear, visible, meaningful use of IBM Bob as the modernization architect.

## Non-Goals for MVP

- No automatic code patch generation
- No remote HTTP MCP server
- No database
- No user accounts
- No hosted analysis backend
- No GitHub advisory integration
- No package replacement suggestions across ecosystems
- No Java/Spring analysis
- No multi-subproject combined report
- No autonomous repo modifications

## Repository Layout

```text
modernization-navigator/
  .bob/
    mcp.json
    custom-modes/
      modernization-architect.md
  apps/
    viewer/
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
      src/
        schemas/
        types/
        constants/
        utils/
    knowledge-base/
      src/
      data/
        node-runtime-rules.json
        package-compatibility-rules.json
        ci-runtime-rules.json
        deployment-runtime-rules.json
    providers/
      src/
        npm-registry-provider.ts
        osv-provider.ts
        provider-types.ts
    analysis-engine/
      src/
        detectors/
        parsers/
        analyzers/
        rankers/
        report/
    viewer-server/
      src/
        server.ts
        browser-open.ts
        config.ts
    mcp-server/
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
  reports/
    latest/
      report.json
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

## Required Tooling

- Package manager: `npm`
- Workspace model: `npm` workspaces
- TypeScript build: `tsc`
- TypeScript dev runtime: `tsx`
- Linting: `eslint`
- Formatting: `prettier`
- Validation: `zod`
- Source AST inspection: `ts-morph`
- YAML parsing: `yaml`
- Tests: `vitest`
- HTTP requests: native `fetch`
- Local static viewer server: Node built-in `http` module

## Required NPM Scripts

- `npm run build`
- `npm run typecheck`
- `npm run lint`
- `npm run test`
- `npm run test:watch`
- `npm run viewer:serve`
- `npm run viewer:demo-sync`
- `npm run mcp:dev`
- `npm run mcp:build`

## End-to-End Runtime Flow

1. User opens a local Node.js repo in Bob.
2. User selects `Modernization Architect`.
3. User asks for analysis with a target Node version and optional subdirectory.
4. Bob gathers missing scope:
   - target Node version if unclear
   - optional subdirectory
   - upgrade preference such as safest path or fastest path when useful
5. Bob inspects the repo context and decides which MCP tools to call first.
6. Bob calls evidence tools such as:
   - `discover_repo_scope`
   - `collect_runtime_evidence`
   - `inspect_dependency_blockers`
7. Based on returned evidence, Bob decides whether to call more tools such as:
   - `inspect_ops_runtime`
   - `inspect_source_compatibility`
   - `compare_target_paths`
8. MCP tools return structured evidence only:
   - repo facts
   - issue candidates
   - ranked technical options
   - file-level references
   - comparison data
9. Bob synthesizes the evidence into:
   - current-state summary
   - top blockers
   - recommended migration path
   - ordered implementation plan
   - validation checklist
10. Bob calls `save_modernization_report` to persist:
   - MCP evidence
   - Bob's selected strategy
   - Bob's execution plan
   - validation checklist
11. Bob calls `open_report_viewer`.
12. Viewer runtime ensures the local server is running and opens the browser by default.
13. Bob presents the final chat report.
14. User can inspect the viewer and ask Bob follow-up questions, and Bob can call more MCP tools as needed.

## Bob and MCP Responsibility Model

### Bob does

- own the user conversation
- ask scoping questions
- decide which tools to call
- decide call order adaptively
- compare direct and staged migration paths
- choose the recommended path for this repo and this user goal
- present the final narrative report in chat
- continue helping after the first report

### MCP does

- inspect manifests, lockfiles, CI, Docker, deployment config, scripts, and source
- run AST and static checks
- fetch external compatibility metadata when allowed
- return deterministic structured evidence
- compare target paths in a machine-readable way
- save report artifacts to disk
- start or reuse the local viewer server

### Why MCP makes Bob better

- Bob gets exact repo evidence instead of re-deriving facts every turn
- Bob can reason over large repos without repeatedly re-reading the same files
- Bob can rely on deterministic tool outputs for viewer artifacts and history
- Bob stays focused on judgment, prioritization, and tradeoffs
- The product visibly shows Bob orchestrating a toolbox rather than acting as a thin wrapper over one giant tool

## Report Contract

### Required top-level fields

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

### Required issue fields

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

### Required alternative solution fields

- `rank`
- `title`
- `summary`
- `targetVersionRange`
- `rationale`
- `tradeoffs`
- `commands`

### Required tool trace fields

- `toolName`
- `purpose`
- `status`
- `startedAt`
- `finishedAt`
- `resultSummary`

### Required Bob decision fields

- `summary`
- `selectedTargetPath`
- `rationale`
- `prioritizedRisks`
- `chosenSolutions`
- `tradeoffs`

### Required implementation plan fields

- `phase`
- `order`
- `title`
- `actions`
- `dependsOn`
- `validation`

## Workstream 1: Architecture

### Goal

Define the monorepo, shared contracts, runtime boundaries, and file layout for a Bob-first architecture with MCP as the evidence layer.

### Deliverables

- `npm` workspaces root configuration
- TypeScript project references
- shared schema package
- shared constants package area
- base lint/format/typecheck setup
- repo folder conventions
- shared schemas for:
  - evidence tool outputs
  - persisted report artifacts
  - Bob decision section

### Technical Requirements

- Use `npm` workspaces with `apps/*` and `packages/*`.
- Keep the viewer, MCP server, analysis engine, and shared contracts in the same repo.
- Put all persisted report JSON schemas in `packages/shared`.
- Put all MCP tool output schemas in `packages/shared`.
- Put all internal compatibility rules in `packages/knowledge-base/data/*.json`.
- Use one source of truth for report and tool types:
  - `zod` schemas first
  - TypeScript types inferred from schemas
- Separate pure analysis logic from IO-heavy modules.
- Keep provider interfaces separate from provider implementations.
- Keep viewer server separate from MCP transport code.
- Keep report writer separate from evidence generators.
- Keep demo sample sync logic in `scripts/`.

### Engineering Constraints

- No database layer
- No framework dependency in the viewer
- No backend REST API for MVP
- No direct provider calls from the viewer
- No write operations to the analyzed repo

### Acceptance Criteria

- One install command sets up the whole repo.
- One build command compiles all TypeScript packages.
- Shared schemas compile without circular dependencies.
- Tool output contracts and report contracts stay deterministic.

## Workstream 2: Bob + MCP Orchestration

### Goal

Expose a local `STDIO` MCP toolbox that Bob can orchestrate adaptively through one focused custom mode.

### Deliverables

- local `STDIO` MCP server
- Bob MCP config
- Bob custom mode
- smaller MCP tool handlers
- report persistence tool
- viewer auto-open integration

### MCP Tool Inventory

- `discover_repo_scope`
- `collect_runtime_evidence`
- `inspect_dependency_blockers`
- `inspect_ops_runtime`
- `inspect_source_compatibility`
- `compare_target_paths`
- `save_modernization_report`
- `open_report_viewer`

### Tool Design Requirements

- Each tool must do one bounded job.
- Tool outputs must be structured evidence or side effects, not a full user-facing report.
- `compare_target_paths` must support direct versus staged upgrade comparisons when enough evidence exists.
- `save_modernization_report` must accept both:
  - MCP evidence references or payloads
  - Bob-authored decision and plan fields
- `open_report_viewer` must start or reuse the local viewer server and return the local URL.

### Common Tool Input Requirements

- `targetNodeVersion` must accept:
  - exact version
  - major version only
- Tools must support optional `subdirectory`.
- Tools must support `offline`.
- Viewer tooling must support `autoOpenViewer`.

### Common Tool Output Requirements

- Every evidence tool must return:
  - stable schema
  - concise summary fields
  - file-level evidence references
  - issue identifiers when applicable
- Comparison tool must return:
  - compared target paths
  - risk deltas
  - effort deltas
  - notable blockers by path
- Save tool must return:
  - `reportId`
  - `reportPath`
  - `historyPath`
- Viewer tool must return:
  - `viewerUrl`
  - server status

### Technical Requirements

- Use local `STDIO` transport only.
- Bob config must point to the built MCP server entrypoint.
- The tool handlers must validate input with `zod`.
- Resolve repo root from the Bob-opened workspace.
- If `subdirectory` is provided, restrict analysis to that subproject.
- Bob must be able to choose different tool paths for different repo situations.
- Do not force a fixed call sequence in the MCP layer.
- Return evidence to Bob, not the final conversational answer.

### Bob Custom Mode Requirements

- Mode name: `Modernization Architect`
- Mode responsibilities:
  - gather missing scope
  - decide which MCP tools to call
  - decide whether comparison is needed
  - summarize exact incompatibilities
  - choose a recommended migration path
  - present implementation order
  - persist the chosen plan
  - open the viewer
- Mode must cite MCP evidence in its reasoning.
- Mode must not invent package replacements outside report data.
- Mode must not promise code patches in MVP.
- Mode response order:
  - current state summary
  - key blockers
  - recommended path
  - ordered implementation plan
  - validation sequence

### Acceptance Criteria

- Bob can see and call the toolbox locally.
- Invalid tool input returns typed validation errors.
- Bob can choose different tool sequences for different scenarios.
- Viewer URL opens automatically unless disabled.
- Final report artifact contains both MCP evidence and Bob's selected plan.

## Workstream 3: Evidence Engine

### Goal

Analyze one local Node.js repo or selected subdirectory and return composable evidence for Bob rather than a single all-in-one answer.

### Deliverables

- repo scanner
- runtime/config detectors
- package manager detector
- dependency analyzer
- source analyzer
- provider abstraction layer
- rule-based solution ranker
- evidence pack builder
- report writer support

### Input Scope

- local repo root
- optional subdirectory
- target Node version
- offline mode flag

### Files to Inspect

- `package.json`
- `package-lock.json`
- `pnpm-lock.yaml`
- `yarn.lock`
- `.nvmrc`
- `.node-version`
- `Dockerfile*`
- `.github/workflows/*.yml`
- `.github/workflows/*.yaml`
- `vercel.json`
- `netlify.toml`
- `Procfile`
- shell scripts in common script paths
- JS/TS source files
- `tsconfig*.json`

### Detection Modules

- package manager detection
- Node runtime evidence detection
- dependency manifest analysis
- lockfile analysis
- Docker runtime analysis
- GitHub Actions runtime analysis
- deployment config runtime analysis
- shell script runtime analysis
- source-level API usage analysis
- module-system compatibility analysis

### Package Manager Detection Requirements

- Preserve detected package manager in generated commands.
- Use repo signals in this order:
  - explicit lockfile
  - workspace config
  - `packageManager` field
  - fallback to `npm`

### Runtime Analysis Requirements

- Treat user-requested target version as authoritative.
- Treat repo-declared versions as current-state evidence only.
- Collect runtime evidence from:
  - `engines.node`
  - `.nvmrc`
  - `.node-version`
  - Docker base image tags
  - GitHub Actions `setup-node`
  - deployment config references
  - shell scripts

### Dependency Analysis Requirements

- Parse root and selected-subproject manifests.
- Compare dependency ranges to target Node version constraints.
- Read npm registry metadata through provider abstraction.
- Read OSV vulnerability data through provider abstraction.
- Apply internal JSON rules when live metadata is incomplete.
- Generate same-ecosystem solution options only.
- Never suggest package replacement outside the current package ecosystem in MVP.

### Source Analysis Requirements

- Use `ts-morph` for JS/TS AST inspection.
- Detect source-level incompatibilities such as:
  - deprecated Node APIs
  - unsupported runtime assumptions
  - ESM/CJS friction indicators
  - incompatible imports or required package major changes
  - script invocations tied to older runtime behavior
- Use heuristic scanning for:
  - shell scripts
  - Dockerfiles
  - workflow YAML
  - JSON deployment config

### Knowledge Base Requirements

- Store curated rules in JSON.
- Rule categories:
  - Node runtime deprecations
  - common package compatibility notes
  - CI/runtime upgrade rules
  - deployment/runtime upgrade rules
- Every rule must define:
  - match conditions
  - incompatibility reason
  - default technical recommendation
  - optional ranked alternatives
  - evidence hints

### Provider Layer Requirements

- Provider interfaces:
  - `NpmRegistryProvider`
  - `OsvProvider`
- Providers must be caching-ready by design.
- Providers must expose typed responses.
- Providers must isolate network errors from analysis logic.
- Providers must support explicit offline mode.
- Offline mode behavior:
  - skip live calls
  - continue local analysis
  - mark external enrichment as skipped in report

### Evidence Output Requirements

- Every issue must have a stable identifier that Bob can reference across turns.
- Every issue must include exact evidence locations:
  - file path
  - package name
  - config key
  - source pattern
- Every evidence output must be deterministic for test fixtures.
- Comparison outputs must be machine-readable so Bob can compare paths cleanly.

### Report Generation Requirements

- Write stable latest report path.
- Write timestamped history copy per saved run.
- Update `reports/index.json` on every saved run.
- Persist:
  - MCP evidence
  - tool trace
  - Bob decision
  - Bob execution plan
- Keep report JSON deterministic for test fixtures.

### Acceptance Criteria

- Tools handle `npm`, `pnpm`, and `yarn` repos.
- Tools handle offline mode without crashing.
- Tools handle repo root or selected subdirectory.
- Evidence outputs contain issue, reason, technical recommendation, alternatives, files, and validation steps for every finding.

## Workstream 4: Viewer UI

### Goal

Render saved MCP evidence and Bob's chosen plan in a readable static viewer for local use and a hosted sample demo.

### Deliverables

- local viewer assets
- hosted demo viewer assets
- local viewer server
- report history selector
- Bob decision rendering
- evidence detail rendering
- viewer config model

### Viewer Model

- Plain `HTML/CSS/JS`
- No framework
- Light theme only
- One generic viewer page
- One shared rendering script
- One local manifest source
- One demo manifest source

### Local Viewer Requirements

- Serve viewer through built-in local server in the monorepo.
- Auto-open viewer URL after report save by default.
- Allow user to turn off auto-open.
- Load reports from `reports/index.json`.
- Support latest report view and history selector.
- Read report detail JSON from:
  - `reports/latest/report.json`
  - `reports/history/<timestamp>.json`
- Display:
  - repo summary
  - selected subdirectory
  - requested target version
  - evaluated target paths
  - package manager
  - offline/external data status
  - Bob decision summary
  - Bob's chosen migration path
  - issue list
  - incompatibility reason
  - default technical recommendation
  - ranked alternatives
  - affected files
  - evidence
  - commands
  - validation steps
  - ordered implementation plan
  - tool trace

### Hosted Demo Viewer Requirements

- Deploy as static assets to `Vercel or Netlify`.
- No live repo access.
- No live MCP integration.
- Use committed sample report data only.
- Use a static viewer config file that points to the sample manifest path.
- Make the Bob versus MCP role split easy for judges to understand from the viewer alone.

### Local Viewer Server Requirements

- Implement with Node built-in `http`.
- Serve viewer assets.
- Serve `reports/` JSON.
- Serve one runtime config endpoint or config script for local report paths.
- Handle missing report files with readable viewer messages.
- Expose a stable local URL.
- Support browser auto-open on:
  - macOS
  - Linux
  - Windows

### UI Structure Requirements

- Sidebar or top navigation for:
  - Bob recommendation
  - evidence
  - implementation plan
  - validation
  - tool trace
  - history
- Issue cards must be collapsible.
- File paths and commands must be copyable.
- History selector must load older reports without page reload if possible.
- Viewer must work on desktop and laptop screens.

### Acceptance Criteria

- Latest report loads automatically.
- User can switch to a previous report.
- Local viewer works from built-in local server.
- Hosted demo viewer works without a backend.
- Viewer clearly shows both:
  - what Bob decided
  - what MCP found

## Workstream 5: Testing

### Goal

Make the evidence tools, report writer, Bob-facing orchestration layer, and viewer deterministic and safe to demo.

### Deliverables

- unit tests
- integration tests
- fixture repos
- schema tests
- offline-mode tests
- viewer DOM tests

### Tooling

- `vitest`

### Test Layers

- `shared`
  - schema validation tests
  - type inference tests
- `knowledge-base`
  - rule file shape tests
  - rule application tests
- `providers`
  - online response mapping tests
  - offline skip tests
  - network failure handling tests
- `analysis-engine`
  - package manager detection tests
  - runtime evidence aggregation tests
  - dependency resolution tests
  - AST detection tests
  - alternative ranking tests
  - evidence output tests
  - report writer tests
- `mcp-server`
  - input validation tests
  - per-tool orchestration tests
  - comparison tool tests
  - save report tests
  - auto-open enabled/disabled tests
- `viewer`
  - manifest loading tests
  - history selector tests
  - Bob decision rendering tests
  - issue rendering tests
  - tool trace rendering tests
  - empty/error state tests

### Required Fixtures

- `npm` repo fixture
- `pnpm` repo fixture
- `yarn` repo fixture
- repo with Dockerfile runtime mismatch
- repo with GitHub Actions runtime mismatch
- repo with deployment config mismatch
- repo with JS/TS source-level incompatibility
- offline fixture run with provider stubs

### Acceptance Criteria

- All schema contracts are validated by tests.
- Report JSON is stable for fixture snapshots.
- Viewer renders fixture reports correctly.
- Offline mode passes without network access.
- Saved reports preserve both evidence and Bob decision fields.

## Workstream 6: Deployment

### Goal

Package the local Bob-first toolchain for usage in Bob and publish a static hosted viewer for judges.

### Deliverables

- local build instructions
- Bob config instructions
- static hosted demo viewer
- sample report sync flow

### Local Tool Requirements

- `npm install` must install all workspaces.
- `npm run build` must compile the MCP server and analysis packages.
- Bob config must point to the built local MCP entrypoint.
- Local viewer server must start from project code, not an external global dependency.
- Sample report generation must not be required for real local usage.

### Hosted Demo Viewer Requirements

- Deploy only static assets and sample report data.
- Do not expose local repo paths from the sample report.
- Provide one demo report and one sample history entry if possible.
- Hosting target in plan text:
  - `Vercel or Netlify`
  - implementation owner chooses

### Operational Constraints

- No database
- No backend hosting
- No secrets required for core local analysis
- Network access optional for external enrichment
- Hosted demo viewer must still work without live providers

### Acceptance Criteria

- Local Bob integration can be set up from docs.
- Hosted viewer opens without backend dependencies.
- Demo sample can be refreshed from a real generated report.

## Workstream 7: Demo & Docs

### Goal

Make the Bob-first workflow easy to install, demo, judge, and explain.

### Deliverables

- `README.md`
- Bob setup guide
- local run guide
- hosted demo guide
- sample prompt set
- demo script
- architecture diagram
- known limitations section

### Documentation Requirements

- Setup docs must cover:
  - install
  - build
  - Bob MCP config
  - custom mode setup
  - running adaptive analysis
  - saving the report
  - opening the local viewer
- README must explain:
  - local Bob workflow
  - Bob versus MCP role split
  - hosted demo viewer role
  - offline mode behavior
  - supported file types
  - supported package managers
  - out-of-scope items
- Demo script must show:
  - local repo in Bob
  - one target version prompt
  - Bob asking at least one meaningful scoping question
  - multiple MCP tool calls
  - Bob choosing a migration path
  - viewer auto-open
  - issue list
  - implementation plan
  - validation checklist

### Acceptance Criteria

- A new developer can run the tool from docs only.
- Judges can understand the hosted demo viewer without running Bob.
- Demo path fits in a short live presentation.

## Execution Order

### Phase 1

- scaffold monorepo
- add shared schemas
- add knowledge base structure
- add MCP skeleton

### Phase 2

- implement package manager detection
- implement runtime/config detectors
- implement provider layer
- implement evidence tool outputs

### Phase 3

- implement source AST analysis
- implement target path comparison
- implement report writer and `reports/index.json`

### Phase 4

- build local viewer server
- build local viewer page
- add auto-open flow

### Phase 5

- add Bob custom mode
- add fixture tests
- add hosted demo viewer sample flow
- finalize docs and demo script

## Post-Hackathon Roadmap

- remote `HTTP` MCP server
- patch generation for low-risk changes
- package replacement suggestions across ecosystems
- multi-subproject monorepo reports
- persistent report history and search
- advisory source expansion
- richer diff between current and target runtime states
- team sharing and collaboration
