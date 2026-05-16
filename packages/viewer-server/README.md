# @modernization-navigator/viewer-server

Tiny local HTTP server (Node `http`, no framework) that:

- binds to `127.0.0.1:4173` (overridable via `VIEWER_PORT`);
- serves the static viewer UI from [`apps/viewer/`](../../apps/viewer/);
- serves the saved report JSON from `reports/` at the repo root;
- launches the user's default browser (`open` / `xdg-open` / `start`).

This package is consumed by the MCP server (`packages/mcp-server`) inside the
`open_report_viewer` tool. It does not parse or analyze anything — it only
serves files.

## Exported API

```ts
import { startViewerServer, stopViewerServer } from '@modernization-navigator/viewer-server';
import { openBrowser } from '@modernization-navigator/viewer-server';

const { url, status } = await startViewerServer();
// status: 'started' | 'reused'
await openBrowser(url);
```

## Running standalone

```bash
pnpm build
pnpm viewer:serve   # node packages/viewer-server/dist/server.js
```

See [`apps/viewer/README.md`](../../apps/viewer/README.md) for the full Dev 3
architecture, routing table, render flow, and end-to-end verification steps.
