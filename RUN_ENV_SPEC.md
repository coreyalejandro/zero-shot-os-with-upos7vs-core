# RUN_ENV_SPEC — Zero-Shot Build Run Environment (Neuroinclusive)

**Purpose:** Define a deterministic, low‑friction run environment for the Zero‑Shot build with clear agent responsibility, minimal cognitive load, and predictable outcomes.

## Primary Recommendation (Use This)

**Agent:** Codex CLI (this environment) as the build runner.

**Why:**
- Already configured with the repo, toolchain, and zero‑shot build constraints.
- Deterministic behavior with visible command logs and explicit verification.
- Avoids tool‑switching overhead and context loss.

**Operating Mode:**
- No LLM calls required during the deterministic build steps.
- LLM usage only for optional copy edits *after* the build passes.

## System Requirements (Deterministic Baseline)

**OS:** macOS 13+ or Ubuntu 22.04+
**Node:** 20 or 22
**Python:** 3.11+
**RAM:** 16 GB minimum (32 GB recommended)
**Disk:** 20 GB free minimum
**Network:** Required only for `npm ci` and optional pushes; build steps themselves are offline.

## Zero‑Shot Run Profile (Default)

- `set -euo pipefail` for all shell steps.
- Run preflight step from `ZERO_SHOT_BUILD_OS_ALL_IN_ONE_PPP.md`.
- Use `npm ci` only; no `npm install`.
- Run `npm run governance:check` after each phase checkpoint.
- Keep `HANDOFF.md` updated within 7 days.

## Neuroinclusive Execution Rules

- **One step at a time:** Run only one step block before checking output.
- **Clear verification:** Every step must end with a binary PASS/FAIL check.
- **No branching:** Avoid conditional forks during the build unless explicitly documented.
- **Short feedback loop:** If a step fails, stop and fix before proceeding.
- **Minimal context switching:** Keep this document open alongside the PPP.

## Agent Responsibility

- **Build runner:** Codex CLI (primary).
- **Human approvals:** Only for decisions explicitly labeled Manual/Post‑Build.
- **Escalation:** If sandbox blocks a required step, request permission and rerun.

## If You Must Use Another Agent (Fallback Only)

These are allowed **only** if Codex CLI is unavailable:

1. **Claude Code** — use a single session, same preflight, same checks.
2. **ChatGPT** — only if it can run commands locally; otherwise not suitable for deterministic execution.
3. **Gemini** — acceptable for review/copy tasks, not for deterministic build execution.

**Rule:** Do not mix agents during a single build run.

## Cost/Timeout Controls

- Disable any LLM calls during the build steps.
- If LLMs are used for copy work after build:
  - Max 2,000 tokens per request.
  - Hard timeout: 30 seconds.
  - Budget: $5 per session.

## Verification Checklist (Run Order)

1. Preflight step from PPP (toolchain + paths + lockfile + npm ci).
2. `npm run governance:check` (must pass).
3. Phase 1 verification checks in the PPP.
4. Update `HANDOFF.md` and append to `SESSION_LOG.md`.

