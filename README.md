# Modernization Navigator Starter Setup

This repository now contains the starter scaffold from `technical_plan.md` so the MVP can be split cleanly across 4 developers without file-path churn.

## What is ready

- Root npm workspace and TypeScript project references
- Project-local Bob configuration in `.bob/`
- Shared package boundaries in `packages/`
- Viewer app and local viewer-server starter files
- Sample report data for the viewer and demo sync flow
- A detailed action log in `cration_process.md`

## Developer split

- Dev 1 owns `.bob/*` and `packages/mcp-server/*`
- Dev 2 owns `packages/analysis-engine/*`, `packages/providers/*`, and `packages/knowledge-base/*`
- Dev 3 owns `apps/viewer/*` and `packages/viewer-server/*`
- Dev 4 owns `packages/shared/*` and shared validation/test assets

## Suggested next commands

```bash
npm install
npm run build
npm run viewer:demo-sync
npm run typecheck
```

## Install Once, Use Anywhere

After the workspace packages are published, the MCP server can be installed once as a standalone tool and then wired into any repo that needs modernization analysis. That keeps it independent from whether the target repo uses Node, Python, Spring, Flutter, or SwiftUI.

```bash
npm install -g @modernization-navigator/mcp-server
modernization-navigator-mcp setup --repo /path/to/your-repo
```

That setup command writes `/path/to/your-repo/.bob/mcp.json` and points it at the globally installed `modernization-navigator-mcp` binary instead of a repo-local `dist/` file.

For contributors working inside this monorepo, the checked-in [.bob/mcp.json](/Users/bilolbekrayimov/games/IBM_hackathon/.bob/mcp.json) still points at the local build output so local development stays simple.

## Notes

- Existing root planning artifacts such as `technical_plan.md`, `technical_plan.html`, and the root `index.html` were left untouched.
- The scaffold favors stable contracts and starter implementations over deep feature completeness so parallel development can start immediately.
- Publish the workspace packages in dependency order when cutting a release: `shared`, `knowledge-base`, `providers`, `analysis-engine`, `viewer-server`, then `mcp-server`.
