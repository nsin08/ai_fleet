# Copilot Instructions: ai_fleet

**Project:** AI Fleet - Distributed agent orchestration and governance  
**Repository:** https://github.com/nsin08/ai_fleet  
**Framework:** space_framework (enforced governance)  
**Framework Repository:** https://github.com/nsin08/space_framework  
**Last Updated:** 2026-02-18

---

## 1. Load Framework Context (REQUIRED)

All agents must load framework rules first:

```
@space_framework Load: 10-roles/00-shared-context.md
```

This provides:
- Mandatory state machine (Idea → Approved → Ready → In Progress → In Review → Done → Released)
- AI agent boundaries (cannot merge, approve, or skip states)
- Enforced rules (DoR, DoD, artifact linking, approval gates)

---

## 1.1 Environment Awareness (Reduce Retries)

Agents MUST adapt to the user's environment and avoid guessing.

### Preflight (run once before GitHub/Git operations)

- Detect which shell you are in and output commands for that shell only.
- Confirm `git` exists (`git --version`).
- Confirm `gh` exists (`gh --version`).
- If you will create/update Issues/PRs/labels: confirm auth (`gh auth status`).
  - If not authenticated: STOP and ask the user to authenticate. Do not attempt alternate methods.

### GitHub tooling policy

- Prefer `gh` first for GitHub operations (issues/PRs/labels).
- Use GitHub MCP only if the user explicitly asks to use it (and only after checking it is available).
- Do not try multiple approaches for the same action; fail fast with the exact error and missing prerequisite.

### Branch safety

- Do not push directly to protected branches (`main`, `develop`, `release/*`) unless the user explicitly requests it.
- Use PR-based flow for merges; branch protection enforces policy server-side.

---

## 2. Project Identity

| Item | Value |
|------|-------|
| **Primary Language** | Python 3.11 + Node.js TypeScript |
| **Repository** | https://github.com/nsin08/ai_fleet |
| **CODEOWNER** | @nsin08 |
| **Tech Lead** | @nsin08 |
| **PM** | @nsin08 |

**Governance:**
- All work flows through the state machine (per Rule 01)
- Only CODEOWNER merges PRs (per Rule 06)

---

## 3. Quick Start: Setup & Development

### Clone and Install

```bash
git clone https://github.com/nsin08/ai_fleet
cd ai_fleet

# Python environment (3.11+)
python -m venv venv
source venv/bin/activate  # or `venv\Scripts\activate` on Windows
pip install -r requirements.txt

# Node.js environment (TypeScript)
npm install
```

### Run Tests

```bash
# Python tests
pytest tests/ -v

# TypeScript tests
npm test
```

### Run Locally

```bash
# Python API
python -m app.main

# Node.js services
npm run dev
```

### Linting & Formatting

```bash
# Python
black . && flake8 . && mypy .

# TypeScript
npm run lint && npm run format
```

---

## 4. Project Structure

```
ai_fleet/
├── .context/
│   ├── project/      # Architecture, ADRs, meetings (committed)
│   ├── sprint/       # Sprint plans, retros (committed)
│   ├── temp/         # Agent drafts (git-ignored)
│   ├── issues/       # Issue workspaces (git-ignored)
│   └── reports/      # Generated reports (git-ignored)
├── src/
│   ├── python/       # Python modules (agents, orchestration)
│   └── typescript/   # Node.js TypeScript services
├── tests/
│   ├── unit/         # Unit tests
│   └── integration/  # Integration tests
├── docs/             # Documentation, ADRs
├── .github/
│   ├── ISSUE_TEMPLATE/    # Issue templates (from space_framework)
│   ├── workflows/         # GitHub Actions (from space_framework)
│   ├── CODEOWNERS         # Code ownership rules
│   └── copilot-instructions.md (this file)
├── requirements.txt  # Python dependencies
├── package.json      # Node.js dependencies
└── README.md
```

---

## 5. File Organization Rules (Rule 11)

### Classification (where files go)

- **Agent-created default:** `.context/temp/` (drafts, scratch, logs) — git-ignored
- **Issue-related:** `.context/issues/{repo}-{issue}-{slug}__gh/` — git-ignored
- **Sprint-related:** `.context/sprint/` — committed
- **Project-related:** `.context/project/` — committed
- **Generated reports:** `.context/reports/` — git-ignored

