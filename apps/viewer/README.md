# Modernization Navigator — Viewer (Dev 3)

This document covers the Dev 3 surface: the local web page that renders saved
modernization reports, and the tiny HTTP server that serves it. If you are
looking for the overall product plan, see [technical_plan.md](../../technical_plan.md).

## What this is

A plain HTML / CSS / vanilla-JS page that loads a JSON report from disk and
renders it as a readable dashboard. There is **no framework, no build step,
no bundler**. The file you edit is the file the browser runs.

```
apps/viewer/                       ← static UI (what you see in the browser)
  index.html                       ← live entry — opened by Bob
  index.demo.html                  ← hosted-demo entry (sample data, no live analysis)
  app.js                           ← all UI logic (~295 lines, vanilla JS)
  styles.css                       ← styling
  viewer-config.demo.js            ← flips the viewer into demo mode
  sample/                          ← committed sample report for the hosted demo
    index.json
    reports/sample-report.json

packages/viewer-server/            ← local HTTP server (Node, ~150 lines)
  src/server.ts                    ← request handler + start/stop lifecycle
  src/config.ts                    ← port, host, path helpers
  src/browser-open.ts              ← cross-platform `open` / `xdg-open` / `start`
  src/index.ts                     ← barrel re-export
```

## How it fits in the bigger picture

```
┌────────────┐  user message    ┌──────────────────────┐
│   User     │ ───────────────► │   Bob (LLM in IDE)   │
└────────────┘                  └──────────┬───────────┘
                                           │ STDIO / JSON-RPC
                                           ▼
                                ┌──────────────────────┐
                                │   MCP server         │
                                │   (Dev 1 + Dev 2)    │
                                └──────────┬───────────┘
                                           │ writes JSON
                                           ▼
                                ┌──────────────────────┐
                                │  reports/            │
                                │   latest/report.json │
                                │   history/*.json     │
                                │   index.json         │
                                └──────────┬───────────┘
                                           │ HTTP
                                           ▼
                                ┌──────────────────────┐
                                │  viewer-server       │  ← Dev 3 (this package)
                                │  127.0.0.1:4173      │
                                └──────────┬───────────┘
                                           │ static files
                                           ▼
                                ┌──────────────────────┐
                                │  apps/viewer/        │  ← Dev 3 (this app)
                                │  rendered in browser │
                                └──────────────────────┘
```

The viewer never runs analysis. It is a pure read-only renderer over the JSON
that the MCP server already wrote to disk. That's why it can ship as static
files with no build step.

## How a request flows

When Bob calls the MCP tool `open_report_viewer`, this happens:

1. The MCP server (Dev 1) imports `startViewerServer()` from
   [`packages/viewer-server/src/server.ts`](../../packages/viewer-server/src/server.ts).
2. If the server is already running, `startViewerServer` returns
   `{ url, status: 'reused' }`. Otherwise it binds to `127.0.0.1:4173` (or
   `process.env.VIEWER_PORT`) and returns `{ url, status: 'started' }`.
3. The MCP server calls `openBrowser(url)` from
   [`browser-open.ts`](../../packages/viewer-server/src/browser-open.ts), which
   spawns `open` on macOS, `xdg-open` on Linux, `cmd /c start` on Windows.
4. The browser loads `http://127.0.0.1:4173/` → `index.html` →
   `styles.css` + `app.js`.
5. `app.js` `boot()` runs:
   - reads `window.__VIEWER_CONFIG__` (undefined in live mode, set by
     `viewer-config.demo.js` in demo mode);
   - fetches the manifest (`/reports/index.json` in live mode,
     `/sample/index.json` in demo mode);
   - fetches `manifest.latestReportPath`;
   - calls `renderReport(report)` which fills in eight DOM sections.
6. Changing the history `<select>` triggers the `change` listener, fetches a
   different report JSON, and re-renders **without a page reload**.

## The eight rendered sections

These are the sections every report must visibly produce — they are wired in
[`app.js` `renderReport()`](app.js):

| Section | DOM id | Source field on `Report` |
| --- | --- | --- |
| Report metadata | `#report-meta` | top-level fields (id, createdAt, repoRoot, target Node, pkg manager, offline) |
| Bob recommendation (hero) | `#decision-title`, `#decision-summary`, `#decision-pills` | `bobDecision` |
| Evaluated target paths | `#target-paths` | `evaluatedTargetNodeVersions` + selected from `bobDecision.selectedTargetPath` |
| Issues | `#issues` | `issues[]` |
| Evidence | `#evidence` | `runtimeEvidence[]` |
| Execution plan | `#execution-plan` | `bobExecutionPlan[]` (sorted by `order`) |
| Validation checklist | `#validation-checklist` | `validationChecklist[]` |
| Tool trace | `#tool-trace` | `toolTrace[]` |
| History selector | `#history-select` | `manifest.history[]` |

