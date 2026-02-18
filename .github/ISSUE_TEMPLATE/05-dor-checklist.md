# Definition of Ready Checklist

**Story:** #<!-- story-id -->
**Epic:** #<!-- epic-id -->
**Tech Lead:** @<!-- username -->
**Date:** <!-- YYYY-MM-DD -->

---

## ✅ Ready to Start Implementation

Before work begins, ALL items must be satisfied:

| # | Criterion | Status | Notes |
|---|-----------|--------|-------|
| 1 | Clear title (WHAT, not HOW) | ⬜ | |
| 2 | Problem statement exists | ⬜ | |
| 3 | Acceptance criteria specific & testable | ⬜ | |
| 4 | Success criteria documented | ⬜ | |
| 5 | Non-goals (scope boundaries) listed | ⬜ | |
| 6 | Owner assigned | ⬜ | |
| 7 | Parent Epic linked | ⬜ | |
| 8 | Effort estimated (story points/time) | ⬜ | |
| 9 | Dependencies identified | ⬜ | |
| 10 | Test approach defined | ⬜ | |

---

## ✅ Examples

### ❌ NOT Ready (Vague)

```markdown
## Title: Add authentication

## Description
We need to add user authentication.

## Acceptance Criteria
- Users can log in
```

**Why it fails:**
- No success criteria
- No scope boundaries
- No test approach
- No parent Epic
- No estimate

### ✅ Ready (Specific)

```markdown
## Title: Implement JWT Login Endpoint

Parent: #42

## Problem Statement
Users cannot access protected resources. Need secure authentication.

## Acceptance Criteria
1. POST /api/auth/login accepts email + password
2. Returns 200 with JWT token on success
3. Returns 401 on invalid credentials
4. Token expires after 24 hours
5. Token includes user_id and role claims

## Success Criteria
- All acceptance criteria verified by tests
- Response time < 200ms at p95
- No secrets logged

## Non-Goals (Out of Scope)
- Password reset (separate story)
- OAuth/social login (future Epic)
- MFA (future Epic)

## Dependencies
- User table exists (#38 - DONE)
- JWT library selected

## Test Approach
- Unit tests for token generation
- Integration tests for endpoint
- Security tests for validation

## Estimate
3 story points (~2 days)
```

---

## Tech Lead Sign-Off

- [ ] All DoR criteria satisfied
- [ ] Feasibility validated
- [ ] Requirements clear
- [ ] Ready to assign to IC

**Tech Lead:** @<!-- username -->  
**Date:** <!-- YYYY-MM-DD -->  
**Status:** ✅ Ready for In Progress

---

## Transition

When DoR is 100% satisfied:
- Tech Lead adds `state:ready` label
- PM assigns to Implementer
- Story moves to `In Progress`
- Implementer creates feature branch

If DoR NOT satisfied:
- Return to Tech Lead for clarification
- Update story with missing info
- Re-validate
