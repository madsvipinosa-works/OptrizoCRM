# API contract

The agreement between the backend and the UI. Write an entry **before** building a module. The UI can build against mock data that matches it while the backend is built. Change an entry only in a PR that both people see.

Use whatever the repo already uses (server actions or route handlers). Keep the shapes below the same either way.

## Format for each entry

```
### <action name>  (step <n> in docs/mockups)
Who can call: <roles>
Input:  { ... }
Output: { ... }
Errors: <code>: <when>
Side effects: <status changes, notifications, audit log>
```

---

## Example entries

### requestProposal  (step 8)
Who can call: sales
Input:  `{ leadId: string }`
Output: `{ ok: true, leadId: string }`
Errors:
- `PROPOSAL_LOCKED`: the discovery meeting is not done or the discovery form is not submitted.
- `FORBIDDEN`: caller is not Sales.
Side effects: sets `proposalRequestedAt` on the lead (no separate request table); notification to the lead's PM (`assignedPmId`), or to every PM if none is assigned yet; audit log row; request appears in the PM proposal queue (step 9).

### claimLead  (step 2)
Who can call: sales
Input:  `{ leadId: string }`
Output: `{ ok: true, leadId: string }`
Errors:
- `FORBIDDEN`: caller is not Sales.
- `ALREADY_ASSIGNED`: the lead already has a Sales owner.
Side effects: lead assigned to the caller; a `system` interaction is written (it does not count as the first interaction, so the stage does not change); audit log row.

### sendProposal  (steps 10d and 17b)
Who can call: manager
Input:  `{ proposalId: string }`
Output: `{ ok: true, version: number, status: 'sent' }`
Errors:
- `MILESTONES_INVALID`: not exactly the 5 default milestones, or dates missing.
- `SCHEDULE_NOT_100`: priced proposal whose payment schedule doesn't total 100%. The same check runs when the schedule is saved (see `savePaymentSchedule`).
Side effects: lead stage → `proposal_sent` (if earlier); previous version → `replaced`; client email + portal notification; audit log row.

### requestPricingMeeting  (step 11)
Who can call: client (own proposal only)
Input:  `{ proposalId: string, note?: string }`
Output: `{ ok: true }`
Side effects: proposal status → `pricing_meeting_requested`; notification to the lead's PM (step 12); audit log row.

### submitTask  (step 25)
Who can call: developer (assigned task only)
Input:  `{ taskId: string, files: string[], links: string[], note?: string }`
Output: `{ ok: true, status: 'in_review' }`
Errors:
- `NEED_FILE_OR_LINK`: no file and no link.
- `FORBIDDEN`: caller is not the assigned developer.
- `INVALID_STATUS`: task is not `in_progress` or `changes_requested`.
Side effects: task → `in_review`; PM notification; audit log row. There is no automated or AI review. The PM's Approve or Request changes is the only review.

### confirmPayment  (step 29b)
Who can call: manager
Input:  `{ paymentId: string, method: 'bank_transfer' | 'gcash' | 'cheque' | 'cash', receivedAt: string, referenceNo?: string, orNumber: string }`
Output: `{ ok: true, status: 'paid' }`
Errors: `REFERENCE_REQUIRED`: method is bank_transfer, gcash or cheque and `referenceNo` is empty. For cheques, `referenceNo` holds the cheque number and bank.
Side effects: payment → `paid`; client is notified and sees "Paid · confirmed by Optrizo"; audit log row.

---

## Entries

### scheduleMeeting  (steps 4 and 13)
Who can call: sales (type `discovery`), manager (types `budget_pricing`, `project_review`, `uat`)
Input:  `{ leadId: string, proposalId?: string, type: 'discovery' | 'budget_pricing' | 'project_review' | 'uat', format: 'video' | 'phone' | 'in_person' | 'on_site', startsAt: string, attendees: string[], agenda?: string }`
Output: `{ ok: true, meetingId: string }`
Errors: `FORBIDDEN`: the caller's role does not own that meeting type.
Side effects: meeting status `awaiting_client`; a `discovery` meeting moves the lead to `discovery` if it is not there yet; invite by email and in the client portal; the invite email includes a link to create a portal account linked to the lead (account status `invited` until the email is verified); reminder email one day before; audit log row.

