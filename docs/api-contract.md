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

### scheduleBudgetPricingMeeting  (step 12)
Who can call: manager
Input:  `{ proposalId: string, format: 'video' | 'phone' | 'in_person' | 'on_site', startsAt: string, agenda?: string }`
Output: `{ ok: true, meetingId: string }`
Errors:
- `UNAUTHORIZED` / `FORBIDDEN`: caller is not Manager.
- `PROPOSAL_NOT_FOUND`: proposal does not exist.
- `INVALID_STATUS`: proposal status is not `pricing_meeting_requested`.
Side effects: creates meeting with type `budget_pricing` and status `awaiting_client`; client invited; audit log row.

### requestProposalChanges  (step 18b)
Who can call: client (own proposal only)
Input:  `{ proposalId: string, topics: ('price' | 'timeline' | 'scope' | 'other')[], body: string }`
Output: `{ ok: true }`
Errors:
- `FORBIDDEN`: caller is not client or does not own the lead.
- `INVALID_STATUS`: proposal is not in `sent` or `pricing_meeting_requested`.
- `INVALID_INPUT`: no topics selected or body is empty.
Side effects: inserts `proposal_message` of kind `change_request`; proposal status → `changes_requested`; lead stage → `In Negotiation` (via `moveLeadToNegotiation`); PM notified; audit log row.

### sendClientMessage  (step 18d)
Who can call: client (own proposal only)
Input:  `{ proposalId: string, body: string }`
Output: `{ ok: true }`
Errors:
- `FORBIDDEN`: caller does not own the proposal.
- `INVALID_INPUT`: body is empty.
Side effects: inserts `proposal_message` of kind `message`; does NOT change proposal status or lead stage; PM notified; audit log row.

### replyToClient  (step 18e)
Who can call: manager
Input:  `{ proposalId: string, body: string }`
Output: `{ ok: true }`
Errors:
- `FORBIDDEN`: caller is not Manager.
- `INVALID_INPUT`: body is empty.
Side effects: inserts `proposal_message` of kind `reply`; client notified; audit log row.

### rejectProposalByClient  (step 18h)
Who can call: client (own proposal only)
Input:  `{ proposalId: string, reason?: string }`
Output: `{ success: true, message: string }`
Errors:
- `FORBIDDEN`: caller is not the client owner.
- `INVALID_STATUS`: proposal is already signed or replaced.
Side effects: ACID transaction locks proposal then lead (`for("update")`); proposal status → `declined`, `rejectionReason = reason`; lead stage → `Closed Lost` (lossReason `'other'`, lossNotes `reason`); PM and Sales notified; audit log row.

### recordPaperSignature  (step 19b)
Who can call: manager
Input:  `{ proposalId: string, signedFileUrl: string, signedAt: string }`
Output: `{ ok: true, status: 'signed', projectId: string }`
Errors:
- `FORBIDDEN`: caller is not Manager.
- `INVALID_STATUS`: proposal is not the latest sent version, or priceMode is not priced.
- `PROPOSAL_EXPIRED`: validUntil has passed in Asia/Manila timezone.
- `ALREADY_SIGNED`: another proposal for this lead is already signed.
Side effects: executes ACID transaction locking proposal then lead; saves `signatureType = 'paper'`, `signedFileUrl`, `signedAt`, status → `signed`; lead stage → `Closed Won`; provisions project and 5 milestones with payment schedule via `provisionProjectFromProposal`; post-commit notifications to PM, Sales, client; audit log row.

### provisionProjectFromProposal  (internal transactional engine)
Who can call: internal transaction caller (`signProposal`, `recordPaperSignature`)
Input:  `(tx, proposal)`
Output: `{ project: AgencyProject, created: boolean }`
Errors:
- Throws error if `proposal.leadId` is missing or lead has no associated `clientId`, rolling back the outer transaction.
Side effects: acquires PostgreSQL advisory transaction lock `pg_advisory_xact_lock(hashtext(leadId))`; checks idempotence (returns existing project if already provisioned); inserts `agency_project` with status `Kickoff`; inserts client stakeholder in `projectStakeholders`; inserts 5 delivery milestones (`Requirements & Architecture` as `In Progress`, remaining 4 as `Pending`) with dates copied from proposal milestones; creates `payment` rows from `paymentScheduleItems` with rounding remainder on last item and `on_signing` set to `due` with 14-day due date window.

