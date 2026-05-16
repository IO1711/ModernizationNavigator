# Dev 3 Implementation Process

## Scope and Guardrails

I own:
- `apps/viewer/*` — the static HTML/CSS/JS viewer UI.
- `packages/viewer-server/*` — the local HTTP server that serves the viewer
  and the saved report JSON files.

I do not touch:
- `packages/shared/*` (Dev 4)
- `packages/analysis-engine/*`, `packages/providers/*`, `packages/knowledge-base/*` (Dev 2)
- `packages/mcp-server/*`, `.bob/*` (Dev 1)

Stack rules from `technical_plan.md`:
- Plain HTML / CSS / vanilla JS only — no framework, no bundler, no build step
  for the viewer UI.
- Viewer server is plain Node `http` + `fs`. CommonJS.
- Bind to `127.0.0.1`, default port `4173`, override via `VIEWER_PORT`.
- The viewer never writes into the analyzed repo and never runs analysis.

## Process Log

### 2026-05-16 — Initial plan alignment

What I did:
- Read `technical_plan.md` end to end.
- Located Section 16 → "Dev 3: Viewer" assignment.
- Surveyed the current state of the four directories in my scope.

Why:
- Needed to know what was already implemented before touching anything.
- Wanted to avoid stepping on Dev 1, Dev 2, or Dev 4 paths.

What I learned:
- `apps/viewer/index.html`, `styles.css`, `app.js` (~295 lines), and
  `viewer-config.demo.js` all already existed with substantial content from a
  prior pass.
- `packages/viewer-server/src/server.ts` (147 lines), `config.ts`,
  `browser-open.ts`, and `index.ts` were already implemented.
- `reports/latest/report.json`, `reports/history/sample-20260516T090000Z.json`,
  and `reports/index.json` were already present, so the viewer had real data
  to load against.
- `apps/viewer/sample/index.json` and `sample/reports/sample-report.json`
  were also in place.

Decision:
- Treat this as a finishing + verification pass, not a from-scratch build.
- Only change files where I could point to a specific Section 16 "Done when"
  bullet that was not yet met.

### 2026-05-16 — Demo-mode wiring gap identified

What I did:
- Read `apps/viewer/viewer-config.demo.js`. It set `sampleMode: false`, which
  is identical to the `defaultConfig` in `app.js`.
- Read `apps/viewer/index.html`. It had
  `<script src="./viewer-config.demo.js"></script>` loaded unconditionally
  before `app.js`.

Why:
- I wanted to understand how live mode vs demo mode actually switched.

What I learned:
- The two were not separated. The "demo config" was always loaded, but it
  always said `sampleMode: false`, so nothing ever switched into demo mode.