### respondToMeeting  (steps 4c and 14)
Who can call: client (own meeting only)
Input:  `{ meetingId: string, response: 'confirm' | 'suggest_time' | 'decline', note?: string }`
Output: `{ ok: true, status: 'confirmed' | 'reschedule_requested' | 'cancelled' }`
Errors:
- `FORBIDDEN`: the meeting is not the caller's.
- `INVALID_STATUS`: the meeting is not `awaiting_client`.
Side effects: meeting status set; notification to the organizer. If the client declines a `budget_pricing` meeting, the PM is notified and the proposal stays `pricing_meeting_requested` until the PM logs an outside discussion or sends a priced version. Audit log row.

### rescheduleMeeting  (steps 4c and 14)
Who can call: the meeting's organizer (sales for `discovery`, manager for the other types)
Input:  `{ meetingId: string, startsAt: string }`
Output: `{ ok: true, status: 'awaiting_client' }`
Errors:
- `FORBIDDEN`: caller is not the organizer.
- `INVALID_STATUS`: the meeting is not `reschedule_requested`.
Side effects: new time saved; invite sent again by email and in the client portal; audit log row.

### submitDiscoveryForm  (step 6)
Who can call: sales
Input:  `{ leadId: string, goals: string, requiredFeatures: string, targetTimeline: string, budgetRange: string, clientType: 'local' | 'international', notes?: string }`
Output: `{ ok: true, leadId: string }`
Errors:
- `FORBIDDEN`: caller is not Sales.
- `MEETING_NOT_DONE`: the discovery meeting is not marked done.
Side effects: form saved with `submittedAt`; `clientType` is copied to the lead (the form is the source of truth); the lead shows "requirements complete" (step 7); audit log row.

### reopenLead  (step 18j)
Who can call: sales
Input:  `{ leadId: string, reason: string }`
Output: `{ ok: true, leadId: string, stage: 'discovery' }`
Errors:
- `FORBIDDEN`: caller is not Sales.
- `INVALID_STAGE`: the lead is not `closed_lost`.
- `REASON_REQUIRED`: `reason` is empty.
Side effects: stage → `discovery`; a `system` interaction records the reopen and the reason; audit log row.

### archiveLead  (step 18j)
Who can call: sales
Input:  `{ leadId: string }`
Output: `{ ok: true, leadId: string }`
Errors: `FORBIDDEN`: caller is not Sales.
Side effects: sets `archivedAt`, which hides the lead from the pipeline. Archive is not a stage, so the stage does not change. Audit log row.

### logOutsideDiscussion  (step 18f)
Who can call: manager
Input:  `{ proposalId: string, type: 'call' | 'email' | 'in_person', heldAt: string, summary: string, visibleToClient?: boolean }`
Output: `{ ok: true }`
Errors: `FORBIDDEN`: caller is not the PM.
Side effects: saved to the proposal history; copied by the system into the lead's activity log as an `outside_discussion` interaction (the PM's lead view stays read-only); audit log row.

### savePaymentSchedule  (step 17a)
Who can call: manager
Input:  `{ proposalId: string, items: { label: string, percent: number, trigger: string }[] }`
Output: `{ ok: true }`
Errors:
- `FORBIDDEN`: caller is not the PM.
- `SCHEDULE_NOT_100`: the percents do not total 100.
Side effects: schedule saved; amounts are calculated from the total price; audit log row.