### Removed / Deprecated Actions (Session 6 cleanup)
- `acceptProposalByClient`: Removed. Replaced by `signProposal` (digital signature with IP/timestamp audit) and `recordPaperSignature`.
- `markLeadAsWon`: Removed. Manual stage transition to Closed Won is prohibited. Leads transition to Closed Won exclusively via proposal signing.
- `convertLeadToProject`: Removed. Project provisioning is automated atomically during proposal signing via `provisionProjectFromProposal`.
- `updateLeadStatusWithAudit` / `bulkUpdateLeadStatus`: Updated to explicitly reject manual transitions to `Closed Won`, `Proposal Sent`, and `In Negotiation`.

---

## Session 7: Tasks, Milestones, Project Team, Developer Home

### UI Structure & Delivery Views (Session 7)
- **Project Team Management**: Implemented as a centered modal popup (`ProjectTeamDrawer`) titled "Project team" with the project title at top right, opened directly from the "Team" button on the PM project delivery board (`/dashboard/pm/[id]`). Displays the PM section ("You"), developers with their in-project open-task counts and red Remove link, Remove confirmation showing exact reassigned task count, "Add a developer" dropdown showing cross-project open tasks, and a read-only client line. No separate team page.
- **Milestone Sequential Strip**: Mounted as a top-level progress strip (`MilestoneStrip`) above the Kanban board showing the 5 sequential phases and offering the "Mark Milestone Done" modal for empty milestones.
- **Developer Home**: Hosted at `/dashboard/my-tasks` with a legacy redirect route at `/dashboard/dev` for backwards compatibility.

### addProjectTeamMember  (step 22a)
Who can call: manager
Input:  `{ projectId: string, userId: string }`
Output: `{ success: boolean, message?: string }`
Errors:
- `FORBIDDEN`: caller is not Manager.
- `INVALID_USER`: user does not exist, is inactive, or role is not `developer`.
- `PROJECT_NOT_FOUND`: project does not exist.
Side effects: inserts into `project_team_member` (`addedBy = session.user.id`) with `ON CONFLICT DO NOTHING`; notifies developer; audit log row.

### removeProjectTeamMember  (step 22a)
Who can call: manager
Input:  `{ projectId: string, userId: string }`
Output: `{ success: boolean, message?: string }`
Errors:
- `FORBIDDEN`: caller is not Manager.
Side effects: reassigns developer's open (not done) tasks in the project to the removing PM and writes notification; deletes `project_team_member` record; notifies removed developer; audit log row.

### startTask  (step 25)
Who can call: developer (assigned to task)
Input:  `{ taskId: string }`
Output: `{ success: boolean, message?: string }`
Errors:
- `FORBIDDEN`: caller is not a developer assigned to this task.
- `INVALID_STATUS`: task is not in status `to_do`.
- `MILESTONE_NOT_CURRENT`: task's milestone is not `In Progress`.
- `PREREQUISITE_INCOMPLETE`: prerequisite task (`dependsOnTaskId`) is not `done`.
Side effects: locks task for update, reads milestone for share; updates task status → `in_progress`; audit log row.

### submitTask  (step 26)
Who can call: developer (assigned to task)
Input:  `{ taskId: string, files?: { name: string; url: string; size?: number; type?: string }[], links?: { label: string; url: string }[], note?: string }`
Output: `{ success: boolean, message?: string }`
Errors:
- `FORBIDDEN`: caller is not a developer assigned to this task (re-verified inside tx).
- `INVALID_STATUS`: task is not in status `in_progress` or `changes_requested`.
- `PROOF_REQUIRED`: caller must provide at least one file or link.
Side effects: updates task status → `in_review`; stores proof files, links, and note; notifies assigned PM (or lead PMs / all managers); audit log row.

