# Space Framework Adoption - Verification Checklist

**Project:** ai_fleet  
**Repository:** https://github.com/nsin08/ai_fleet  
**Adoption Date:** 2026-02-18  

---

## ✓ Completed Automated Setup

### Core Governance Files

- [x] `.github/copilot-instructions.md` (customized for ai_fleet)
- [x] `.github/CODEOWNERS` (specifies @nsin08 as CODEOWNER)
- [x] `.github/pull_request_template.md` (from space_framework)

### Issue Templates

- [x] `.github/ISSUE_TEMPLATE/01-idea.md`
- [x] `.github/ISSUE_TEMPLATE/02-epic.md`
- [x] `.github/ISSUE_TEMPLATE/03-story.md`
- [x] `.github/ISSUE_TEMPLATE/04-task.md`
- [x] `.github/ISSUE_TEMPLATE/05-dor-checklist.md`
- [x] `.github/ISSUE_TEMPLATE/06-dod-checklist.md`
- [x] `.github/ISSUE_TEMPLATE/07-feature-request.md`

### Enforcement Workflows (17 total)

- [x] `.github/workflows/01-enforce-state-machine.yml`
- [x] `.github/workflows/02-enforce-artifact-linking.yml`
- [x] `.github/workflows/03-enforce-approval-gates.yml`
- [x] `.github/workflows/04-audit-logger.yml`
- [x] `.github/workflows/05-security-gate.yml`
- [x] `.github/workflows/06-pr-validation.yml`
- [x] `.github/workflows/07-issue-validation.yml`
- [x] `.github/workflows/08-branch-protection.yml`
- [x] `.github/workflows/09-code-quality.yml`
- [x] `.github/workflows/10-release-automation.yml`
- [x] `.github/workflows/11-security-checks.yml`
- [x] `.github/workflows/12-epic-story-tracking.yml`
- [x] `.github/workflows/13-definition-of-ready.yml`
- [x] `.github/workflows/14-definition-of-done.yml`
- [x] `.github/workflows/15-labeling-standard.yml`
- [x] `.github/workflows/16-commit-lint.yml`
- [x] `.github/workflows/17-file-organization.yml`

### Context Hygiene (Rule 11)

- [x] `.gitignore` (includes `.context/temp/`, `.context/issues/`, `.context/reports/`)
- [x] `.context/project/README.md` (durable docs placeholder)
- [x] `.context/sprint/README.md` (sprint artifacts placeholder)

---

## ⚠ Manual Setup Required (Admin Actions)

### Step 1: Create GitHub Labels (Rule 12)

**Status:** ⏳ PENDING

**DO THIS NEXT:**

```bash
# Option A: Run the PowerShell script
./scripts/create-labels.ps1 -Owner nsin08 -Repo ai_fleet

# Option B: Run gh commands from SETUP-LABELS.md
# See: SETUP-LABELS.md for full list of commands

# Verification
gh label list --repo nsin08/ai_fleet | wc -l
# Expected: 28 labels
```

**Reference:** `SETUP-LABELS.md`

### Step 2: Configure Branch Protection for `main` (Rule 06)

**Status:** ⏳ PENDING

**DO THIS NEXT (GitHub Web UI ONLY):**

1. Navigate to: https://github.com/nsin08/ai_fleet/settings/branches
2. Click **"Add Rule"**
3. Configure per `SETUP-BRANCH-PROTECTION.md`:
   - Branch: `main`
   - Require PR: ✓
   - Require CODEOWNER review: ✓
   - Require status checks: ✓
   - Restrict who can push: ✓ (@nsin08)

**Reference:** `SETUP-BRANCH-PROTECTION.md`

---

## Expected File Tree

```
ai_fleet/
├── .context/
│   ├── project/
│   │   └── README.md ✓
│   └── sprint/
│       └── README.md ✓
├── .github/
│   ├── CODEOWNERS ✓
│   ├── copilot-instructions.md ✓
│   ├── pull_request_template.md ✓
│   ├── ISSUE_TEMPLATE/
│   │   ├── 01-idea.md ✓
│   │   ├── 02-epic.md ✓
│   │   ├── 03-story.md ✓
│   │   ├── 04-task.md ✓
│   │   ├── 05-dor-checklist.md ✓
│   │   ├── 06-dod-checklist.md ✓
│   │   └── 07-feature-request.md ✓
│   └── workflows/
│       ├── 01-enforce-state-machine.yml ✓
│       ├── 02-enforce-artifact-linking.yml ✓
│       ├── 03-enforce-approval-gates.yml ✓
│       ├── 04-audit-logger.yml ✓
│       ├── 05-security-gate.yml ✓
│       ├── 06-pr-validation.yml ✓
│       ├── 07-issue-validation.yml ✓
│       ├── 08-branch-protection.yml ✓
│       ├── 09-code-quality.yml ✓
│       ├── 10-release-automation.yml ✓
│       ├── 11-security-checks.yml ✓
│       ├── 12-epic-story-tracking.yml ✓
│       ├── 13-definition-of-ready.yml ✓
│       ├── 14-definition-of-done.yml ✓
│       ├── 15-labeling-standard.yml ✓
│       ├── 16-commit-lint.yml ✓
│       └── 17-file-organization.yml ✓
├── scripts/
│   └── create-labels.ps1 ✓
├── .gitignore ✓
├── SETUP-LABELS.md ✓
├── SETUP-BRANCH-PROTECTION.md ✓
├── VERIFICATION-CHECKLIST.md ✓ (this file)
├── README.md ✓
└── ... [project code]
```

