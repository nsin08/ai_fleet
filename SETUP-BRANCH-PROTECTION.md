# Branch Protection Setup - AI Fleet

## Overview

GitHub branch protection rules enforce governance on the `main` branch, preventing accidental commits and enforcing code review. These are **admin-only** changes that cannot be automated via CLI or API alone in all cases.

---

## Manual Setup (GitHub Web UI)

### Required: GitHub Admin Access

You must be a **repository owner** or **have admin role** to configure branch protection.

### Steps (GitHub Web UI)

1. **Navigate to Branch Protection Rules**
   - Go to `https://github.com/nsin08/ai_fleet/settings/branch_protection_rules`
   - Or: Repository → Settings → Branches → Add Branch Protection Rule

2. **Configure for `main` Branch**

   | Setting | Value | Purpose |
   |---------|-------|---------|
   | **Branch name pattern** | `main` | Protects the default branch |
   | **Require a pull request before merging** | ✓ Checked | All changes via PR |
   | **Require approvals** | ✓ Checked, ≥1 approval | Code review requirement |
   | **Require status checks to pass** | ✓ Checked | All GitHub Actions pass |
   | **Require branches to be up to date** | ✓ Checked (Strict mode) | No merge conflicts |
   | **Require CODEOWNERS review** | ✓ Checked | CODEOWNER approval required |
   | **Restrict who can push to matching branches** | ✓ Checked | Only @nsin08 can push |
   | **Allow force pushes** | ○ Checked (select "Dismiss stale") | Allow force push after approval |
   | **Allow deletions** | ○ Unchecked | Prevent accidental deletion |

3. **Status Checks to Require** (if available)
   - `continuous-integration/github-actions/*` (all workflows)
   - Or manually select:
     - `01-enforce-state-machine`
     - `02-enforce-artifact-linking`
     - `03-enforce-approval-gates`
     - `06-pr-validation`
     - `07-issue-validation`
     - `09-code-quality`
     - `13-definition-of-ready`
     - `14-definition-of-done`

4. **Click "Create" to Apply**

---

## Alternative: GitHub API via gh CLI

If your repository supports full API automation, try this command:

```bash
gh api repos/nsin08/ai_fleet/branches/main/protection \
  --input - <<'EOF'
{
  "required_status_checks": {
    "strict": true,
    "contexts": [
      "01-enforce-state-machine",
      "02-enforce-artifact-linking",
      "03-enforce-approval-gates",
      "06-pr-validation",
      "07-issue-validation",
      "09-code-quality",
      "13-definition-of-ready",
      "14-definition-of-done"
    ]
  },
  "required_pull_request_reviews": {
    "dismiss_stale_reviews": true,
    "require_code_owner_reviews": true,
    "required_approving_review_count": 1
  },
  "enforce_admins": false,
  "allow_force_pushes": false,
  "allow_deletions": false,
  "required_linear_history": false,
  "allow_auto_merge": false,
  "lock_branch": false
}
EOF
```

**Note:** This may fail if your organization has custom branch protection settings. If so, use the **Web UI method** instead.

---

## Verification Checklist

After setting up branch protection, verify with:

```bash
# Check protection rules
gh api repos/nsin08/ai_fleet/branches/main/protection --jq .

# Try to push directly (should fail)
git push origin main  # This should be rejected
```

Expected output:
```
error: failed to push some refs to 'https://github.com/nsin08/ai_fleet.git'
hint: Updates were rejected because the branch is protected and requires at least one approving review and status checks to pass.
```

---

## Protected Branches Summary

| Branch | Requires PR | Requires CODEOWNER | Status Checks | Up to Date |
|--------|-------------|-------------------|---------------|-----------|
| `main` | ✓ Yes | ✓ Yes (@nsin08) | ✓ Yes (8+ workflows) | ✓ Yes (strict) |

---

## Workflow Enforcement Files

The following GitHub Actions workflows enforce governance rules on PRs:

1. **01-enforce-state-machine.yml** → Enforces state transitions (Rule 01)
2. **02-enforce-artifact-linking.yml** → Enforces issue linking (Rule 04)
3. **03-enforce-approval-gates.yml** → Enforces approval logic (Rule 06)
4. **06-pr-validation.yml** → Validates PR format
5. **07-issue-validation.yml** → Validates issue compliance
6. **09-code-quality.yml** → Runs code quality checks
7. **13-definition-of-ready.yml** → Enforces DoR (Rule 03)
8. **14-definition-of-done.yml** → Enforces DoD (Rule 03)

All must **pass** before merge is allowed.

---

## Rule Reference

| Rule | Enforcement | File |
|------|-------------|------|
| Rule 01 (State Machine) | GitHub Actions | `.github/workflows/01-enforce-state-machine.yml` |
| Rule 04 (Artifact Linking) | GitHub Actions | `.github/workflows/02-enforce-artifact-linking.yml` |
| Rule 06 (CODEOWNER Merges) | Branch Protection + CODEOWNERS file | `.github/CODEOWNERS` |
| Rule 08 (PR Hygiene) | GitHub Actions | `.github/workflows/06-pr-validation.yml` |

---

## Troubleshooting

### "I pushed to main but it didn't reject me"

Branch protection requires `main` to be a **protected branch** in GitHub web UI. CLI merges may bypass this—avoid using CLI for merges on protected branches.

### "Status checks keep failing"

Check the workflow logs:
```bash
gh run list --repo nsin08/ai_fleet --workflow 01-enforce-state-machine.yml --limit 5 --json status
```

### "I need to bypass protection for emergency"

Only repository **admins** can dismiss failed status checks. Escalate to @nsin08 (CODEOWNER).

---

**Last Updated:** 2026-02-18  
**Reference:** space_framework Rule 06 (CODEOWNER Merge Authority)
