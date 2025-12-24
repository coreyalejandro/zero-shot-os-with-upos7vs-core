# Component Preview App (Spec)

## Goal

Read-only preview of UI components so they can be seen, not just read.

## Non-Negotiables

- Preview is **read-only** (no write actions).
- Must still work if Editor fails.
- Uses inventory metadata only.

## Inputs

- `component-inventory.json` or `components.json`
- `preview` metadata per component

## Required Inventory Fields (UI Components)

- `preview.import` — module path to render
- `preview.props` — default props

## Optional Fields

- `preview.thumbnail` — quick grid preview

## UI

- Gallery grid
- Component detail page
- Search + filter by type/status

## Output

- Rendered component preview
- Zero filesystem writes