- This fails Section 19 acceptance criterion 7 ("Hosted demo viewer can show
  committed sample data without live analysis"), because there is no way for
  the demo deployment to actually pick up the sample manifest.

Decision:
- Keep `viewer-config.demo.js` as the demo-only override file (its name
  promises that), and flip it to `sampleMode: true`.
- Remove the unconditional `<script>` tag from `index.html` so the live
  viewer Bob opens uses defaults (`sampleMode: false`).
- Add a separate `apps/viewer/index.demo.html` that is identical to
  `index.html` but additionally loads `viewer-config.demo.js` before
  `app.js`. The hosted demo deployment points at this file.
- This keeps the "plain HTML/CSS/JS, no build" rule — no script injection,
  no bundler — at the cost of one duplicated HTML shell.

### 2026-05-16 — Demo split applied

Files changed:
- `apps/viewer/viewer-config.demo.js`
  - `sampleMode: false` → `sampleMode: true`.
- `apps/viewer/index.html`
  - Removed `<script src="./viewer-config.demo.js"></script>`.
- `apps/viewer/index.demo.html` (new)
  - Copy of `index.html` with `<script src="./viewer-config.demo.js"></script>`
    placed immediately before `<script src="./app.js"></script>` so the
    `window.__VIEWER_CONFIG__` override exists before `app.js` reads it.

What I learned:
- `app.js` `boot()` reads `window.__VIEWER_CONFIG__` at module init, so the
  config script must precede `app.js`. Order matters.
- After the change, opening `index.html` runs in live mode (manifest
  `/reports/index.json`) and opening `index.demo.html` runs in demo mode
  (manifest `/sample/index.json`). The same `app.js` and `styles.css` serve
  both.

### 2026-05-16 — Viewer-server routing for the new demo entry

File changed:
- `packages/viewer-server/src/server.ts`

What I did:
- Added a new branch in `handleRequest()` for `pathname === '/index.demo.html'`
  that serves `resolveViewerAssetPath('index.demo.html')`.

Why:
- The server uses a strict path allowlist (anything not matched falls through
  to 404). Without adding the route, requesting `/index.demo.html` would
  return 404 even though the file exists on disk.

What I learned:
- The existing routing is intentionally strict — `/`, `/index.html`,
  `/styles.css`, `/app.js`, `/viewer-config.demo.js`, `/sample/*`,
  `/reports/*`. Anything else 404s. Path traversal is blocked by
  `isInsideDirectory()` for `/sample/*` and `/reports/*`.
- Keeping the allowlist tight is the right default. Adding the demo route
  explicitly is consistent with the style.

### 2026-05-16 — Documentation pass

Files added:
- `apps/viewer/README.md`
- `packages/viewer-server/README.md`

What I did:
- Wrote a comprehensive Dev 3 README at `apps/viewer/README.md` covering:
  product context, where Dev 3 sits in the Bob → MCP → viewer flow (ASCII
  diagram), full request lifecycle, the eight rendered sections and the
  report fields they consume, live vs demo mode comparison table, server
  routing table, run instructions, end-to-end verification commands, and
  the "must NOT do" guardrails.
- Wrote a short companion README at `packages/viewer-server/README.md`
  with the exported API surface and a link back to the main doc.

Why:
- The codebase had no Dev 3 docs and the inline comments in the source were
  thin. Anyone landing on these files later (Dev 1 wiring `viewer-runtime.ts`
  in `mcp-server`, or a future maintainer) needed a single source of truth
  for how the viewer is wired.

### 2026-05-16 — Commit and push

What I did:
- Staged the six changed files (excluded the untracked `.idea/` directory).
- Committed as `viewer: split live and demo entry points, add Dev 3 docs`.
- `git push` initially rejected because Dev 1 had pushed
  `fe871c5 Dev 1: wire MCP server STDIO bootstrap` while I was working.
- `git fetch origin` then `git log HEAD..origin/main` showed exactly one new
  upstream commit (Dev 1, touching MCP / workspace files only — no overlap
  with my files).
- Ran `git rebase origin/main`. No conflicts because the changes touched
  disjoint paths.
- Re-pushed. Final commit on remote: `d495f1a`.

Why:
- Rebase over merge to keep the linear history pattern the team has used so
  far. The local commit had not been published yet, so rewriting its SHA was
  safe and produced a cleaner log.
- Verified Dev 1's `fe871c5` was still intact in `git log` after the push.

What I learned:
- Pre-push fetch + diff is the right hygiene step on a shared `main`. I
  should fetch before each commit-push cycle going forward.

### 2026-05-16 — Process log created and backfilled

What I did:
- Created this file (`dev3_impl_process.md`) after the team agreed on the
  per-dev process-log convention.
- Backfilled the prior entries above from this session's actions, in the
  order they happened.

Why:
- The convention was introduced after I had already done the demo split,
  routing fix, docs, commit, and push. I had context fresh enough to
  reconstruct an honest log, so I did it now rather than starting blank.
- Going forward, entries are appended live as I work.

## Convention for future entries

Each entry uses:
- `### YYYY-MM-DD — <short title>`
- A `What I did` section listing concrete file changes or commands.
- A `Why` section explaining the motivation.
- A `What I learned` section (optional) for non-obvious findings.
- A `Decision` section (optional) when I chose between alternatives.

Record each action *as I take it*, not after the fact. The point is to make
it easy to audit where an AI agent (or I) may have hallucinated context.