---

## Verification Steps (Do These Now)

### 1. Verify Git Commit + Push

```bash
cd d:\wsl_shared\projects\ai_fleet
git log --oneline | head -3
git ls-remote origin | head -3
```

**Expected output:**
```
1d44b9e feat: adopt space_framework governance model
bb878c5 Initial commit
...
To https://github.com/nsin08/ai_fleet
1d44b9e1c...
```

### 2. Verify Files on GitHub

Visit: https://github.com/nsin08/ai_fleet

Check these files exist:
- [ ] `.github/copilot-instructions.md`
- [ ] `.github/CODEOWNERS`
- [ ] `.github/workflows/01-enforce-state-machine.yml`
- [ ] `.github/ISSUE_TEMPLATE/01-idea.md`
- [ ] `.context/project/README.md`
- [ ] `SETUP-LABELS.md`
- [ ] `SETUP-BRANCH-PROTECTION.md`

### 3. Verify Templates in Issue Creation UI

1. Go to https://github.com/nsin08/ai_fleet/issues/new/choose
2. You should see **7 templates:**
   - Idea
   - Epic
   - Story
   - Task
   - Definition of Ready
   - Definition of Done
   - Feature Request

### 4. Create GitHub Labels (DO THIS NEXT)

```bash
# Run label creation (PowerShell)
cd d:\wsl_shared\projects\ai_fleet
./scripts/create-labels.ps1 -Owner nsin08 -Repo ai_fleet
```

Then verify:
```bash
gh label list --repo nsin08/ai_fleet | grep state: | wc -l
# Expected: 7 state labels
```

### 5. Configure Branch Protection (Web UI ONLY)

Go to: https://github.com/nsin08/ai_fleet/settings/branches

1. Click **"Add Rule"**
2. Set Branch name pattern: `main`
3. Check:
   - [x] Require a pull request before merging
   - [x] Require approvals (≥1)
   - [x] Require CODEOWNERS review
   - [x] Require status checks to pass (strict)
   - [x] Restrict who can push to matching branches
4. Click **"Create"**

---

## Governance Model Summary

After complete setup, ai_fleet enforces:

| Rule | Enforcement | Status |
|------|-------------|--------|
| **Rule 01** (State Machine) | GitHub Actions + Labels | ✓ Automated |
| **Rule 03** (DoR/DoD) | GitHub Actions | ✓ Automated |
| **Rule 04** (Artifact Linking) | GitHub Actions | ✓ Automated |
| **Rule 06** (CODEOWNER Merge) | Branch Protection | ⏳ Manual (Step 5 above) |
| **Rule 07** (Branch Naming) | GitHub Actions | ✓ Automated |
| **Rule 08** (PR Hygiene) | GitHub Actions + GitHub Actions | ✓ Automated |
| **Rule 11** (File Organization) | GitHub Actions + .gitignore | ✓ Automated |
| **Rule 12** (Label Taxonomy) | GitHub Icons | ⏳ Manual (Step 4 above) |

---

## Next Steps

1. **Create labels** → Run `./scripts/create-labels.ps1` 
2. **Configure branch protection** → Go to Settings → Branches → Add Rule (main)
3. **Test with an issue** → Try creating an idea issue
4. **Test with a PR** → Create a feature branch + PR to verify workflows trigger
5. **Load framework context** → In Copilot, try: `@space_framework Load: 10-roles/00-shared-context.md`

---

## Support

- **Framework Docs:** https://github.com/nsin08/space_framework
- **Framework Adoption Guide:** https://github.com/nsin08/space_framework/blob/main/90-guides/01-framework-adoption.md
- **Project Copilot Instructions:** `.github/copilot-instructions.md` (in this repo)

---

**Last Updated:** 2026-02-18  
**Status:** ✓ Automated Setup Complete | ⏳ Manual Setup Pending
