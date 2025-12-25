# Component Inventory (Lite Install)

This is the minimal setup for a per-repo component inventory. No scripts required.

## Install (2 minutes)

1. Open `components.json` in the repo root.
2. Update the `repo.name` and `lastUpdated` fields.
3. Add or edit entries in `components` as you go.

## Update Rules

- Add a component when it becomes real.
- Keep `dependencies` accurate (use component IDs).
- Update `lastUpdated` whenever you change the file.
- Set `standalone: true` only when the component is portable and has a co-located `README.md`.

## Optional Validation

Use any JSON Schema validator with `COMPONENTS.schema.json` if you want strict checks.

## Aggregator (Later)

When you’re ready, use a separate aggregator module to roll up all repo inventories.
The per-repo `components.json` remains the source of truth.

## Automation (Recommended)

- `npm run components:check` validates schema, locations, and generated output.
- `npm run components:build` regenerates `component-inventory/COMPONENTS.md`.
- `npm run components:aggregate -- .` writes `components.index.json` and `components.graph.json`.
- `npm run components:summary` prints a diff-style summary for CI comments.
