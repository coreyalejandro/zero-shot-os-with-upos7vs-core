# Components

This file is generated from `components.json`.
Run `npm run components:build` after updating the registry.

## Repo

- Name: zero-shot-os-with-upos7vs-core
- Root: .
- Last Updated: 2025-12-25T07:46:37.000Z

## Summary

- Total components: 10
- By type: workflow=1, ui=1, package=6, service=2
- By status: active=10
- By standalone: standalone=1, non-standalone=9

## Components

### Component Inventory System

- ID: zero-shot-os-with-upos7vs-core/component-inventory-system
- Type: workflow
- Status: active
- Version: 0.1.0
- Standalone: true
- Owner: Core Team
- Location: components.json, COMPONENTS.schema.json, component-inventory, scripts/component-inventory
- Description: Validates components.json, generates COMPONENTS.md, and aggregates registries.
- Interfaces:
  - Inputs: components.json, COMPONENTS.schema.json, repo paths
  - Outputs: component-inventory/COMPONENTS.md, component-inventory/components.index.json, component-inventory/components.graph.json
- Dependencies: none

### Dashboard App

- ID: zero-shot-os-with-upos7vs-core/dashboard-app
- Type: ui
- Status: active
- Version: 0.1.0
- Standalone: false
- Owner: Core Team
- Location: dashboard
- Description: Next.js dashboard application for Zero Shot OS.
- Interfaces:
  - Inputs: routes, UI components
  - Outputs: dashboard UI
- Dependencies: none

### Core Engine

- ID: zero-shot-os-with-upos7vs-core/core-engine
- Type: package
- Status: active
- Version: 0.1.0
- Standalone: false
- Owner: Core Team
- Location: packages/core
- Description: Core orchestration, config, and runtime services for Zero Shot OS.
- Interfaces:
  - Inputs: runtime config, mode rules, provider adapters
  - Outputs: orchestration decisions, telemetry events
- Dependencies: none

### CLI

- ID: zero-shot-os-with-upos7vs-core/cli
- Type: service
- Status: active
- Version: 0.1.0
- Standalone: false
- Owner: Core Team
- Location: packages/cli
- Description: Command-line interface for configuration, exports, and governance checks.
- Interfaces:
  - Inputs: CLI commands, config files
  - Outputs: config updates, reports
- Dependencies: none

### Governance API

- ID: zero-shot-os-with-upos7vs-core/api
- Type: service
- Status: active
- Version: 0.1.0
- Standalone: false
- Owner: Core Team
- Location: packages/api
- Description: Fastify API surface for governance checks and integrations.
- Interfaces:
  - Inputs: HTTP requests
  - Outputs: API responses
- Dependencies: none

### Trust & Safety Core

- ID: zero-shot-os-with-upos7vs-core/core-trust
- Type: package
- Status: active
- Version: 0.1.0
- Standalone: false
- Owner: Core Team
- Location: packages/core/trust
- Description: Trust, safety, and rollback systems for policy enforcement.
- Interfaces:
  - Inputs: policy checks, state mutations
  - Outputs: rollback data, audit trails
- Dependencies: none

### Model Adapters

- ID: zero-shot-os-with-upos7vs-core/core-adapters
- Type: package
- Status: active
- Version: 0.1.0
- Standalone: false
- Owner: Core Team
- Location: packages/core/adapters
- Description: Adapter layer for model providers and backends.
- Interfaces:
  - Inputs: model requests
  - Outputs: provider responses
- Dependencies: none

### Evaluation Engine

- ID: zero-shot-os-with-upos7vs-core/core-eval
- Type: package
- Status: active
- Version: 0.1.0
- Standalone: false
- Owner: Core Team
- Location: packages/core/eval
- Description: Evaluation engine for policy, heuristic, and LLM grading.
- Interfaces:
  - Inputs: evaluation specs, run inputs
  - Outputs: scores, evaluation logs
- Dependencies: none

### Core Services

- ID: zero-shot-os-with-upos7vs-core/core-services
- Type: package
- Status: active
- Version: 0.1.0
- Standalone: false
- Owner: Core Team
- Location: packages/core/services
- Description: Service layer for analytics, telemetry, and mode routing.
- Interfaces:
  - Inputs: service requests
  - Outputs: service responses
- Dependencies: none

### Core Utilities

- ID: zero-shot-os-with-upos7vs-core/core-utils
- Type: package
- Status: active
- Version: 0.1.0
- Standalone: false
- Owner: Core Team
- Location: packages/core/utils
- Description: Shared utility helpers for logging, retries, and embeddings.
- Interfaces:
  - Inputs: utility parameters
  - Outputs: utility results
- Dependencies: none
