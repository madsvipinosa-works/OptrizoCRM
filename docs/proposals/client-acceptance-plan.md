# Proposal: client acceptance at project completion (steps 30, 30a, 31)

Status: **being built on branch ui/client-preview-links (decisions: wait 14 days, signed form optional). Backend should still review the spec change.**

## Problem

The PM alone records the sign-off (uploads a file, types a date) and marks the project complete. Nothing in the system shows that the client agreed. That one PM action starts the 3-month warranty and closes the project to further handover files.

## Target flow

1. PM uploads handover files (file or Google Docs / Drive link). The signed paper form is optional supporting evidence.
2. PM clicks **Request client acceptance**. Allowed only when all milestones are `done`, the final payment is `paid` and at least one handover file exists. Client is notified.
3. Client reviews the handover files in the portal and chooses **Accept** or **Request fixes** (comment required; PM is notified, PM can add files and request again).
4. **Mark project complete** unlocks only after the client accepts. It starts the warranty and feedback (step 31), as today.
5. If the client does not answer within N days (spec decides N, e.g. 14), the PM may complete the project with acceptance recorded as `assumed` and a reason. Audited.

## Phases

### Phase 0: file uploads in completion (done)
- Handover and sign-off forms use the file picker (private upload) or a Google Docs / Drive link instead of a typed path. The file name field is gone.
- Server accepts uploads as before, plus `https://docs.google.com/...` and `https://drive.google.com/...` only (`validateHandoverRef` in `completion-actions.ts`).
- Open point: Google links may not be shared with the client. UI says so; the server cannot check it.

### Phase 1: spec and contract (Backend, with UI review)
- `workflow-spec.md`: steps 30/30a/31, the new `awaiting_acceptance` state, the assumed-acceptance rule, remove "no client online sign-off".
- `api-contract.md`: `requestClientAcceptance`, `acceptCompletion`, `requestCompletionFixes`, `completeProject` (new precondition).
- Decide N days and whether the signed form stays required (proposal: optional).

### Phase 2: schema and rules (Backend)
- Migration: on `agency_project` add `acceptanceRequestedAt`, `acceptedAt`, `acceptedBy`, `acceptanceAssumed` (boolean), `fixesRequestedAt`, `fixesComment`. Status enum (or derived state) for `awaiting_acceptance`.
- Server actions with permission checks: PM requests; only the project's client accepts or requests fixes; PM completes. Gate in `completeProject` replaces "sign-off recorded" with "accepted or assumed".
- Audit log row for each action. Notifications: client on request, PM on accept / fixes.

### Phase 3: PM UI
- `CompletionPanel`: gate list becomes milestones, final payment, handover files, client acceptance. Buttons: Request client acceptance, Complete (assumed, with reason) after N days.
- Show state: awaiting, fixes requested (with comment), accepted (who, when).

### Phase 4: client UI
- Portal project page: acceptance card with handover files, **Accept** and **Request fixes** (comment).
- Keep warranty date and feedback form after completion.

### Phase 5: hardening
- Move sign-off and handover files to private storage (`docs/gap-list.md` line 73).
- Tests: gate logic, only-the-client permission, assumed path, audit rows, Google link allowlist.

## Out of scope
Retainers, e-signature, scoring or automatic review.
