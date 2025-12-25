# Core Services

Service layer for analytics, telemetry, and mode routing.

## What This Provides

- Analytics service
- Telemetry service
- Mode routing service

## Inputs

- Service requests
- Runtime signals

## Outputs

- Service responses
- Telemetry events

## Dependencies

- Internal: core config, utils
- External: telemetry libraries

## Standalone Notes

Portable if copied with `packages/core/services` and core config.
