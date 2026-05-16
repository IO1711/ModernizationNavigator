# Validation Strategy

## Purpose

This document describes how Dev 4 enforces runtime safety at contract boundaries.

## Ownership

Validation helpers live in `packages/shared/src/utils/validation.ts`.

## Architectural Rules

- Use `parse*` helpers when invalid data should throw immediately.
- Use `validate*` helpers when callers need structured success/error results.
- Use `formatValidationErrors()` for readable diagnostics.
- Use `stringifyCanonicalJson()` for deterministic snapshots and artifact comparisons.

## Extension Strategy

- New shared payload types should receive parse and validate helpers if they cross package boundaries.
- Keep helper APIs small and composable.

## Migration Considerations

- Validation output is intentionally normalized to `path`, `message`, and `code`.
- Callers should not depend on raw Zod internals.

## Compatibility Guarantees

- Shared validation stays consistent no matter which package invokes it.
- Deterministic JSON snapshots reduce accidental contract churn.

## Validation Philosophy

- Fail fast on invalid data.
- Prefer explicit errors over partial acceptance.
- Keep human-readable diagnostics close to the contract layer.

## Example Valid Payloads

- Report parse target: `fixtures/contracts/reports/valid-report.json`
- Manifest parse target: `fixtures/contracts/manifests/valid-manifest.json`

## Example Invalid Payloads

- Report rejection: `fixtures/contracts/reports/invalid-report.json`
- Viewer-input rejection: `fixtures/contracts/tools/invalid-open-report-viewer-input.json`
