# Schema Versioning

## Purpose

This document defines how shared contracts evolve without causing silent drift across the monorepo.

## Ownership

Dev 4 owns the versioning policy for contract changes, even when feature requests originate from other teams.

## Architectural Rules

- Treat any shared-field rename as a breaking change.
- Treat stronger validation on existing fields as a compatibility-sensitive change.
- Prefer additive optional fields for MVP evolution.
- Update fixtures, snapshots, tests, and docs together.

## Extension Strategy

- Stage changes in this order:
  1. schema/constants
  2. inferred types
  3. validation helpers
  4. fixtures and tests
  5. consumer rollout

## Migration Considerations

- Current schema has no explicit `schemaVersion` field because the technical plan does not define one yet.
- If a future change requires multiple artifact formats in parallel, add an explicit version discriminator in shared before consumers branch on behavior.

## Compatibility Guarantees

- Optional `subdirectory` remains the main backward-compatibility allowance in the current report and manifest contracts.
- Canonical tool names remain stable and centrally owned.

## Validation Philosophy

- Versioning is a contract-management concern, not a consumer-specific workaround.
- Breaking changes should be obvious in review because snapshot and fixture diffs will surface them.

## Example Valid Payload

`fixtures/contracts/reports/backward-compatible-report.json`

## Example Invalid Payload

`fixtures/contracts/manifests/malformed-manifest.json`
