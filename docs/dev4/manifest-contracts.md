# Manifest Contracts

## Purpose

The manifest contract powers viewer lookup and report history browsing through `reports/index.json`.

## Ownership

Dev 4 owns `packages/shared/src/schemas/manifest.ts`.

## Architectural Rules

- `latestReportPath` must point to a report JSON path under `reports/`.
- `history` entries must use deterministic timestamp-based IDs.
- Optional `subdirectory` is allowed for monorepo targeting.
- Unknown keys are rejected.

## Extension Strategy

- Keep the manifest minimal; do not duplicate full report data here.
- Add only lookup metadata that the writer and viewer both need.

## Migration Considerations

- History ordering remains the writer’s responsibility, but schema tests lock the field set.
- Path validation reduces the chance of malformed viewer lookups or unsafe path traversal.

## Compatibility Guarantees

- Dev 1 can write manifests that Dev 3 reads without guessing field names.
- Saved artifact references stay stable across report generations.

## Validation Philosophy

- The manifest is not a loose cache; it is a typed artifact.
- Invalid history entries should fail before viewer usage.

## Example Valid Payload

`fixtures/contracts/manifests/valid-manifest.json`

## Example Invalid Payload

`fixtures/contracts/manifests/malformed-manifest.json`
