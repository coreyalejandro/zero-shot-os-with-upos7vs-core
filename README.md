# UPOS7VS - Universal Prompt Orchestration System

**The only prompt orchestrator you need for multi-model AI development.**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue.svg)](https://www.typescriptlang.org/)

> **Status:** practice sprint (December 2025 – February 2026), kept for the record. Its automated component-inventory check fails on the latest version.

## What is UPOS7VS?

UPOS7VS (Universal Prompt Orchestration System - 7 Variables Standardized) is a **local-first, privacy-focused** prompt engineering platform that:

- 🎯 **Routes prompts intelligently** across OpenAI, Anthropic, Ollama, Watson, and more
- 📊 **Tracks costs and performance** with real-time analytics dashboard
- 🔒 **Keeps data local** - nothing leaves your machine unless you choose
- 🎨 **Semantic mode detection** - automatically picks the right mode for your task
- ⚡ **10-minute setup** - from zero to working system in under 10 minutes

## Quick Start (10 Minutes)

```bash
# 1. Clone and install
git clone https://github.com/coreyalejandro/zero-shot-os-with-upos7vs-core.git
cd upos7vs_multiplatform
npm install

# 2. Add your API key (choose one)
npm run config:set providers.openai.apiKey "sk-your-key"
npm run config:set providers.openai.enabled true

# 3. Send your first prompt
npm run cli
# Type: "Write a function that checks if a number is prime"

# 4. View analytics
cd dashboard && npm install && npm run dev
# Open http://localhost:3000
```

**You just saved 2-3 hours vs. manual multi-platform setup.**

## Component Inventory (Zero-Shot Install)

This repo ships with a minimal, per-repo `components.json` inventory to keep modules swappable and graphable.

1. Open `components.json` in the repo root
2. Update `repo.name` and `lastUpdated`
3. Add or edit component entries as you go

Details: `INSTALL_COMPONENT_INVENTORY.md`


## Why UPOS7VS?

| Problem | UPOS7VS Solution |
|---------|------------------|
| Switching between ChatGPT, Claude, Cursor | One CLI for all providers |
| No cost tracking | Built-in analytics dashboard |
| Copy-paste prompts between tools | Semantic routing auto-detects mode |
| Privacy concerns | 100% local, open-source |
| Vendor lock-in | Works with any LLM provider |

## Features

### Core Features (Open Source)

- ✅ Multi-provider orchestration (OpenAI, Anthropic, Ollama, Watson, Google)
- ✅ Semantic mode routing with confidence scores
- ✅ Local analytics and metrics (no cloud required)
- ✅ Privacy-first PII scrubbing
- ✅ Cost tracking per provider
- ✅ Next.js dashboard with real-time updates
- ✅ CLI and programmatic API
- ✅ TypeScript with full type safety
- ✅ 95%+ test coverage

### Enterprise Features (Commercial)

- 🏢 Team management with role-based access
- 📋 Compliance dashboards (SOC2, GDPR)
- 🔐 SSO/SAML integration
- 📞 Priority support with SLA
- 🔒 Advanced security features
- 📊 Multi-tenant analytics
- 🚀 Managed cloud hosting option

[Learn more about Enterprise →](https://upos7vs.com/enterprise)

## Documentation

- [Docs Index](./docs/README.md) - Complete documentation inventory (source of truth)
- [Quick Start Guide](./docs/QUICK_START.md) - 10 minutes to value
- [User Guide](./docs/USER_GUIDE.md) - Complete feature reference
- [Developer Guide](./docs/DEVELOPER_GUIDE.md) - Architecture and API
- [Architecture](./docs/V2_ARCHITECTURE.md) - System design deep-dive
- [Contributing](./CONTRIBUTING.md) - Join the community

## Architecture

```
┌─────────────────────────────────────────────────┐
│          CLI / Programmatic API                  │
└────────────────┬────────────────────────────────┘
                 │
┌────────────────▼────────────────────────────────┐
│         Orchestrator (Core Engine)               │
│  ┌──────────────┐  ┌────────────────────────┐  │
│  │ Mode Router  │  │ Analytics Service      │  │
│  └──────────────┘  └────────────────────────┘  │
└────────────────┬────────────────────────────────┘
                 │
┌────────────────▼────────────────────────────────┐
│          Provider Adapters                       │
│  [OpenAI] [Anthropic] [Ollama] [Watson] [...]  │
└─────────────────────────────────────────────────┘
```

## Use Cases

- **Developers:** Switch between models for code generation
- **Researchers:** Compare model outputs side-by-side
- **Teams:** Track AI costs across projects
- **Privacy-Conscious Users:** Keep all data local
- **Multi-Cloud Users:** Avoid vendor lock-in

## Roadmap

- [x] Core orchestration engine
- [x] Multi-provider support
- [x] Analytics dashboard
- [x] Semantic routing
- [ ] Browser extension
- [ ] VS Code extension
- [ ] Cloud sync (optional)
- [ ] Model fine-tuning helpers

## Community

- [GitHub Discussions](https://github.com/coreyalejandro/zero-shot-os-with-upos7vs-core/discussions)
- [Issue Tracker](https://github.com/coreyalejandro/zero-shot-os-with-upos7vs-core/issues)
- [Discord](https://discord.gg/YOUR_INVITE) (coming soon)

## Pricing

- **Open Source:** Free forever (MIT license)
- **Enterprise:** Starting at $299/month for teams of 10+
  - Includes: Team management, compliance tools, priority support
  - [Get Enterprise Trial →](https://upos7vs.com/enterprise)

## Support UPOS7VS

- ⭐ Star this repository
- 🐛 Report bugs and request features
- 📝 Improve documentation
- 💰 [Sponsor on GitHub](https://github.com/sponsors/coreyalejandro)
- 🏢 [Try Enterprise](https://upos7vs.com/enterprise)

## License

[MIT License](./LICENSE) - Free for personal and commercial use.

## Credits

Built with ❤️ by the UPOS7VS team and contributors.

Inspired by the need for privacy-first, local-first AI tooling.

---

**Ready to get started?** → [Quick Start Guide](./docs/QUICK_START.md)