### signProposal  (step 19)
Who can call: client (own proposal only)
Input:  `{ proposalId: string, signerName: string, signatureData: string, agreedToTerms: true }` (`signatureData` is a typed name or an uploaded signature image; the server adds `signerIp` and `signedAt`)
Output: `{ ok: true, status: 'signed', projectId: string }`
Errors:
- `PROPOSAL_EXPIRED`: `validUntil` has passed. The client sees "This proposal has expired. Contact your Project Manager."
- `INVALID_STATUS`: the proposal is not the current sent version, or has no price.
- `FORBIDDEN`: the proposal is not the caller's.
Side effects: saves `signerName`, `signatureData`, `signedAt`, `signerIp`; proposal → `signed`; lead → `closed_won`; project created with the 5 milestones and the payment schedule; first payment becomes `due`; PM and Sales notified; signed copy emailed to the client; audit log row.

### markEmptyMilestoneDone  (step 28)
Who can call: manager
Input:  `{ milestoneId: string, reason: string }`
Output: `{ ok: true, status: 'done' }`
Errors:
- `FORBIDDEN`: caller is not the PM.
- `MILESTONE_HAS_TASKS`: the milestone has tasks.
- `NOT_CURRENT`: the milestone is not the one that is `in_progress`.
- `REASON_REQUIRED`: `reason` is empty.
Side effects: milestone → `done` with the reason saved in `doneReason`; the next milestone starts; any payment tied to it becomes `due`; client progress updates; audit log row.

### deleteBacklogTask  (step 23)
Who can call: manager
Input:  `{ taskId: string }`
Output: `{ ok: true }`
Errors:
- `FORBIDDEN`: caller is not the PM.
- `TASK_STARTED`: the task has been started before, so it cannot be deleted.
Side effects: task deleted; audit log row. Development cannot close while backlog tasks remain, so the PM either schedules them into a sprint or deletes them with this action.

### rejectPaymentProof  (step 29b)
Who can call: manager
Input:  `{ paymentId: string, reason: string }`
Output: `{ ok: true, status: 'due' }`
Errors:
- `FORBIDDEN`: caller is not the PM.
- `INVALID_STATUS`: the payment is not `proof_uploaded`.
- `REASON_REQUIRED`: `reason` is empty.
Side effects: payment → `due`; the reason is saved in `proofRejectedReason`; the client is notified; audit log row.

### recordSignOff  (step 30a)
Who can call: manager
Input:  `{ projectId: string, signedFileUrl: string, signedOffAt: string }`
Output: `{ ok: true }`
Errors:
- `FORBIDDEN`: caller is not the PM.
- `FINAL_PAYMENT_NOT_PAID`: the final payment is not `paid`.
Side effects: saves `signedOffBy`, `signedOffAt` and `signOffFileUrl`; audit log row. There is no client online sign-off.

### completeProject  (step 30)
Who can call: manager
Input:  `{ projectId: string }`
Output: `{ ok: true, warrantyEndsAt: string }`
Errors:
- `FORBIDDEN`: caller is not the PM.
- `MILESTONES_NOT_DONE`: a milestone is not `done`.
- `FINAL_PAYMENT_NOT_PAID`: the final payment is not `paid`.
- `HANDOVER_FILES_MISSING`: no handover file is uploaded.
- `SIGN_OFF_MISSING`: the completion sign-off is not recorded.
Side effects: project status → `completed`; `completedAt` set; `warrantyEndsAt` = `completedAt` + 3 months (always 3 months); the client is notified automatically; audit log row. Handover notes are optional.

### requestPasswordReset  (sign-in, forgot password)
Who can call: anyone who is not signed in
Input:  `{ email: string }`
Output: `{ ok: true }` (the same response whether or not the email has an account)
Errors: `TOO_MANY_ATTEMPTS`: the rate limit was hit.
Side effects: if the account exists, a reset link valid for 1 hour is emailed; audit log row.

### resetPassword  (sign-in, forgot password)
Who can call: anyone who is not signed in
Input:  `{ token: string, password: string }`
Output: `{ ok: true }`
Errors:
- `TOKEN_INVALID`: the link is wrong or has expired (links are valid for 1 hour).
- `WEAK_PASSWORD`: fewer than 8 characters, no uppercase letter, or no number or symbol.
- `TOO_MANY_ATTEMPTS`: the rate limit was hit.
Side effects: password changed; audit log row.

(Add one per action as modules are built.)
