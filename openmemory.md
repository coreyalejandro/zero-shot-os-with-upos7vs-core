# OpenMemory Guide – upos7vs_multiplatform

## Governance Metadata

```json
{
  "facts": [
    {
      "id": "fact-001",
      "statement": "UPOS7VS is a unified prompt operating system that works across Cursor, ChatGPT, Claude, OpenAI API, and Notion",
      "addedAt": "2025-12-18T23:50:00.000Z",
      "source": "Project inception"
    },
    {
      "id": "fact-002",
      "statement": "Governance API layer implemented with Fastify, Ajv schema validation, and artifact compliance checking",
      "addedAt": "2025-12-18T23:50:00.000Z",
      "source": "Phase 0 implementation"
    },
    {
      "id": "fact-003",
      "statement": "Documentation quality maintained via markdownlint; fixed 150+ errors in ZERO_SHOT_BUILD_OS_ALL_IN_ONE_PPP.md",
      "addedAt": "2025-12-20T14:30:00.000Z",
      "source": "Documentation hygiene task"
    }
  ],
  "decisions": [
    {
      "id": "dec-001",
      "decision": "Use MIT license for open source core with commercial enterprise tier",
      "rationale": "Maximizes adoption while enabling revenue through enterprise features",
      "decidedAt": "2025-12-18T23:30:00.000Z",
      "alternatives": ["Apache 2.0", "Fully proprietary", "GPL"]
    },
    {
      "id": "dec-002",
      "decision": "Build multi-model LLM council using OpenRouter for governance decisions",
      "rationale": "Provides diverse perspectives and prevents single-model bias in architectural decisions",
      "decidedAt": "2025-12-18T23:30:00.000Z",
      "alternatives": ["Single model self-critique", "Human-only review"]
    }
  ],
  "risks": [
    {
      "id": "risk-001",
      "risk": "Market adoption may be slower than 30-day revenue target",
      "likelihood": "medium",
      "impact": "medium",
      "mitigation": "Enterprise outreach to 10+ companies, HN/Reddit launch for visibility"
    }
  ],
  "todos": [
    {
      "id": "todo-001",
      "task": "Complete Phase 1 of Zero-Shot-Build-OS launch plan",
      "status": "in-progress"
    },
    {
      "id": "todo-002",
      "task": "Create GitHub repository and public launch materials",
      "status": "pending"
    }
  ]
}
```

## Overview

- Unified Prompt Operating System (UPOS-7-VS) implementation that keeps prompt behavior consistent across Cursor, ChatGPT, Claude, OpenAI API/Vercel SDK, Notion worksheets, and generic agent frameworks.
- Core engine infers ROLE/OBJECTIVE/SCENARIO/TASK/FORMAT/CONSTRAINTS and enforces the REFLECT → EXPLORE → ANALYZE → SOLVE → OBSERVE → NOTIFY reasoning loop with optional Verbalized Sampling toggles.

## Architecture Map

- `cursor/rules/*.mdc` → source-of-truth for Cursor Project Rules; `.cursor/rules/*.mdc` are synced runtime copies applied inside this repo.
- `chatgpt/`, `claude/`, `openai-api/`, `notion/` → channel-specific instruction sets so every surface shares the same behaviors.
- `generic-agents/` → role definitions, prefix routing, and example agent code for frameworks like LangChain/LangGraph.
- `examples/` → concrete prompt examples per mode (UX/UI, Next.js, Agent architecture, Teaching, Enhancement review).
- Planned `enhancements/` workspace (see “Enhancement Tracker Blueprint”) will centralize roadmap docs, schemas, automation, and templates.

## Modes & Activation Prefixes

- Core (no prefix) applies to every interaction.
- `UPOS7VS-UXUI:` (UX/UI flows, accessibility, responsive layout guidance).
- `UPOS7VS-DEV:` (refactors, debugging, backend/API design, runtime safety).
- `UPOS7VS-NEXT:` (Next.js App Router + RSC specific decisions).
- `UPOS7VS-AGENT:` (agent orchestration, diagrams, tool pipelines).
- `UPOS7VS-LONG:` (teaching/long-form explanations).

## Key Components

- Cursor core rule: `cursor/rules/upos-7-vs-core.mdc` defines always-on behavior and sampling guardrails.
- Mode rule files (`upos-7-vs-uxui.mdc`, `upos-7-vs-dev.mdc`, `upos-7-vs-next.mdc`, `upos-7-vs-agent.mdc`, `upos-7-vs-long.mdc`) each describe activation triggers and deliverables.
- `chatgpt/custom-instructions.md`, `claude/project-system.md`, `openai-api/system-prompt.md`, and `notion/upos7vs-notion-template.md` mirror the core engine for their respective platforms.
- `generic-agents/agent-config.md` shows how to inject UPOS-7-VS personas into multi-agent orchestrators.
- Runtime engine (`packages/core/*`) provides production-grade building blocks:
  - Semantic mode routing: `packages/core/services/mode-router.service.ts` + embeddings client `packages/core/utils/embeddings-client.ts`
    - Provider adapters: `packages/core/adapters/` (OpenAI, Anthropic, Gemini, Watson, Ollama)
    - Privacy: PII scrubbing `packages/core/utils/pii-scrubber.ts` (used before analytics logging)
    - User config + keys: `packages/core/config.ts` (`ConfigManager`) now defaults to a **global** config file at `~/.upos7vs/config/config.json` (repo-scoped when constructed with a repoRoot)
    - Keys utilities: `packages/cli/keys-manager.ts` provides `npm run keys:status`, `npm run keys:set-gui` (now includes Gemini), and `npm run keys:import-env` to avoid re-exporting keys per repo/session
- Dashboard app (`dashboard/app/*`) provides a user-facing UI (Enhancements, Analytics, Router Metrics) plus an in-app **Handoff** panel:
  - `dashboard/app/api/handoff/route.ts` reads `HANDOFF.md` and returns content + metadata (last updated timestamp, parsed status, parsed “all tests passing” summary).
  - `dashboard/app/page.tsx` renders a structured handoff view with **Mark as read**, **Copy sanitized summary**, and a **Restore mode-rules snapshot** action (via `dashboard/app/api/mode-rules/route.ts`).

## Enhancement Tracker Blueprint

- Critical items identified:  
  C1 Populate this OpenMemory guide with architecture + namespaces (in progress).  
  C2 Automate syncing of Cursor rule source files into `.cursor/rules/` to prevent drift.
- Table-stakes items:  
  T1 Provide a UPOS7VS-DEV walkthrough plus verification tests.  
  T2 Maintain a cross-platform parity checklist spanning Cursor/ChatGPT/Claude/API/Notion.
- Value-added items:  
  V1 CLI scaffolder for new mode prompts and examples.  
  V2 Analytics layer capturing prompt usage + performance per mode.
- Upcoming structure: `enhancements/` root containing `README.md`, `catalog/{critical,table-stakes,value-added}`, `roadmap/2025-q1.md`, `schemas/enhancement.types.ts`, automation scripts (`sync-cursor-rules.ts`, `verify-mode-parity.ts`), and markdown/MD templates for new enhancements and status updates.

## User Defined Namespaces

- `cursor-rules`
- `prompt-surfaces`
- `agent-modes`
- `enhancement-tracker`
