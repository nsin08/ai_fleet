# Sprint Context

**Project:** AI Fleet  
**Framework:** space_framework  

---

## Purpose

This directory contains durable sprint artifacts that should be committed to version control, including:
- Sprint plans
- Sprint retros
- Velocity metrics
- Planning notes

Temporary artifacts (drafts, scratch notes) should go in `.context/temp/`, not here.

## Sprint Structure

### Planning & Retro Format

**File naming:** `YYYY-WW-{plan|retro}.md`

**Example:**
- `2026-W07-plan.md` — Plan for week 7 of 2026
- `2026-W07-retro.md` — Retro after week 7 of 2026

### Contents

Each sprint file should include:

```markdown
# Sprint [YYYY-WW]

**Dates:** YYYY-MM-DD to YYYY-MM-DD

## Goals
- Goal 1
- Goal 2

## Backlog
- Story #1: Description
- Story #2: Description

## Completed
- ✓ Story #X: Description
- ✓ Story #Y: Description

## Metrics
- Velocity: X points
- Bugs found: Y
- Average cycle time: Z days

## Notes
- Key learnings
- Blockers encountered
- Improvements for next sprint
```

## Cadence

- **Planning:** Weekly (typically Monday)
- **Standup:** Daily (async via GitHub issues + PRs)
- **Retro:** Weekly (typically Friday)

See `@space_framework 90-guides/03-operating-manual.md` for the full cadence.

## Accessing Team Context

Use the Copilot Spaces pattern:

```
@space_framework Load framework rules
@space_project Load sprint context

[Role: Implementer]
Task: What stories are planned for this sprint?
```

---

**Last Updated:** 2026-02-18
