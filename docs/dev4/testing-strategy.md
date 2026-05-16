# Testing Strategy

## Purpose

This document explains the contract-focused test matrix owned by Dev 4.

## Ownership

Tests live in `tests/contracts/*`, fixtures live in `fixtures/contracts/*`, and canonical snapshots live in `snapshots/contracts/*`.

## Architectural Rules

- Every contract family gets valid and invalid examples.
- Snapshot tests verify deterministic serialization.
- Coverage tests verify alignment with the technical plan’s top-level requirements.
- Registry tests verify that every canonical tool has both input and result coverage.

## Extension Strategy

- Add a fixture first, then a test, then a doc example.
- Keep fixtures deterministic and human-readable.
- Favor stable sample timestamps and IDs so snapshots do not churn.

## Migration Considerations

- Snapshot changes should be reviewed as contract changes, not incidental formatting noise.
- If a breaking change is intentional, update fixtures, snapshots, and docs in the same PR.

## Compatibility Guarantees

- Dev 1, Dev 2, and Dev 3 all get the same shared examples for integration and regression checks.

## Validation Philosophy

- Accept known-good payloads.
- Reject malformed payloads loudly.
- Preserve stable serialization so artifacts and tests remain reviewable.

## Example Valid Payloads

- `snapshots/contracts/valid-report.snapshot.json`
- `snapshots/contracts/valid-manifest.snapshot.json`

## Example Invalid Payloads

- `fixtures/contracts/reports/partial-report.json`
- `fixtures/contracts/tools/invalid-compare-target-paths-result.json`
