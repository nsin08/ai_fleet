# ADR 0003: Governance Baseline Before Application Code

- **Date:** 2026-02-18
- **Status:** Accepted

## Context

The repository was initialized using `space_framework` and currently prioritizes governance workflows, templates, and controls.

## Decision

Keep governance artifacts as first-class and mandatory before implementation:

- Enforce issue and PR templates
- Enforce state machine and labeling rules
- Enforce CODEOWNER approval gates and workflow checks

Application implementation must align to these controls, not bypass them.

## Consequences

- Pros:
- Higher process clarity and traceability early
- Lower risk of ungoverned changes as codebase scales
- Smooth handoff to reviewer and release workflows

- Cons:
- Initial setup overhead before feature velocity
- Contributors must learn governance mechanics early