### approveTask  (step 27)
Who can call: manager
Input:  `{ taskId: string }`
Output: `{ success: boolean, message?: string }`
Errors:
- `FORBIDDEN`: caller is not Manager.
- `INVALID_STATUS`: task is not in status `in_review`.
Side effects: updates task status → `done`, `completedAt = now()`; checks if all non-deleted tasks in the milestone are `done`; if all done, calls `closeMilestoneAndAdvance` inside the same transaction; notifies task assignees; audit log row.

### requestTaskChanges  (step 27)
Who can call: manager
Input:  `{ taskId: string, comment: string }`
Output: `{ success: boolean, message?: string }`
Errors:
- `FORBIDDEN`: caller is not Manager.
- `INVALID_STATUS`: task is not in status `in_review`.
- `COMMENT_REQUIRED`: comment must be non-empty and non-whitespace (trimmed, capped at 2000 chars).
Side effects: updates task status → `changes_requested`; saves comment to `task.reviewNote`; notifies developer assignees; audit log row.

### markEmptyMilestoneDone  (step 28)
Who can call: manager
Input:  `{ milestoneId: string, reason: string }`
Output: `{ success: boolean, message?: string }`
Errors:
- `FORBIDDEN`: caller is not Manager.
- `REASON_REQUIRED`: reason must be non-empty (trimmed, capped at 2000 chars).
- `NOT_CURRENT`: milestone is not currently in status `In Progress`.
- `MILESTONE_HAS_TASKS`: milestone contains non-deleted tasks (re-counted inside tx).
Side effects: sets `milestone.doneReason = reason`; invokes `closeMilestoneAndAdvance` inside transaction; audit log row.

### closeMilestoneAndAdvance  (internal transactional engine)
Who can call: internal transaction caller (`approveTask`, `markEmptyMilestoneDone`)
Input:  `(tx, milestoneId, opts?: { reason?: string })`
Output: `{ closedMilestoneId: string, nextMilestoneId?: string, paymentsBecameDue: string[] }`
Errors:
- Throws if milestone is not found or not `In Progress`.
- Throws if Development milestone has any non-deleted backlog tasks.
Side effects: locks milestone for update; sets status → `Completed`, `completedAt = now()`; finds next milestone by `order ASC` with status `Pending` and sets to `In Progress`; updates `payments` for matching schedule item triggers (`milestone.name` or `before_completion` if UAT) from `not_yet_due` to `due`, sets `becameDueAt = now()`, `dueDate = now() + 14 days`; post-commit client notification for payment due and milestone completion.

### Removed / Deprecated Actions (Session 7 cleanup)
- `createMilestone`, `editMilestone`, `deleteMilestone`: Removed. Milestones are fixed at proposal acceptance / project provisioning.
- `updateMilestoneStatus`: Removed. Milestones advance automatically via `closeMilestoneAndAdvance` or `markEmptyMilestoneDone`.
- `handleMilestoneBubbling`: Removed. Replaced by `closeMilestoneAndAdvance`.
- `syncProjectStatus`: Removed. Project status is decoupled from automated task completion.
- `updateTaskStatus`, `submitTaskProofAndMove`: Removed. Replaced by state-specific actions `startTask`, `submitTask`, `approveTask`, `requestTaskChanges`.
- `DndContext` in `PmKanbanBoard`: Removed. Board is non-draggable; state transitions occur via buttons.

### uploadPaymentProof  (step 29a)
Who can call: client (own project only)
Input:  `{ paymentId: string, proofFileUrl: string }`
Output: `{ success: boolean, error?: string, message?: string }`
Errors:
- `FORBIDDEN`: caller is not client or does not own project.
- `INVALID_STATUS`: payment is not in status `due`.
- `INVALID_FILE`: file belongs to another project or has invalid storage scheme.
Side effects: sets payment status → `proof_uploaded`, `proofFileUrl`, `proofUploadedAt = now()`; notifies project PMs; audit log row.

