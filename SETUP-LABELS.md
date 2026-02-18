# GitHub Labels Setup - AI Fleet

## Quick Start

### Option 1: Run PowerShell Script (Recommended)

```powershell
./scripts/create-labels.ps1 -Owner nsin08 -Repo ai_fleet
```

### Option 2: Run Individual gh Commands

Run these commands in your terminal. They will create all labels defined in Rule 12 (Label Taxonomy).

```bash
# STATE LABELS (Rule 01 - Workflow State Machine)
gh label create state:idea --description "Initial feature request or idea" --color 0366D6 --repo nsin08/ai_fleet
gh label create state:approved --description "Idea approved by PM/Architect" --color 0366D6 --repo nsin08/ai_fleet
gh label create state:ready --description "Ready for implementation (meets DoR)" --color 0366D6 --repo nsin08/ai_fleet
gh label create state:in-progress --description "Currently being implemented" --color 0366D6 --repo nsin08/ai_fleet
gh label create state:in-review --description "In code review" --color 0366D6 --repo nsin08/ai_fleet
gh label create state:done --description "Complete and merged (meets DoD)" --color 0366D6 --repo nsin08/ai_fleet
gh label create state:released --description "Deployed to production" --color 0366D6 --repo nsin08/ai_fleet

# TYPE LABELS (Rule 12 - Artifact Type)
gh label create type:idea --description "Feature idea or request" --color D4AF37 --repo nsin08/ai_fleet
gh label create type:epic --description "Large feature or work stream" --color D4AF37 --repo nsin08/ai_fleet
gh label create type:story --description "User story (implementable unit)" --color D4AF37 --repo nsin08/ai_fleet
gh label create type:task --description "Engineering task (docs/chore/refactor)" --color D4AF37 --repo nsin08/ai_fleet
gh label create type:bug --description "Bug fix" --color D4AF37 --repo nsin08/ai_fleet
gh label create type:chore --description "Infrastructure/maintenance" --color D4AF37 --repo nsin08/ai_fleet
gh label create type:docs --description "Documentation" --color D4AF37 --repo nsin08/ai_fleet

# PRIORITY LABELS (Rule 12 - Priority)
gh label create priority:critical --description "Blocks other work or production" --color DC3545 --repo nsin08/ai_fleet
gh label create priority:high --description "Important, should be next" --color DC3545 --repo nsin08/ai_fleet
gh label create priority:medium --description "Standard priority" --color DC3545 --repo nsin08/ai_fleet
gh label create priority:low --description "Nice to have" --color DC3545 --repo nsin08/ai_fleet

# ROLE LABELS (Rule 12 - Assigned Role)
gh label create role:sme --description "Subject matter expert input needed" --color 6F42C1 --repo nsin08/ai_fleet
gh label create role:architect --description "Requires architectural review" --color 6F42C1 --repo nsin08/ai_fleet
gh label create role:reviewer --description "Requires code review" --color 6F42C1 --repo nsin08/ai_fleet
gh label create role:devops --description "DevOps/infrastructure task" --color 6F42C1 --repo nsin08/ai_fleet

# NEEDS LABELS (Rule 12 - Blockers)
gh label create needs:design --description "Requires design decision" --color FFA500 --repo nsin08/ai_fleet
gh label create needs:sre --description "SRE input needed" --color FFA500 --repo nsin08/ai_fleet
gh label create needs:testing --description "Additional testing required" --color FFA500 --repo nsin08/ai_fleet
gh label create needs:documentation --description "Documentation required" --color FFA500 --repo nsin08/ai_fleet
```

### Option 3: Verify Labels Created

```bash
gh label list --repo nsin08/ai_fleet
```

---

## Label Taxonomy (Rule 12)

| Category | Labels | Purpose |
|----------|--------|---------|
| **STATE** | idea, approved, ready, in-progress, in-review, done, released | Workflow state machine (Rule 01) |
| **TYPE** | idea, epic, story, task, bug, chore, docs | Artifact classification |
| **PRIORITY** | critical, high, medium, low | Work urgency |
| **ROLE** | sme, architect, reviewer, devops | Required expertise |
| **NEEDS** | design, sre, testing, documentation | Blockers |

---

## How Labels Work in AI Fleet

1. **Every issue must have exactly ONE `state:*` label** (enforced by GitHub Actions)
2. **Every issue must have exactly ONE `type:*` label** (enforced by GitHub Actions)
3. **Issues may have multiple `priority:*`, `role:*`, `needs:*` labels**
4. **Label-to-state transitions:** When a PR is merged, the issue is automatically transitioned to `state:done`

See `.github/workflows/15-labeling-standard.yml` for enforcement.

---

**Last Updated:** 2026-02-18
