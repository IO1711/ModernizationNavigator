# Report Contracts

## Purpose

The report contract defines the normalized modernization artifact saved to disk and consumed by the viewer.

## Ownership

Dev 4 owns `packages/shared/src/schemas/report.ts` and `packages/shared/src/types/report.ts`.

## Architectural Rules

- `reportId` must be deterministic and timestamp-based.
- `createdAt` must be ISO-8601 with offset data.
- `toolTrace.toolName` must be one of the canonical tool names.
- Relative file paths inside reports must not traverse upward.
- Unknown top-level fields are rejected.

## Extension Strategy

- Prefer adding optional fields first.
- Avoid replacing existing field names when a new sibling field can carry the new meaning.
- Keep viewer-facing fields stable because Dev 3 renders directly from the contract.

## Migration Considerations

- `subdirectory` remains optional for backward compatibility.
- Empty arrays remain valid where “no data found” is a meaningful state.
- Tightening field formats should be accompanied by fixture updates and explicit release notes.

## Compatibility Guarantees

- Dev 1 can save reports with runtime validation.
- Dev 2 can return issues/evidence using the same issue model.
- Dev 3 can rely on stable key names and deterministic JSON serialization.

## Validation Philosophy

- A report must either parse completely or fail with specific field-level errors.
- Cross-package reports should never be treated as “mostly valid.”

## Example Valid Payload

`fixtures/contracts/reports/valid-report.json`

## Example Invalid Payload

`fixtures/contracts/reports/partial-report.json`