### confirmPayment  (step 29b)
Who can call: manager
Input:  `{ paymentId: string, data: { method: 'bank_transfer' | 'gcash' | 'cheque' | 'cash', referenceNo?: string, bankName?: string, chequeNumber?: string, orNumber: string, receivedAt: Date | string } }`
Output: `{ success: boolean, error?: string, message?: string }`
Errors:
- `FORBIDDEN`: caller is not Manager.
- `INVALID_STATUS`: payment is not in status `due` or `proof_uploaded`.
- `OR_REQUIRED`: OR number is missing or empty.
- `OR_DUPLICATE`: OR number is already used by another payment.
- `CHEQUE_INVALID`: cheque payment missing either bank name or cheque number.
Side effects: sets payment status → `paid`, `method`, `referenceNo`, `receivedAt`, `orNumber`, `confirmedBy`, `confirmedAt = now()`; notifies client; audit log row.

### rejectPaymentProof  (step 29b)
Who can call: manager
Input:  `{ paymentId: string, reason: string }`
Output: `{ success: boolean, error?: string, message?: string }`
Errors:
- `FORBIDDEN`: caller is not Manager.
- `INVALID_STATUS`: payment is not in status `proof_uploaded`.
- `REASON_REQUIRED`: reason must be at least 3 characters.
Side effects: sets payment status → `due`, clears `proofFileUrl` and `proofUploadedAt`, sets `proofRejectedReason` (dueDate unchanged); notifies client; audit log row.

### addHandoverFile  (step 30)
Who can call: manager
Input:  `{ projectId: string, data: { title: string, fileUrl: string, fileName: string, fileSize?: number } }`
Output: `{ success: boolean, error?: string, message?: string }`
Errors:
- `FORBIDDEN`: caller is not Manager.
- `PROJECT_COMPLETED`: project is already Completed.
- `INVALID_FILE`: file belongs to another project or invalid scheme.
Side effects: inserts record into `document` table; audit log row.

### recordSignOff  (step 30)
Who can call: manager
Input:  `{ projectId: string, data: { signOffFileUrl: string, signedOffAt?: Date | string } }`
Output: `{ success: boolean, error?: string, message?: string }`
Errors:
- `FORBIDDEN`: caller is not Manager.
- `PROJECT_COMPLETED`: project is already Completed.
- `INVALID_FILE`: file belongs to another project or invalid scheme.
Side effects: updates `agencyProjects.signOffFileUrl`, `signedOffBy`, `signedOffAt`; audit log row.

### completeProject  (step 30a)
Who can call: manager
Input:  `{ projectId: string }`
Output: `{ success: boolean, error?: string, message?: string }`
Errors:
- `FORBIDDEN`: caller is not Manager.
- `PROJECT_COMPLETED`: project is already Completed.
- `MILESTONES_INCOMPLETE`: not all milestones are Completed (count >= 1).
- `FINAL_PAYMENT_UNPAID`: final payment is not paid.
- `HANDOVER_MISSING`: no handover files in `document` table.
- `SIGNOFF_MISSING`: sign-off is not recorded.
Side effects: sets `status = 'Completed'`, `completedAt = now()`, `warrantyEndsAt = now() + 3 months` (from same timestamp); sends completion email to client; portal notification; audit log row.

### submitProjectFeedback  (step 31)
Who can call: client (own project only)
Input:  `{ projectId: string, data: { rating: number, comment?: string } }`
Output: `{ success: boolean, error?: string, message?: string }`
Errors:
- `FORBIDDEN`: caller is not client or does not own project.
- `NOT_COMPLETED`: project status is not `Completed`.
- `INVALID_RATING`: rating not an integer between 1 and 5.
- `ALREADY_SUBMITTED`: feedback already submitted by this client for this project.
Side effects: inserts record into `projectFeedback`; notifies PM; audit log row.

### signUpWithEmail  (step 31b)
Who can call: public (unauthenticated)
Input:  `FormData` with `name`, `email`, `password`, `confirmPassword`
Output: `{ success: boolean, message?: string, fieldErrors?: Record<string, string> }`
Side effects: creates user with status `invited` and role `client`; generates verification token; sends verification email via Resend; does not sign in; audit log row.

