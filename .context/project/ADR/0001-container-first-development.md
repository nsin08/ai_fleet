# ADR 0001: Container-First Development and Runtime

- **Date:** 2026-02-18
- **Status:** Accepted

## Context

The project starts from a governance-only repository and needs consistent setup across local development, CI, and demo environments.

## Decision

Adopt a container-first model for all core services:

- Frontend runs in a `web` container
- Backend and replay engine run in an `api` container
- Data is persisted in a `db` container (PostgreSQL)

Direct host execution is optional and only secondary to container workflows.

## Consequences

- Pros:
- Consistent environment across contributors
- Easier reproducible demos
- Simplified onboarding with one command startup

- Cons:
- Slightly slower iteration loops than native host-only workflows
- Requires Docker/Podman availability for all contributors

