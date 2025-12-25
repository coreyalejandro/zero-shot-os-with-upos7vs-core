# Trust & Safety Core

Trust, safety, and rollback systems for policy enforcement.

## What This Provides

- Transactional safety
- Undo stacks and snapshots
- Guardrail notifications

## Inputs

- Policy checks
- State mutation intents

## Outputs

- Rollback data
- Audit trails

## Dependencies

- Internal: core utils, config
- External: see root package.json

## Standalone Notes

Portable if copied with `packages/core/trust` and shared core config.
