# ADR 0005: Ollama-First AI Provider with Cloud-Replacement Path

- **Date:** 2026-02-18
- **Status:** Accepted

## Context

The demo needs local AI behavior with no external dependency while preserving an upgrade path to cloud inference.

## Decision

Use Ollama as the default AI provider for demo/runtime development through an adapter behind `AiInferencePort`.

- Primary local endpoint via `OLLAMA_BASE_URL`
- Model selection via environment (`OLLAMA_CHAT_MODEL`, `OLLAMA_EMBED_MODEL`)
- Cloud provider support to be added via an alternate adapter without domain/use-case changes

## Verified local models (2026-02-18)

- `mxbai-embed-large:latest`
- `deepseek-r1:8b`
- `phi:latest`
- `smollm:latest`

## Consequences

- Pros:
- Offline-friendly demo behavior
- No cloud key requirement for baseline development
- Preserves provider portability through architecture boundary

- Cons:
- Local model quality/performance may vary by hardware
- Requires local model lifecycle management

