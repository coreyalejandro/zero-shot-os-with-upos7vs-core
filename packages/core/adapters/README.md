# Model Adapters

Adapter layer for model providers and backends.

## What This Provides

- Provider normalization
- Request/response shaping
- Multi-provider routing hooks

## Inputs

- Model requests
- Provider config

## Outputs

- Provider responses
- Normalized results

## Dependencies

- Internal: core config, utils
- External: provider SDKs

## Standalone Notes

Portable if copied with `packages/core/adapters` and provider configs.
