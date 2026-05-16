# Schema Architecture

## Purpose

`packages/shared` is the single source of truth for all cross-package contracts in Modernization Navigator. Dev 4 owns the shape of reports, manifests, tool payloads, shared constants, and validation helpers.

## Ownership

- Own: `packages/shared/*`, `fixtures/*`, `snapshots/*`, `tests/contracts/*`, `docs/dev4/*`
- Do not own: analyzer logic, MCP orchestration, viewer rendering, provider behavior

## Architectural Rules

- All cross-package payloads must be defined in Zod first.
- Public TypeScript types must come from `z.infer`.
- Tool names and report paths must come from shared constants.
- Shared schemas are `.strict()` unless a field is intentionally optional.
- Saved artifacts must remain serializable JSON only.

## Extension Strategy

- Add new cross-package fields in `packages/shared/src/schemas/*` first.
- Export the inferred type from `packages/shared/src/types/*`.
- Add fixtures and tests before other packages depend on the new field.
- Prefer additive, optional evolution unless the whole team agrees to a breaking change.

## Migration Considerations

- Optional fields preserve compatibility for older saved artifacts.
- Path validation blocks traversal and absolute-path drift in report-owned relative fields.
- Tool registries ensure new tools cannot appear without explicit contracts.

## Compatibility Guarantees

- Report shape is deterministic at the schema boundary.
- Manifest shape is viewer-safe and report-writer-safe.
- MCP tool contracts are centralized and keyed by canonical tool names.

## Validation Philosophy

- Parse early at package boundaries.
- Reject ambiguous payloads.
- Surface human-readable validation errors through shared helpers.

## Example Valid Payloads

- Report: `fixtures/contracts/reports/valid-report.json`
- Manifest: `fixtures/contracts/manifests/valid-manifest.json`

## Example Invalid Payloads

- Report: `fixtures/contracts/reports/invalid-report.json`
- Manifest: `fixtures/contracts/manifests/malformed-manifest.json`
