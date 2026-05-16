# Upgrade Process

## 2026-05-16

### Goal

Implement the first framework upgrade slice from [upgrade_plan.md](/Users/bilolbekrayimov/games/IBM_hackathon/upgrade_plan.md), starting with React, while preserving the existing Node v1 behavior.

### Completed

1. Reviewed the rollout strategy and confirmed the safest first milestone is the plan's "first implementation slice":
   - freeze v1 behavior
   - add parallel v2 contracts
   - add parallel v2 MCP tool names
   - add a Node adapter shim
   - add React support on top
2. Audited the current v1 implementation surface:
   - shared report and tool schemas
   - MCP tool registry
   - Node detectors for runtime, dependency, ops, and source analysis
   - report writer and existing report paths
   - contract tests protecting the current report and tool shape
3. Chose a compatibility-safe persistence approach for the new lane:
   - keep v1 reports on `reports/latest/report.json` and `reports/index.json`
   - place v2 reports on separate `report-v2` and `index-v2` paths so the current viewer is not disturbed before the dual-mode viewer work lands
4. Added the parallel v2 shared contract layer:
   - `stack-profile.ts`
   - `report-v2.ts`
   - `tool-results-v2.ts`
   - `manifest-v2.ts`
   - new v2 types, validation helpers, tool-name constants, and report-path constants
5. Built the adapter-based analysis lane:
   - added a framework adapter interface
   - added project descriptor helpers
   - added a Node adapter that wraps the existing Node detectors
   - added a React adapter that classifies React repos as `ecosystem = node`, `framework = react`
6. Added React-specific deterministic findings on top of the Node dependency scan:
   - legacy `react-scripts` detection
   - `react` / `react-dom` major mismatch detection
   - multiple React build-toolchain drift detection across Next.js, Vite, `react-scripts`, and Webpack markers
7. Registered the new parallel MCP v2 tools:
   - `discover_project_stack`
   - `collect_environment_evidence`
   - `inspect_framework_dependencies`
   - `inspect_platform_config`
   - `inspect_source_risks`
   - `compare_upgrade_paths`
   - `save_modernization_report_v2`
8. Added a separate v2 report persistence path:
   - `reports/latest/report-v2.json`
   - `reports/history/v2/*.json`
   - `reports/index-v2.json`
9. Added automated verification:
   - v2 report contract tests
   - v2 tool registry tests
   - MCP registry coverage for the parallel v2 lane
   - technical-plan coverage for the new v2 schemas
   - React framework discovery and React-specific dependency issue tests
10. Verified the implementation:
   - `npm run typecheck` passed
   - `npm test` passed with all test files green

### In Progress

1. No active implementation work remains in the React slice.

### Pending

1. Dual-mode viewer support for rendering v1 and v2 reports in the same UI.
2. Additional framework adapters in the planned order:
   - Python frameworks
   - Spring
   - Flutter
   - SwiftUI
3. Bob mode updates after the v2 path is fully established.

### Notes

1. The current worktree already had unrelated changes under `reports/` and an untracked `upgrade_plan.md`; those were left untouched.
2. The v1 Node tool names, contracts, and report paths were preserved in parallel with the new v2 lane.
