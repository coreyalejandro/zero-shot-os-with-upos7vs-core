# Core Engine

Core orchestration and runtime services for Zero Shot OS.

## What This Provides

- Orchestration entry points
- Configuration and mode routing
- Trust and evaluation wiring

## Inputs

- Runtime config
- Mode rules
- Provider adapters

## Outputs

- Orchestration decisions
- Telemetry and audit events

## Dependencies

- Internal: adapters, trust, eval, services, utils
- External: see root package.json

## Standalone Notes

Portable if copied with the full `packages/core` subtree and root config conventions.
