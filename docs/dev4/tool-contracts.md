# Tool Contracts

## Purpose

Tool contracts define the MCP boundary between Bob/MCP orchestration and deterministic analysis helpers.

## Ownership

Dev 4 owns `packages/shared/src/schemas/tool-results.ts` and `packages/shared/src/constants/tool-names.ts`.

## Architectural Rules

- Every tool must have one input schema and one result schema.
- All tool names must come from `TOOL_NAMES`.
- Shared base analysis input is reused for the six repo-analysis tools.
- Save/viewer tools have dedicated payload shapes.

## Extension Strategy

- Add the canonical tool name constant first.
- Add the input/output schemas second.
- Add registry entries in `toolInputSchemas` and `toolResultSchemas`.
- Add fixtures and tests before MCP wiring changes land.

## Migration Considerations

- Avoid changing existing tool field names during the MVP.
- If output semantics change, prefer additive fields over renamed fields.

## Compatibility Guarantees

- Dev 1 can enumerate and validate the same tool names the docs promise.
- Dev 2 output can be validated before it crosses into MCP responses.
- Dev 3 remains insulated from tool payload churn because only saved reports reach the viewer.

## Validation Philosophy

- Unknown keys and malformed path fields are rejected at the shared boundary.
- Registry-based validation prevents “stringly typed” tool dispatch.

## Example Valid Payloads

- `fixtures/contracts/tools/valid-base-tool-input.json`
- `fixtures/contracts/tools/valid-open-report-viewer-input.json`

## Example Invalid Payloads

- `fixtures/contracts/tools/invalid-open-report-viewer-input.json`
- `fixtures/contracts/tools/invalid-compare-target-paths-result.json`
