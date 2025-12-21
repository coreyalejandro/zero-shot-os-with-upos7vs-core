# Migration Context (Condensed)

**Purpose:** Provide portable, plug-in context so future sessions can resume instantly in this repo.

## What Changed (from the source repo)
- Hardened `ZERO_SHOT_BUILD_OS_ALL_IN_ONE_PPP.md` to be fully standalone (no external doc references).
- Fixed all Opus 4.5 audit items: fail-fast in bash, preflight checks, schema URL fixes, heredoc balance, idempotent git remote, `npm ci`, App Router only, venv setup for council, repo links updated.
- Updated `HANDOFF.md` with current state and next steps before migration.
- Migrated the minimal, required files only (core packages, governance schemas, dashboard app, and key artifacts).

## Why
- Zero-shot success depends on low entropy and deterministic execution.
- The old repo had too much noise; the new repo is intentionally minimal and build-ready.

## What’s Next
1. Run `npm run governance:check` (already passing post-migration).
2. Continue Phase 1 steps from `ZERO_SHOT_BUILD_OS_ALL_IN_ONE_PPP.md`.
3. Keep `HANDOFF.md` fresh (≤7 days) and update `openmemory.md` with decisions.

## Key Files to Load First
- `ZERO_SHOT_BUILD_OS_ALL_IN_ONE_PPP.md`
- `HANDOFF.md`
- `openmemory.md`
- `USER_PROFILE.md`