### verifyEmail  (step 31b)
Who can call: public
Input:  `token: string`
Output: `{ success: boolean, message?: string, redirect?: string }`
Side effects: consumes single-use verification token; updates user status to `active` and `emailVerified = now()`; links matching leads by email and registers client in `projectStakeholders`; audit log row.

### resendVerificationEmail  (step 31b)
Who can call: public
Input:  `email: string`
Output: `{ success: boolean, message?: string }`
Side effects: rate-limited by IP and email; checks if account is `invited`; generates new token and sends email; audit log row.

### lockUser (Session 10 / Item 1)
Who can call: superadmin
Input: `targetId: string` (uuid)
Output: `{ success: boolean, message?: string }`
Errors:
- `UNAUTHORIZED`: caller is not superadmin.
- `INVALID_ID`: targetId is not a valid uuid.
- `USER_NOT_FOUND`: target user does not exist.
- `SELF_TARGET`: caller cannot lock own account.
- `LAST_SUPERADMIN`: cannot lock the last active Super Admin.
- `INVALID_TRANSITION`: target account is not active.
Side effects: updates `status = 'locked'`, `isActive = true`, `lockedUntil = null` (manual lock terminating active sessions); audit log row with actorRole in details.

### unlockUser (Session 10 / Item 1)
Who can call: superadmin
Input: `targetId: string` (uuid)
Output: `{ success: boolean, message?: string }`
Errors:
- `UNAUTHORIZED`: caller is not superadmin.
- `INVALID_ID`: targetId is not a valid uuid.
- `USER_NOT_FOUND`: target user does not exist.
- `SELF_TARGET`: caller cannot unlock own account.
- `INVALID_TRANSITION`: target account is not locked.
Side effects: updates `status = 'active'`, `isActive = true`, `failedLogins = 0`, `lockedUntil = null`; audit log row with actorRole in details.

### deactivateUser (Session 10 / Item 1)
Who can call: superadmin
Input: `targetId: string` (uuid)
Output: `{ success: boolean, message?: string }`
Errors:
- `UNAUTHORIZED`: caller is not superadmin.
- `INVALID_ID`: targetId is not a valid uuid.
- `USER_NOT_FOUND`: target user does not exist.
- `SELF_TARGET`: caller cannot deactivate own account.
- `LAST_SUPERADMIN`: cannot deactivate the last active Super Admin.
- `INVALID_TRANSITION`: target account is already deactivated.
Side effects: updates `status = 'deactivated'`, `isActive = false`; if target is developer with open tasks (not done/backlog), notifies all managers via `notifyAllAdmins`; audit log row with actorRole in details.

### reactivateUser (Session 10 / Item 1)
Who can call: superadmin
Input: `targetId: string` (uuid)
Output: `{ success: boolean, message?: string }`
Errors:
- `UNAUTHORIZED`: caller is not superadmin.
- `INVALID_ID`: targetId is not a valid uuid.
- `USER_NOT_FOUND`: target user does not exist.
- `SELF_TARGET`: caller cannot reactivate own account.
- `INVALID_TRANSITION`: target account is not deactivated.
- `PASSWORD_MISSING`: target user has no set password.
Side effects: updates `status = 'active'`, `isActive = true`, `failedLogins = 0`, `lockedUntil = null`; audit log row with actorRole in details.

### updateUserRole (Session 10 / Item 1)
Who can call: superadmin
Input: `userId: string`, `newRole: "sales" | "manager" | "developer" | "content_editor"`
Output: `{ success: boolean, message?: string }`
Errors:
- `UNAUTHORIZED`: caller is not superadmin.
- `SELF_TARGET`: caller cannot change own role.
- `INVALID_ROLE`: newRole is not in whitelist (cannot promote to superadmin or client).
- `TARGET_SUPERADMIN`: cannot change role of a Super Admin.
- `TARGET_CLIENT`: cannot change role of a client account.
Side effects: runs in transaction; updates `role = newRole`; revalidates `/dashboard/team` and `/dashboard/leads`; audit log row with actorRole in details.

