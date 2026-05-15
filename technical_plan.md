# Modernization Navigator Technical Plan

## Locked MVP Decisions

- Product type: local IBM Bob extension for Node.js modernization analysis
- Backend stack: Node.js + TypeScript
- Monorepo: single repo with `npm` workspaces
- Bob integration: local `STDIO` MCP server only
- Bob mode: one focused custom mode
- Viewer: plain HTML/CSS/JS
- Viewer delivery:
  - local offline viewer for real usage
  - hosted static demo viewer for judges
- Viewer data model: generic viewer page + generated JSON reports
- Viewer server: built-in local static server in the Node monorepo
- Viewer auto-open: enabled by default, user can turn it off
- Repo input: current local repo opened in Bob
- Repo scope: current repo + optional subdirectory target
- Monorepo target handling: single selected subproject analysis only
- Analysis scope: any Node.js repo
- Package manager support: `npm`, `pnpm`, `yarn`
- Recommendation model: analyze and report only, no patch generation in MVP
- Resolution model:
  - issue
  - incompatibility reason
  - recommended solution
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

- Analyze a local Node.js repo against a user-requested target Node version.
- Detect runtime, dependency, config, CI/CD, container, deployment, script, and source-level incompatibilities.
- Explain why each issue does not work on the target Node version.
- Offer one recommended solution and multiple ranked alternatives inside the same package ecosystem.
- Generate a structured JSON report and open a local human-readable viewer automatically.
- Let Bob present the analysis as an execution plan with ordered implementation guidance.

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
        tool-handler.ts
        viewer-runtime.ts
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
4. Bob calls the single MCP tool `analyze_modernization_target`.
5. MCP server resolves repo root, subdirectory, target version, offline mode, and viewer options.
6. Analysis engine:
   - detects package manager
   - reads runtime and deployment config
   - scans dependencies
   - parses JS/TS source with `ts-morph`
   - applies internal compatibility rules
   - enriches with npm registry and OSV when online
   - ranks same-ecosystem solutions
7. Report writer creates:
   - `reports/latest/report.json`
   - `reports/history/<timestamp>.json`
   - `reports/index.json`
8. Viewer runtime ensures local server is running.
9. Viewer auto-opens local URL by default.
10. MCP tool returns summary metadata to Bob.
11. Bob explains findings, ordered execution steps, and validation sequence.

## Report Contract

### Required top-level fields

- `reportId`
- `createdAt`
- `repoRoot`
- `subdirectory`
- `targetNodeVersion`
- `detectedPackageManager`
- `offlineMode`
- `externalDataStatus`
- `runtimeEvidence`
- `issues`
- `implementationPlan`
- `validationChecklist`

### Required issue fields

- `id`
- `category`
- `title`
- `issue`
- `incompatibilityReason`
- `recommendedSolution`
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

### Required implementation plan fields

- `phase`
- `order`
- `title`
- `actions`
- `dependsOn`
- `validation`

## Workstream 1: Architecture

### Goal

Define the monorepo, shared contracts, runtime boundaries, and file layout.

### Deliverables

- `npm` workspaces root configuration
- TypeScript project references
- shared schema package
- shared constants package area
- base lint/format/typecheck setup
- repo folder conventions

### Technical Requirements

- Use `npm` workspaces with `apps/*` and `packages/*`.
- Keep the viewer, MCP server, analysis engine, and shared contracts in the same repo.
- Put all report JSON schemas in `packages/shared`.
- Put all internal compatibility rules in `packages/knowledge-base/data/*.json`.
- Use one source of truth for report types:
  - `zod` schemas first
  - TypeScript types inferred from schemas
- Separate pure analysis logic from IO-heavy modules.
- Keep provider interfaces separate from provider implementations.
- Keep viewer server separate from MCP transport code.
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
- Report paths are deterministic.

## Workstream 2: MCP Integration

### Goal

Expose one Bob tool through a local `STDIO` MCP server and pair it with one focused custom mode.

### Deliverables

- local `STDIO` MCP server
- Bob MCP config
- Bob custom mode
- orchestration tool handler
- viewer auto-open integration

### MCP Tool

- Tool name: `analyze_modernization_target`
- Tool count: one orchestration tool only

### Tool Input Contract

- `targetNodeVersion: string`
- `subdirectory?: string`
- `offline?: boolean`
- `autoOpenViewer?: boolean`

### Tool Output Contract

- `reportId`
- `reportPath`
- `viewerUrl`
- `repoRoot`
- `subdirectory`
- `targetNodeVersion`
- `issueCount`
- `issueCategories`
- `externalDataStatus`

