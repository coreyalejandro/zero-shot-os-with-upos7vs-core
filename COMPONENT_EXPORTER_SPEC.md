# Component Exporter (Spec)

## Goal

Export components for reuse in other repos without breaking modularity.

## Non-Negotiables

- Export is explicit and opt-in.
- Uses inventory metadata for traceability.

## Inputs

- `component-inventory.json` or `components.json`
- `export` metadata per component

## Required Inventory Fields (Exportable Components)

- `export.paths` — list of paths to include

## Optional Fields

- `export.dependencies` — additional component IDs
- `export.bundle` — output package name

## Output

- Exported bundle or copied files
- Manifest for provenance