The report shape is defined once in
[`packages/shared/src/schemas/report.ts`](../../packages/shared/src/schemas/report.ts).
**Do not** redefine it in the viewer; consume it as-is.

## Live mode vs demo mode

| | Live mode | Demo mode |
| --- | --- | --- |
| Entry HTML | `index.html` | `index.demo.html` |
| Loads `viewer-config.demo.js`? | No | Yes |
| `window.__VIEWER_CONFIG__.sampleMode` | unset (defaults to `false`) | `true` |
| Manifest fetched | `/reports/index.json` | `/sample/index.json` |
| Reports fetched from | `reports/` (written by MCP) | `apps/viewer/sample/reports/` (committed) |
| Who opens it | Bob, via `open_report_viewer` MCP tool | A judge / reviewer hitting the deployed URL |

The two modes share **the same `app.js`, `styles.css`, and `viewer-config.demo.js`**.
The only difference is which HTML file the browser loads first, and therefore
whether the demo config script tag runs.

## The server's routing rules

All routes live in [`server.ts handleRequest`](../../packages/viewer-server/src/server.ts).
There are exactly six route shapes:

| Path | Served from | Notes |
| --- | --- | --- |
| `/` or `/index.html` | `apps/viewer/index.html` | live entry |
| `/index.demo.html` | `apps/viewer/index.demo.html` | demo entry |
| `/styles.css`, `/app.js`, `/viewer-config.demo.js` | `apps/viewer/*` | static assets |
| `/sample/*` | `apps/viewer/sample/*` | demo data — `..` traversal blocked |
| `/reports/*` | `reports/*` at the repo root | live data — `..` traversal blocked |
| anything else | `404 Not Found` | strict allowlist |

The path-traversal guard is `isInsideDirectory()`. Any request whose resolved
path escapes its allowed root returns `403 Forbidden`.

## Running it

```bash
# from repo root
pnpm build              # compile TypeScript (viewer-server + shared + ...)
pnpm viewer:serve       # node packages/viewer-server/dist/server.js
```

Then open <http://127.0.0.1:4173/>.

For the demo: <http://127.0.0.1:4173/index.demo.html>.

To use a different port:

```bash
VIEWER_PORT=4555 pnpm viewer:serve
```

## Verifying it end-to-end

These map 1:1 to the Section 16 "Done when" criteria in
[technical_plan.md](../../technical_plan.md).

```bash
# 1. all required paths return 200 in live mode
for p in / /app.js /styles.css /reports/index.json /reports/latest/report.json; do
  curl -s -o /dev/null -w "%{http_code} $p\n" http://127.0.0.1:4173$p
done

# 2. demo entry returns 200
curl -s -o /dev/null -w "%{http_code} /index.demo.html\n" http://127.0.0.1:4173/index.demo.html

# 3. path traversal is blocked (must NOT be 200)
curl -s -o /dev/null -w "%{http_code}\n" "http://127.0.0.1:4173/reports/../../etc/passwd"
```

Then in the browser:

- All eight sections render with content (not "empty state" placeholders).
- Changing the history dropdown updates the page **without** a full reload —
  open DevTools → Network and confirm only a JSON request fires.
- The demo URL renders the sample report and never hits `/reports/`.

## What this package must NOT do

These are rule-level (Section 2 of the product plan):

- Do not write into the analyzed repo.
- Do not run analysis. The MCP server already produced the JSON.
- Do not add a framework (React / Vue / Svelte). Plain HTML/CSS/JS only.
- Do not invent report fields. Render only what
  [`schemas/report.ts`](../../packages/shared/src/schemas/report.ts) defines.
- Do not write the final user-facing recommendation. That is Bob's job —
  the viewer surfaces what Bob already decided.

## Files at a glance

| File | Role |
| --- | --- |
| [index.html](index.html) | Live entry. Loaded by Bob. Section containers + `app.js`. |
| [index.demo.html](index.demo.html) | Demo entry. Adds `viewer-config.demo.js` before `app.js`. |
| [app.js](app.js) | Boot, manifest load, eight `render*` functions, history switching, error state. |
| [styles.css](styles.css) | Layout, panels, cards, pills. |
| [viewer-config.demo.js](viewer-config.demo.js) | Sets `window.__VIEWER_CONFIG__ = { sampleMode: true, ... }`. |
| [sample/index.json](sample/index.json) | Manifest the demo loads. |
| [sample/reports/sample-report.json](sample/reports/sample-report.json) | One canned report for the demo. |
| [../../packages/viewer-server/src/server.ts](../../packages/viewer-server/src/server.ts) | HTTP server, routing, start/stop. |
| [../../packages/viewer-server/src/config.ts](../../packages/viewer-server/src/config.ts) | Port, host, path helpers. |
| [../../packages/viewer-server/src/browser-open.ts](../../packages/viewer-server/src/browser-open.ts) | Cross-platform browser launch. |
