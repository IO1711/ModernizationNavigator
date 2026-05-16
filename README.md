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
npm run viewer:demo-sync
npm run typecheck
```

## Notes

- Existing root planning artifacts such as `technical_plan.md`, `technical_plan.html`, and the root `index.html` were left untouched.
- The scaffold favors stable contracts and starter implementations over deep feature completeness so parallel development can start immediately.
- I attempted `npm install` as part of verification on May 16, 2026, and the local client returned `EUNSUPPORTEDPROTOCOL` for the required `workspace:*` package references. The manifests were left aligned to the technical plan, so re-run install/typecheck in the team’s target Node/npm environment before expecting a full green build.
