# Modernization Navigator for Bob IDE

Modernization Navigator is a Bob-ready MCP server that helps Bob analyze real repositories, detect the current stack, inspect upgrade blockers, compare migration paths, and produce a structured modernization recommendation with evidence.

This repo contains the full monorepo for the MCP server, analysis engine, shared contracts, and report viewer.

## Why this makes Bob better, faster, and more efficient

Bob becomes more useful because this tool gives it a repeatable modernization workflow instead of making it rely on generic guessing.

- Bob starts with stack discovery first. The MCP tools detect whether the target repo is Node, React, or supported Python stacks before Bob asks version-specific questions or recommends the wrong path.
- Bob works from repository evidence, not assumptions. The tool inspects runtime declarations, package-manager signals, CI, Docker, deployment config, dependencies, and source-level risks directly from the repo.
- Bob gets faster at upgrade analysis. Instead of manually reading dozens of files one by one, Bob can call purpose-built tools such as `discover_project_stack`, `collect_environment_evidence`, `inspect_framework_dependencies`, and `inspect_source_risks`.
- Bob makes safer recommendations. The tool can compare direct and staged upgrade paths so Bob can explain not just what is possible, but what is lowest risk for that specific codebase.
- Bob produces reusable outputs. The workflow includes saving a structured modernization report and opening the local report viewer, so the result is easier to review, share, and revisit.
- Bob becomes more consistent across repos. Running `setup` installs the same MCP server wiring and the same `Modernization Architect` mode into each target repository, which reduces setup drift.
- Bob stays efficient inside the IDE. The generated Bob config marks the modernization tools as allowed, so Bob can use the toolchain directly once the repo is configured.

## What the setup command installs

Running the setup flow writes these files into the target repository:

- `.bob/mcp.json`
- `.bob/custom_modes.yaml`
- `.bob/rules-modernization-architect/`

That gives Bob:

- a configured MCP server entry named `modernization-navigator`
- a `Modernization Architect` mode focused on upgrade planning
- workflow rules that tell Bob to discover the stack first, gather evidence, compare paths, save the report, and open the viewer

The setup flow merges into existing Bob config instead of replacing other MCP servers or custom modes.

## Supported analysis lanes

Current stack-aware detection and analysis covers:

- Node.js repositories
- React repositories
- Python repositories using FastAPI, Django, or Flask

## How to use this project with Bob IDE

### 1. Clone this repository

```bash
git clone <repo-url>
cd IBM_hackathon
```

### 2. Open a terminal in the cloned folder

Install dependencies once, then build the workspace:

```bash
npm install
npm run build
```

The build generates the compiled MCP entry point at `packages/mcp-server/dist/index.js`.

### 3. Point the setup command at the repo Bob should analyze

Set the target repository path:

```bash
TARGET_REPO="/path/to/your/project"
```

Then run the setup command.

Generic version:

```bash
node "$(pwd)/packages/mcp-server/dist/index.js" setup \
  --repo "$TARGET_REPO" \
  --command "$(which node)" \
  --arg "$(pwd)/packages/mcp-server/dist/index.js"
```

Example using this workstation's current paths:

```bash
TARGET_REPO="/path/to/your/project"

node /Users/bilolbekrayimov/games/IBM_hackathon/packages/mcp-server/dist/index.js setup \
  --repo "$TARGET_REPO" \
  --command /Users/bilolbekrayimov/.nvm/versions/node/v24.12.0/bin/node \
  --arg /Users/bilolbekrayimov/games/IBM_hackathon/packages/mcp-server/dist/index.js
```

Why both `--command` and `--arg` are passed:

- `--command` tells Bob which Node binary should launch the MCP server
- `--arg` points that Node process at the compiled MCP server entry file
- `--repo` tells the setup flow which repository should receive the Bob config

### 4. Continue in Bob IDE

After setup finishes:

1. Open `"$TARGET_REPO"` in Bob IDE.
2. Let Bob load the repo's `.bob` configuration.
3. Choose the `Modernization Architect` custom mode.
4. Ask Bob to analyze the repository.

Good example prompts:

- "Analyze this repository and recommend the safest modernization path."
- "Check whether we should do a direct upgrade or a staged upgrade."
- "Inspect runtime, dependency, CI, and source risks before recommending a plan."
- "Create a modernization report and open the viewer."

## Typical Bob workflow after installation

Once the target repo is configured, Bob can follow this sequence:

1. Detect the project stack.
2. Gather environment and runtime evidence.
3. Inspect dependency, platform, and source-level risks.
4. Compare plausible upgrade paths.
5. Recommend the best path for that repository.
6. Save the report and open the local viewer.

This is what makes the tool valuable in practice: Bob spends less time on manual repo triage and more time producing a grounded recommendation quickly.

## Useful commands in this repo

```bash
npm run build
npm run typecheck
npm run test
npm run viewer:demo-sync
npm run mcp:dev
```

## Workspace layout

- `packages/mcp-server`: Bob-facing MCP server and setup command
- `packages/analysis-engine`: stack detection and modernization analysis
- `packages/shared`: shared types, schemas, tool names, and report contracts
- `packages/providers`: provider integrations used by analysis
- `packages/knowledge-base`: upgrade rules and compatibility knowledge
- `packages/viewer-server`: local report viewer server
- `apps/viewer`: browser UI for saved modernization reports

## Local contributor note

The checked-in [.bob/mcp.json](/Users/bilolbekrayimov/games/IBM_hackathon/.bob/mcp.json) in this monorepo is for local development of this project itself. The `setup` command is what installs the same experience into any other repository you want Bob to analyze.
