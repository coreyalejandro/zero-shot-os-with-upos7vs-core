# Component Inventory System (Standalone, Copyable)

This document explains the **component inventory system** in this repo and how to **copy it to another repo** so it works the same way. It includes step-by-step instructions, a visual map, and a verification checklist with zero ambiguity.

## 1) What This Is (Plain-English)

This system is a **local, file-based inventory** of components. It:

- Stores component metadata in `components.json`
- Validates the file against `COMPONENTS.schema.json`
- Can generate a readable report file
- Can warn you if files exist under `components/` but are not listed in the inventory

It does **not** magically find components on its own unless you **run the scripts**. The scripts are the "engine."

## 2) Visual Map (How It Works)

```
components.json  -->  scripts/component-inventory/control.ts
       |                      |
       | validates against     | generates report
       v                      v
COMPONENTS.schema.json  component-inventory/COMPONENTS.md
```

Optional tools:

```
scripts/component-inventory/aggregate.ts  -> index + graph JSON
scripts/component-inventory/summary.ts    -> summary diff (for PRs)
```

## 3) Files That Make It Work (Copy List)

To make it standalone in another repo, copy **all** of these:

```
COMPONENTS.schema.json
components.json
scripts/component-inventory/control.ts
scripts/component-inventory/aggregate.ts
scripts/component-inventory/summary.ts
scripts/component-inventory/README.md
```

If you want the generated report to exist, also copy (or allow it to be generated):

```
component-inventory/COMPONENTS.md
```

## 4) Dependencies You Must Install

The validator script uses:

- `ajv`
- `ajv-formats`

Add to `package.json`:

```json
{
  "dependencies": {
    "ajv": "^8.17.1",
    "ajv-formats": "^2.1.1"
  }
}
```

Then install:

```bash
npm install
```

## 5) Add Scripts (So You Can Run It)

Add these to the new repo `package.json`:

```json
{
  "scripts": {
    "components:check": "tsx scripts/component-inventory/control.ts --strict --check-generated",
    "components:build": "tsx scripts/component-inventory/control.ts --write",
    "components:aggregate": "tsx scripts/component-inventory/aggregate.ts",
    "components:summary": "tsx scripts/component-inventory/summary.ts"
  }
}
```

## 6) One-Time Setup (Do This Exactly Once)

### Step-by-step (No Skips)

1) **Copy files** (see section 3).
2) **Install dependency** (section 4).
3) **Add scripts** (section 5).
4) **Open** `components.json` and set:
   - `repo.name` to the new repo name
   - `repo.root` to `"."`
   - `repo.lastUpdated` to the current time in ISO format
5) **Generate the report**:

```bash
npm run components:build
```

### Stop-and-check

You are done only when this file exists:

```
component-inventory/COMPONENTS.md
```

## 7) Daily Use (How to Keep It Accurate)

When you add or remove components:

1) Update `components.json`
2) Run:

```bash
npm run components:build
```

3) Optional strict check:

```bash
npm run components:check
```

### What the strict check does

It fails if:

- The JSON does not match the schema
- The generated report is missing or stale
- A file exists under `components/` but is not listed

## 8) Automatic Run on Install (Optional)

If you want it to run on install, add to `package.json`:

```json
{
  "scripts": {
    "postinstall": "npm run components:build"
  }
}
```

If you want to **fail the install** when inventory is stale, use:

```json
{
  "scripts": {
    "postinstall": "npm run components:check"
  }
}
```

## 9) Proof It Works (Verification Checklist)

Run these commands in order:

```bash
npm run components:build
npm run components:check
```

You should see:

- A new or updated `component-inventory/COMPONENTS.md`
- No errors in the terminal

If you see warnings about unregistered files, it means:

- A file exists in `components/`
- It is missing from `components.json`

That is expected until you add it.

## 10) Common Mistakes (And Exactly How To Avoid Them)

### Mistake: “It didn’t detect my component”

This system **does not auto-add** new components. You must list them in `components.json`, then run the build.

Correct action:

1) Add entry in `components.json`
2) Run `npm run components:build`

### Mistake: “Validation fails on install”

If you use `postinstall` with `check`, it will fail when:

- You forgot to run `components:build`
- The JSON changed but the generated report didn’t

Correct action:

```bash
npm run components:build
```

## 11) Minimal Example Entry (Copy/Paste)

```json
{
  "id": "my-repo/components/example-button",
  "name": "Example Button",
  "type": "ui",
  "description": "Simple button used across the app.",
  "ownerName": "Core Team",
  "status": "active",
  "version": "0.1.0",
  "standalone": false,
  "location": [
    "components/example-button.tsx"
  ],
  "interfaces": {
    "inputs": ["props"],
    "outputs": ["rendered UI"]
  },
  "dependencies": []
}
```

## 12) If You Want Auto-Scan (Read This Carefully)

Auto-scanning requires writing a new script that reads the filesystem and **writes component entries**. This repo **does not** include that by default. If you want it, say:

> “Build a scanner that auto-generates components.json from `components/`.”

I can add that for you if you want. This doc is for the current, working system.
