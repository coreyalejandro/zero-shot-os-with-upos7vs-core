# Component Inventory Aggregator (Spec)

## Purpose

Aggregate per-repo `components.json` files into a global index and dependency graph.

## Inputs

- One or more repo paths containing `components.json`
- Optional include/exclude patterns

## Outputs

- `components.index.json` (flat list of all components)
- `components.graph.json` (nodes + edges for dependencies)
- Optional `COMPONENTS.md` summary report

## Minimal Behavior

1. Read each repo's `components.json`
2. Validate against `COMPONENTS.schema.json`
3. Merge into a single list (namespace conflicts resolved by repo/name)
4. Emit graph edges from each component's `dependencies`
5. Provide a summary count by type and status

## Notes

- Canonical format is JSON; YAML is an optional generated view.
- Per-repo registries remain the source of truth.