### Required `.gitignore` entries

```gitignore
# Context: Local-only temp, issue workspaces, and reports (Rule 11)
.context/temp/
.context/issues/
.context/tasks-*/   # legacy (deprecated)
.context/reports/
```

---

## 6. Code Standards

### Before Opening a PR

- [ ] Tests written for each acceptance criterion (per Rule 03 DoD)
- [ ] Tests passing locally
- [ ] Lint/format checks passing locally
- [ ] No debug statements committed (print/console.log/etc.)
- [ ] No secrets committed

### Branch Naming (Rule 07)

**Pattern:** `<type>/<issue-id>-<slug>`

**Types:** `feature/`, `fix/`, `docs/`, `chore/`, `refactor/`, `test/`, `perf/`

**Examples:**
- `feature/42-agent-orchestration`
- `fix/99-scheduling-timeout`
- `docs/55-deployment-guide`

### Commit Message Format (recommended)

**Pattern:** `<type>(<scope>): <subject>`

**Types:** feat, fix, docs, refactor, test, chore, perf

**Example:**
```
feat(orchestration): add task queuing mechanism

Closes #42
```

### PR Requirements (Rule 08 + Rule 04)

- Must link to a single Story/Issue: `Closes #<id>` or `Resolves #<id>`
- Must include evidence mapping (each acceptance criterion → test + location)
- Must be reviewable (avoid unrelated changes)

**Evidence Mapping Table (required in PR body):**

| Criterion | Test | Location | Status |
|-----------|------|----------|--------|
| [criterion] | [test name] | [path:line] | ✓/✗ |

---

## 7. Role-Based Entry Points

When assigned work, load your role context:

| I am a... | Load | Then |
|-----------|------|------|
| **Implementer** | `@space_framework 10-roles/05-implementer.md` | Implement Story in `state:ready` |
| **Reviewer** | `@space_framework 10-roles/06-reviewer.md` | Review PR against DoD + evidence |
| **DevOps** | `@space_framework 10-roles/07-devops.md` | Release/deploy per governance |
| **Architect** | `@space_framework 10-roles/04-architect.md` | Validate feasibility + design |

---

## 8. Hard Boundaries (Cannot Override)

You CANNOT:
- Merge PRs (CODEOWNER only)
- Approve PRs (human reviewers only)
- Skip workflow states
- Modify security-sensitive governance without approval (e.g., CODEOWNERS, CI/CD) per Rule 10
- Access secrets or credentials

You CAN:
- Implement within assigned Story scope
- Open PRs with evidence mapping
- Request reviews and respond to feedback
- Document discoveries per Rule 11

---

## 9. Essential Workflows

### Starting Work on a Story

1. Story must be labeled `state:ready`
2. Create branch per Rule 07
3. Implement acceptance criteria + tests
4. Keep drafts in `.context/temp/` (promote durable notes to `.context/project/` or `.context/sprint/`)

### Opening a PR

1. Link issue: `Closes #123` / `Resolves #123`
2. Fill evidence mapping table
3. Request reviews (tag CODEOWNER + relevant reviewers)
4. Ensure CI is green

---

## 10. Discovery Workflow (Agents)

**Draft first:** put exploratory notes in `.context/temp/` (git-ignored).  
**Promote later:** move stable, durable information into:
- `.context/project/` (architecture, ADRs, meetings, runbooks)
- `.context/sprint/` (sprint plans, retros)

---

## 11. Key References

- Framework roles: `@space_framework 10-roles/`
- Framework rules: `@space_framework 20-rules/` (especially Rule 01, 03, 04, 06, 07, 08, 10, 11)
- Templates: `.github/ISSUE_TEMPLATE/` in this repo
- Enforcement workflows: `.github/workflows/` in this repo

---

## Initialization Checklist (Human, One-Time)

- [x] Copy this file to `.github/copilot-instructions.md`
- [x] Fill Sections 2–6 with project-specific details
- [x] Ensure `.gitignore` has Rule 11 entries
- [x] Add CODEOWNERS file in `.github/CODEOWNERS`
- [x] Configure branch protection rules for `main` (see GitHub UI instructions below)
- [ ] Commit and push
