# Project Context

**Project:** AI Fleet - Distributed agent orchestration and governance  
**Repository:** https://github.com/nsin08/ai_fleet  
**Framework:** space_framework  
**Created:** 2026-02-18

---

## Purpose

This directory contains durable project documentation and architectural artifacts that are committed to version control.

## Contents

| Directory | Purpose |
|-----------|---------|
| `./README.md` | This file |
| `./ADR/` | Architectural Decision Records |
| `./ARCHITECTURE.md` | System architecture and design |
| `./RUNBOOKS/` | Operational runbooks |
| `./MEETINGS/` | Meeting notes and decisions |

## Quick Links

- **Framework Reference:** [@space_framework on GitHub](https://github.com/nsin08/space_framework)
- **Issue Tracker:** [GitHub Issues - ai_fleet](https://github.com/nsin08/ai_fleet/issues)
- **CI/CD Workflows:** [`.github/workflows/`](../../.github/workflows/)
- **Templates:** [`.github/ISSUE_TEMPLATE/`](../../.github/ISSUE_TEMPLATE/)

## Governance

This project enforces `space_framework` rules:
- **State Machine:** Idea → Approved → Ready → In Progress → In Review → Done → Released
- **Artifact Linking:** Every PR must link to an issue
- **Approval Gates:** CODEOWNER-only merges
- **Code Quality:** Automated via GitHub Actions

See `.github/copilot-instructions.md` for details.

## Team

| Role | GitHub Handle |
|------|---------------|
| CODEOWNER | @nsin08 |
| Tech Lead | @nsin08 |
| Product Manager | @nsin08 |

## File Organization (Rule 11)

### Committed (checked in)
- `.context/project/` — This directory (durable docs)
- `.context/sprint/` — Sprint artifacts (plans, retros)

### Git-Ignored (local only)
- `.context/temp/` — Agent drafts and scratch
- `.context/issues/` — Issue workspaces
- `.context/reports/` — Generated reports

## Getting Started

1. **Read the architecture:** See `./ARCHITECTURE.md` (if available)
2. **Check ADRs:** See `./ADR/` for design decisions
3. **Review runbooks:** See `./RUNBOOKS/` for operational procedures
4. **Load framework context:** Use `@space_framework` in Copilot to load rules

---

**Last Updated:** 2026-02-18