### inviteStaff (Session 10 / Item 2)
Who can call: superadmin
Input: `{ email: string, name: string, role: "sales" | "manager" | "developer" | "content_editor", jobTitle?: string | null }`
Output: `{ ok: boolean, emailSent?: boolean, error?: string, fieldErrors?: Record<string, string> }`
Errors:
- `UNAUTHORIZED`: caller is not superadmin.
- `VALIDATION_ERROR`: invalid email format, empty name, or invalid role (cannot invite superadmin or client).
- `USER_EXISTS`: a user with this email address already exists in any status (including soft-deleted).
Side effects: runs in transaction; inserts user row with `status = 'invited'`, `password = null`, `emailVerified = null`, `isActive = true`; generates 32-byte base64url token; stores `sha256(token)` in `verificationToken` with identifier `staff-invite:<email>` expiring in 48 hours; calls `sendStaffInviteEmail` after commit; writes audit log with actor role in details (never the raw token).

### resendStaffInvite (Session 10 / Item 2)
Who can call: superadmin
Input: `userId: string`
Output: `{ ok: boolean, emailSent?: boolean, error?: string }`
Errors:
- `UNAUTHORIZED`: caller is not superadmin.
- `RATE_LIMITED`: too many resend attempts for target user (`inviteResend` policy).
- `USER_NOT_FOUND`: user does not exist.
- `INVALID_STATE`: target account is not an unaccepted staff invitation (`status !== 'invited'`, `role === 'client'`, or `password !== null`).
Side effects: runs in transaction; deletes prior `staff-invite:` tokens for user's email; inserts new `sha256(token)` token expiring in 48 hours; sends invitation email after commit; writes audit log with actor role in details.

### cancelStaffInvite (Session 10 / Item 2)
Who can call: superadmin
Input: `userId: string`
Output: `{ ok: boolean, message?: string, error?: string }`
Errors:
- `UNAUTHORIZED`: caller is not superadmin.
- `USER_NOT_FOUND`: user does not exist.
- `INVALID_STATE`: target account is not an unaccepted staff invitation (`status !== 'invited'`, `role === 'client'`, or `password !== null`).
- `FK_VIOLATION`: target user has foreign-key references; caller is advised to deactivate instead.
Side effects: runs in transaction; deletes all `staff-invite:` tokens for email; deletes user row guarded by `WHERE status = 'invited' AND password IS NULL`; writes audit log with actor role in details.

### acceptStaffInvite (Session 10 / Item 2)
Who can call: public (rate-limited by IP via `inviteAccept`)
Input: `{ token: string, password: string, confirmPassword: string }`
Output: `{ ok: boolean, message?: string, error?: string, fieldErrors?: Record<string, string> }`
Errors:
- `RATE_LIMITED`: too many attempts from IP.
- `VALIDATION_ERROR`: password < 8 chars, missing uppercase, missing number/symbol, or passwords do not match.
- `INVALID_OR_EXPIRED`: token does not exist, hash does not match, identifier does not match `staff-invite:`, expired (> 48h), user not in `invited` status, user has non-null password, or user has role `client`. Returns uniform generic error: `"This invite is invalid or has expired."`.
Side effects: runs in transaction; atomically deletes token via `consumeStaffInvite`; hashes password with bcrypt (10 rounds); updates user setting `password = hash`, `status = 'active'`, `isActive = true`, `emailVerified = now()`, `failedLogins = 0`; writes audit log after commit; does NOT establish a session (caller redirects to `/login`).

### /accept-invite (Session 10 / Item 2)
Who can access: public (outside middleware route matcher).
Method: GET
Behavior: Never touches the database or consumes the invite token on page load. Awaits search parameters and passes the token into `<AcceptInviteForm>` where the token is preserved in a hidden input field. The user submits the form to call `acceptStaffInvite`.

(Add one per action as modules are built.)
