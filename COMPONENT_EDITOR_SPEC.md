# Component Editor App (Spec)

## Goal

Optional editor for modifying components. Must be isolated so Preview stays stable.

## Non-Negotiables

- Editor is optional and swappable.
- Preview app does not depend on Editor.

## Inputs

- `component-inventory.json` or `components.json`
- `edit` metadata per component

## Required Inventory Fields (Editable Components)

- `edit.entry` — editor route or entry point

## Optional Fields

- `edit.instructions` — short guidance

## Output

- Updated component files (when explicitly invoked)
