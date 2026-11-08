# Proposal: project feedback (CSAT) after completion (step 31)

Status: **built on branch ui/client-preview-links except the reminder (no scheduler exists yet). Backend should still review the spec change.**

## Problem

Clients can rate a finished project, but nobody on staff can look at the results.
- The only read of `projectFeedback` is the client seeing their own rating (`ProjectFeedbackForm`).
- The PM gets a one-line notification ("Rating: 4/5") with no feedback section on the project page.
- Super Admin and analytics have nothing.
- One question tells us how satisfied the client was, not whether they would return or what went wrong.

## Decisions to confirm

| Question | Proposal |
|---|---|
| Required question | The 1–5 rating stays the only required one. |
| New optional questions | (1) "Would you recommend Optrizo?" 0–10. (2) "What could we have done better?" short text. |
| Who sees ratings and comments | PM of the project: rating, recommend score, both texts. |
| Super Admin | Counts and averages only: average rating, average recommend score, number of responses. No names, no comments, no links (CLAUDE.md rule). |
| Sales | Not in this change. |
| Separate ratings (communication, quality, timeliness) | No. Too many questions for the number of projects. |
| Reminder | One notification a few days after completion if no feedback yet (days to be set in the spec). |

## Phases

### Phase 1: spec and contract (Backend, with UI review)
- `workflow-spec.md`: step 31 and the `projectFeedback` row: add `recommendScore` (0–10, optional), `improvement` (text, optional). State who sees what (table above).
- `api-contract.md`: `submitProjectFeedback` input gains the two optional fields; add `getProjectFeedback` (PM) and the analytics fields.

### Phase 2: schema and rules (Backend)
- Migration `0022`: `ALTER TABLE project_feedback ADD COLUMN IF NOT EXISTS recommend_score integer CHECK (recommend_score BETWEEN 0 AND 10)` and `improvement text`. Idempotent, hand-applied like 0010–0021.
- `submitProjectFeedback` (`src/features/client-portal/feedback-actions.ts`): validate the new fields (range, max length), keep the one-submission rule and audit row.
- Read helper `getFeedbackForProject(projectId)`, permission-checked on the server: the project's PM only.
- Analytics query: average rating, average recommend score, response count. Counts and totals only.

### Phase 3: client UI
- `ProjectFeedbackForm`: add the two optional fields under the rating. Show them in the read-only view after submitting.

### Phase 4: PM UI
- "Client feedback" card on the PM project page: rating, recommend score, comments, date. The existing notification links here.
- Empty state: "No feedback yet", with the date completed.

### Phase 5: Super Admin analytics
- A small card on the analytics page: average rating, average recommend score, responses out of completed projects. No per-project rows.

### Phase 6: reminder and tests
- Scheduled reminder to the client (same mechanism as other scheduled reminders, if one exists) several days after completion if no feedback.
- Tests: validation ranges, one submission per client per project, only the project's PM can read comments, analytics returns aggregates only.

## Out of scope
Per-aspect ratings, Sales view, public testimonials from feedback (testimonials stay a separate content feature), survey builder.