### Technical Requirements

- Use local `STDIO` transport only.
- Bob config must point to the built MCP server entrypoint.
- The tool handler must validate input with `zod`.
- `targetNodeVersion` must accept:
  - exact version
  - major version only
- Normalize target version internally before analysis.
- Resolve repo root from the Bob-opened workspace.
- If `subdirectory` is provided, restrict analysis to that subproject.
- Start or reuse the built-in local viewer server before returning.
- Auto-open the viewer by default.
- Support opt-out through tool input and config.
- Return concise structured output to Bob, not the full report payload.

### Bob Custom Mode Requirements

- Mode name: `Modernization Architect`
- Mode responsibilities:
  - gather target Node version
  - gather optional subdirectory
  - call `analyze_modernization_target` once
  - summarize exact incompatibilities
  - present recommended order of changes
  - present validation checklist
- Mode must not invent package replacements outside report data.
- Mode must not promise code patches in MVP.
- Mode response order:
  - current state summary
  - detected issues
  - recommended implementation order
  - validation sequence

### Acceptance Criteria

- Bob can see and call the tool locally.
- Invalid tool input returns typed validation errors.
- Viewer URL opens automatically unless disabled.
- Bob mode produces consistent execution-plan output.

## Workstream 3: Analysis Engine

### Goal

Analyze one local Node.js repo or selected subdirectory and produce a resolution-oriented modernization report.

### Deliverables

- repo scanner
- runtime/config detectors
- package manager detector
- dependency analyzer
- source analyzer
- provider abstraction layer
- rule-based solution ranker
- report builder

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
  - recommended solution pattern
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

### Solution Ranking Requirements

- Use rule-based scoring only.
- Rank alternatives by:
  - compatibility with target Node version
  - match with current package ecosystem
  - expected implementation effort
  - amount of source/config churn
  - known vulnerability exposure
  - certainty of repo evidence
- Output one recommended solution and multiple ranked alternatives.

### Report Generation Requirements

- Write stable latest report path.
- Write timestamped history copy per run.
- Update `reports/index.json` on every run.
- Keep report JSON deterministic for test fixtures.
- Include exact evidence locations:
  - file path
  - package name
  - config key
  - source pattern

### Acceptance Criteria

- Tool handles `npm`, `pnpm`, and `yarn` repos.
- Tool handles offline mode without crashing.
- Tool handles repo root or selected subdirectory.
- Report contains issue, reason, solution, alternatives, files, and validation steps for every finding.

## Workstream 4: Viewer UI

### Goal

Render generated report JSON in a readable static viewer for local use and a hosted sample demo.

### Deliverables

- local viewer assets
- hosted demo viewer assets
- local viewer server
- report history selector
- report detail rendering
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
- Auto-open viewer URL after analysis by default.
- Allow user to turn off auto-open.
- Load reports from `reports/index.json`.
- Support latest report view and history selector.
- Read report detail JSON from:
  - `reports/latest/report.json`
  - `reports/history/<timestamp>.json`
- Display:
  - repo summary
  - selected subdirectory
  - target Node version
  - package manager
  - offline/external data status
  - issue list
  - incompatibility reason
  - recommended solution
  - ranked alternatives
  - affected files
  - evidence
  - commands
  - validation steps
  - ordered implementation plan

### Hosted Demo Viewer Requirements

- Deploy as static assets to `Vercel or Netlify`.
- No live repo access.
- No live MCP integration.
- Use committed sample report data only.
- Use a static viewer config file that points to the sample manifest path.

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
  - summary
  - issues
  - implementation plan
  - validation
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

## Workstream 5: Testing

### Goal

Make the analyzer, report writer, MCP handler, and viewer deterministic and safe to demo.

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
  - report writer tests
- `mcp-server`
  - input validation tests
  - orchestration flow tests
  - auto-open enabled/disabled tests
- `viewer`
  - manifest loading tests
  - history selector tests
  - issue rendering tests
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

## Workstream 6: Deployment

### Goal

Package the local tool for Bob usage and publish a static hosted viewer for judges.

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

Make the tool easy to install, demo, judge, and explain.

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
  - running analysis
  - opening the local viewer
- README must explain:
  - local Bob workflow
  - hosted demo viewer role
  - offline mode behavior
  - supported file types
  - supported package managers
  - out-of-scope items
- Demo script must show:
  - local repo in Bob
  - one target version prompt
  - tool execution
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
- implement report writer

### Phase 3

- implement source AST analysis
- implement solution ranking
- implement `reports/index.json`

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
