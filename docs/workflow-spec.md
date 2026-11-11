# Optrizo CRM: workflow spec

This document is the source of truth for **how the system behaves**: roles, records, statuses, what changes them, and what happens automatically. The mockups in `docs/mockups/` show **where things are on screen**. If the code, the mockups and this spec disagree, follow this spec and flag the conflict.

Stack: Next.js + React + Drizzle ORM. Code sketches below are TypeScript. The enum values are written for `pgEnum`; if the project uses MySQL, use `mysqlEnum` with the same values.

---

## 1. Roles

One account has exactly one role. After sign-in, each role lands on its own home page (mockup `004-sign-in-where-each-role-lands`). Nobody switches accounts to do their job.

Role values in code and data are `superadmin` and `manager`, not `super_admin` and `project_manager`. Display labels ("Super Admin", "Project Manager") are mapped in one place.

| Role | Lands on | Does |
|---|---|---|
| `sales` | Sales dashboard | Owns leads: contacts them, logs interactions, books **discovery** meetings, fills in the discovery form, requests a proposal. Can reopen or archive a lost lead. Views proposals (read-only). |
| `manager` | PM dashboard | Owns proposals and pricing (Optrizo has no finance department). Books **pricing** meetings, sends proposal versions, runs projects (tasks, sprints, Gantt), confirms payments, completion. |
| `developer` | My tasks | Acts only on tasks assigned to them: starts, submits, fixes. Can also view, read-only, all tasks in projects they are a team member of. |
| `content_editor` | Website content | Manages public website content: services, portfolio, Home/About/Contact pages. No CRM access. |
| `client` | Client portal home | Sees only their own proposals, meetings, projects, payments, documents. Signs, requests changes, declines, confirms meetings, uploads payment proof. |
| `superadmin` | Super Admin dashboard | **Oversees and monitors only.** Manages accounts and roles, reads analytics, reports and the audit log. **Never creates, edits or deletes leads, proposals, projects, tasks or payments.** |

### Permissions

`Edit` = can view and change. `View` = read-only. `Own` = only records that belong to them. `—` = no access (hide the menu item and block the route and the server action).

| Area | Sales | PM | Developer | Content Editor | Client | Super Admin |
|---|---|---|---|---|---|---|
| Leads and pipeline | Edit | — | — | — | — | — |
| Meetings | Edit `discovery`, view the rest | Edit `budget_pricing`, `project_review`, `uat`; view `discovery` | — | — | Own | — |
| Proposals | View | Edit | — | — | Own | — |
| Projects and tasks | — | Edit | Own (act); view all tasks in own projects | — | Own (progress only) | — |
| Payments | — | Edit | — | — | Own | — |
| Website content | — | — | — | Edit | — | — |
| Analytics and reports | Own | Own | — | — | — | View + export |
| Users and roles | — | — | — | — | — | Edit |
| Audit log | — | — | — | — | — | View |

For Analytics and reports, `Own` means only the small report strip on that role's own dashboard. Sales and the PM have no analytics page.

Meetings: Sales edits `discovery` meetings, and the PM edits `budget_pricing`, `project_review` and `uat` meetings. Each role can view the other's.

Developers: `Own` means they act only on tasks assigned to them. The board's "All tasks" toggle shows every task in the projects they are a team member of, read-only.

PM and leads: the PM has no access to leads or the pipeline. A discussion the PM logs from a proposal is copied into the lead's activity log by the system, for Sales to read.

Sales and projects: on a won lead, Sales sees "Project created" as text only, with no link into the project.

Clients never approve milestones. Developers see only the projects they are on (`projectTeamMembers`).

Enforce permissions on the server (server actions, route handlers, and `middleware.ts` for route groups), not only by hiding buttons.

---

## 2. Main workflow (local client)

Step numbers match the mockup titles. See `docs/mockups/00-workflow-overview-start-here/`.

| # | Who | What happens | System does automatically |
|---|---|---|---|
| 1 | Visitor (signed in, Google or email) | Sends an inquiry from the website after signing in; a signed-out visitor is sent to sign in first and returned to `/services`. The lead is linked to the account (`clientId`). (service, urgency, business name, client name, email (required), phone (optional), industry, role, contact preference, details). No budget field. No lead score. | Creates a lead with stage `new_lead`. Notifies Sales. Sends a confirmation email (1c). |
| 2 | Sales | Sees the new lead in the pipeline. May claim an unassigned lead. | Claiming sets `assignedSalesId` and writes a `system` interaction. A claim does not count as the first interaction for the stage change. |
| 3 | Sales | Opens the lead, logs calls/emails/notes. | The stage moves to `discovery` on whichever comes first: a logged interaction or a booked meeting. |
| 4 | Sales | Books the **discovery** meeting (4a). | Stage → `discovery` if not already. Client gets an invite (email + portal). The invite email includes a link to create a portal account (see "Client accounts" below). |
| 4c | Client | Confirms, suggests another time, or declines the invite. | Reminder email the day before. |
| 5 | Sales | Marks the meeting done and writes the outcome. | Unlocks the discovery form. No stage change. |
| 6 | Sales | Fills in and submits the discovery form (goals, features, timeline, confirmed budget range, client type: local or international). | Copies `clientType` from the form to the lead. The discovery form is the source of truth. |
| 7 | Sales | Sees "requirements complete". | **Create/Request proposal is locked until the discovery meeting is done AND the discovery form is submitted.** |
| 8 | Sales | Requests a proposal from the PM. | Sets `proposalRequestedAt` on the lead. Notifies the lead's PM, or every PM if none is assigned yet. Request appears in the PM's proposal queue. |
| 9 | PM | Opens the request with the discovery notes attached. | Sets `assignedPmId` on the lead if none is set. Proposals and projects for this lead use that PM. |
| 10–10d | PM | Drafts proposal v1. Local client: v1 defaults to **"to be discussed"**; the PM can switch it to priced (a default, not a rule). Previews and sends. | Stage → `proposal_sent`. Client notified. |
| 11 | Client | Reviews v1 and clicks **Request pricing meeting**. | Notifies the lead's PM (notification + badge). |
| 12–13 | PM | Opens the notification and books the **budget and pricing** meeting. | Client gets the invite. |
| 14 | Client | Confirms the pricing meeting. | Reminder the day before. If the client declines instead, the PM is notified (see Meeting status in §4). |
| 15–16 | PM | Runs the meeting, writes notes, marks it done. | Shows "next step: add the price and send v2". |
| 17–17b | PM | Opens the proposal, includes the price (currency, total, payment schedule), previews, sends v2. | v1 status → `replaced`. Client notified. |
| 19 | Client | Accepts and signs v2 online: types a name or uploads a signature image, enters a printed name, agrees to the terms. Not possible after `validUntil` has passed. | Saves `signerName`, `signatureData`, `signedAt` and `signerIp` on the proposal. |
| 20 | System | — | Proposal → `signed`. Lead → `closed_won`. **Project created** with the 5 fixed milestones and the payment schedule from the proposal. First payment (on signing) becomes `due`. PM and Sales notified. |
| 21–23e | PM | Sets up the team, backlog, sprints; views the Gantt. | Gantt bars come from milestone and sprint dates, never drawn by hand. |
| 24–25 | Developer | Starts tasks, submits work (at least one file or link). | Task status changes by itself (see §4). There is no automated or AI review. |
| 26–27 | PM | Reviews: approve or request changes. This is the only task review. | Approve → task `done`. |
| 28 | System | — | When every task in a milestone is `done`, the milestone is `done`, the next milestone starts, any payment tied to it becomes `due`, and the client's progress bar updates. A milestone with no tasks is closed by the PM with a reason (see §4). |
| 29–29b | Client / PM | Client sees progress and pays outside the portal, optionally uploads proof. PM confirms the payment, or rejects the proof with a reason. | A payment's `dueDate` is the day it becomes `due` plus 14 days. Rejecting proof sends the payment back to `due` and notifies the client. Confirming a payment notifies the client. See §5. |
| 30–30a | PM, then Client | After UAT on the agreed testing day the PM uploads handover files (a file or a Google Docs / Drive link) and clicks **Request client acceptance**. The client reviews them in the portal and clicks **Accept** or **Request fixes** (comment required). The PM then marks the project complete. | Request is blocked until all milestones are `done`, the final payment is `paid` and handover files are uploaded. Complete is blocked until the client accepts. If the client has not answered after **14 days**, the PM may complete with a reason; it is recorded as assumed acceptance and audited. After "Request fixes" the PM can add files and request again. A signed paper form is optional supporting evidence. Starts the **3-month warranty**, which is always 3 months. The client is notified automatically. |
| 31 | Client | Sees "project complete", warranty end date, downloads handover files, sends the 5-question satisfaction survey (overall 1–5 required; five area ratings, would recommend yes/maybe/no, what went well, what to improve, testimonial permission are optional). | — |

### Other paths

| # | Path | Rules |
|---|---|---|
| 18a–18c | Client requests changes (topics: price, timeline, scope, other) and can message the PM. | Stage → `negotiation`. PM notified. |
| 18d–18g | PM reviews the request, replies in the system, **logs discussions held outside** (phone, email, in person, e.g. the client's lawyer), sends a revised version. | The PM logs each outside discussion from the proposal. The system saves it to the proposal history and copies it into the lead's activity log; the PM has no access to the lead. . Old version → `replaced`. |
| 18h | Client reviews the revised version. | Same choices as step 11/19. |
| 18i–18j | Client declines (optional reason and comment). | Proposal → `declined`. Lead → `closed_lost`. Sales can **Reopen** the lead (reason required): the stage goes back to `discovery` and a `system` interaction records it. Sales can also archive the lead: that sets `archivedAt` and hides it from the pipeline. Archive is a field, not a stage. |
| 19a | Client signs on paper. | PM uploads the signed copy and records the date. Same automation as step 20. |
| 26a | PM requests changes on a task. | Task → `changes_requested`. On the board the card stays in the In progress column with a red "Changes requested" tag; there is no extra column. Developer fixes and resubmits → `in_review`. |

### International clients

No pricing meeting and no lawyer step. The PM sends the **priced** proposal as v1 (go straight to step 17), and the client signs (19).

### Lead ownership

- Sales owner: `assignedSalesId`. Any Sales user can claim an unassigned lead.
- PM owner: `assignedPmId`, set when a PM opens a proposal request from the queue (step 9). Proposals and projects use the lead's PM.
- If a hand-off to the PM happens before a PM is assigned, every PM is notified.

### Client accounts

- At step 4, the meeting invite email includes a link to create a portal account. The account has status `invited` and is linked to the lead.
- A client who signs up on their own with the same email as the lead is linked to the existing lead.
- A client who signs up with a different email is not linked. Sales can update the lead's email before sending the invite.
- A client account stays `invited` until its email is verified.

---

## 3. Records (Drizzle tables, sketch)

Field lists are a guide, not a final schema. Keep names consistent with the existing code where they already exist.

```ts
// enums
export const role = pgEnum('role', ['superadmin','sales','manager','developer','content_editor','client']);
export const accountStatus = pgEnum('account_status', ['invited','active','locked','deactivated']);
export const leadStage = pgEnum('lead_stage', ['new_lead','discovery','proposal_sent','negotiation','closed_won','closed_lost']);
export const interactionType = pgEnum('interaction_type', ['call','email','meeting','note','outside_discussion','system']);
export const meetingType = pgEnum('meeting_type', ['discovery','budget_pricing','project_review','uat']);
export const meetingFormat = pgEnum('meeting_format', ['video','phone','in_person','on_site']);
export const meetingStatus = pgEnum('meeting_status', ['awaiting_client','confirmed','reschedule_requested','done','cancelled']);
export const proposalStatus = pgEnum('proposal_status', ['draft','sent','pricing_meeting_requested','changes_requested','replaced','signed','declined']);
export const priceMode = pgEnum('price_mode', ['to_be_discussed','priced']);
export const currency = pgEnum('currency', ['PHP','USD']);
export const clientType = pgEnum('client_type', ['local','international']);
export const milestoneName = pgEnum('milestone_name', ['requirements','design','development','uat_testing','handover']);
export const milestoneStatus = pgEnum('milestone_status', ['not_started','in_progress','done']);
export const taskStatus = pgEnum('task_status', ['backlog','to_do','in_progress','in_review','changes_requested','done']);
export const paymentStatus = pgEnum('payment_status', ['not_yet_due','due','proof_uploaded','paid']);
export const paymentMethod = pgEnum('payment_method', ['bank_transfer','gcash','cheque','cash']);
export const contentStatus = pgEnum('content_status', ['draft','published','hidden']);
```

| Table | Key fields | Notes |
|---|---|---|
| `users` | name, email, passwordHash, role, status, failedLogins, lockedUntil, emailVerifiedAt, lastSignInAt | Clients self-register (email verification, link valid 24 h) or are invited from a meeting invite (§2). A client stays `invited` until the email is verified. Staff accounts are created **only by Super Admin** via an invite link (valid 48 h, status `invited` until used). |
| `leads` | businessName, clientName, email, phone, industry, roleInCompany, contactPreference, urgency, serviceId, otherServiceText, details, clientType, stage, stageChangedAt, lastContactAt, assignedSalesId, assignedPmId, clientUserId, proposalRequestedAt, archivedAt | Created from the inquiry form. `stage` changes only through the automations in §2, never by drag-and-drop. `proposalRequestedAt` records the proposal request; there is no separate request table. Every Sales user can see unassigned leads and claim one, which sets `assignedSalesId`. `assignedPmId` is set when a PM opens the proposal request. `archivedAt` hides the lead from the pipeline; archive is not a stage. `clientType` is copied from the discovery form when it is submitted. |
| `interactions` | leadId, type, occurredAt, summary, followUpAt, createdBy | The activity log. `system` entries record every automatic stage change and why, plus claiming a lead, reopening a lost lead (with the reason) and each outside discussion copied from a proposal. |
| `meetings` | leadId, proposalId?, projectId?, type, format, location?, startsAt, attendees, agenda, notes, status, createdBy | Sales creates `discovery`; PM creates `budget_pricing`, `project_review`, `uat`. These four are the only types; "Proposal discussion" in the mockups is not used. One shared list: Sales edits `discovery` meetings, the PM edits the other three types, and each role can view the other's. `location` (decision 2026-11-11, migration 0024) is the video/meeting link for `video` (an http(s) URL) or the venue/address for `in_person` and `on_site`; it is required for those formats and not stored for `phone`. It shows on the meeting details, the client's Appointments page, the pricing meeting panel, and the invite, reschedule and reminder emails. |
| `discoveryForms` | leadId, goals, requiredFeatures, targetTimeline, budgetRange, clientType, notes, submittedAt | Submitting it (plus a done discovery meeting) unlocks the proposal request. `clientType` here is the source of truth; submitting copies it to the lead. |
| `proposals` | leadId, version, status, priceMode, currency, totalPrice, overview, solution, exclusions, needsGoals, validUntil, sentAt, signedAt, signatureType ('online' or 'paper'), signerName, signatureData, signerIp, signedFileUrl, declineReason | One row per version. Only one version can be "current". `needsGoals` is copied from the discovery form and editable per proposal. A local client's v1 defaults to `priceMode = to_be_discussed`; the PM can switch it to `priced`. Online signing fills `signerName`, `signatureData`, `signedAt` and `signerIp`. After `validUntil` passes, the client cannot sign and sees "This proposal has expired. Contact your Project Manager." The PM sends a new version; the status does not change automatically. |
| `proposalMilestones` | proposalId, name (milestoneName, null for an added milestone), title, description, sortOrder, startDate, endDate | The 5 default milestones are always present and cannot be removed (payments and automations key on their `name`); the PM can rename and re-describe them for one proposal (title, description; unchanged text is stored as null). The PM may add up to 10 milestones of their own between them (title, description, dates); only these can be removed. Every milestone needs dates, in order, before sending. Signing copies all of them, in order, to the project. Migration 0020. |
| `paymentScheduleItems` | proposalId, label, percent, trigger ('on_signing' or a milestone or 'before_completion') | Percents must total 100 when the schedule is saved and again when the proposal is sent. Default 30/30/40. Amounts are calculated from the total price. |
| `proposalMessages` | proposalId, authorId, topics[], body | Change requests and replies. |
| `projects` | proposalId, leadId, status ('active','completed'), signedOffBy, signedOffAt, signOffFileUrl, completedAt, warrantyEndsAt | Created automatically on signing. The client accepts the handover online (`acceptedAt`, `acceptedBy`); after 14 days without an answer the PM can complete with a reason (`acceptanceAssumed`, `acceptanceAssumedReason`). The signed paper form (`signOffFileUrl`) is optional. The project can be marked complete only when all milestones are `done`, the final payment is `paid`, handover files are uploaded (`documents` with type `handover`) and the client has accepted or the assumed-acceptance rule applies. Handover notes are optional. `warrantyEndsAt = completedAt + 3 months`, always. |
| `projectTeamMembers` | projectId, userId | Developers on the project. A developer sees only projects they are on. |
| `projectFeedback` | projectId, clientId, rating (1–5 overall), five area ratings (communication, quality, on time, value, PM support; 1–5, optional), wouldRecommend (yes/maybe/no, optional), comment ("what did we do well"), improvement ("what should we improve"), testimonialAllowed, followupNote, reviewedAt, createdAt | Client satisfaction survey at step 31, one per project. Only the overall rating is required. The PM reads the answers (read-only) on the project Feedback tab and may add an internal follow-up note, log a follow-up call and mark it reviewed. An area rated below 4 suggests a follow-up. Super Admin sees totals and averages only (CSAT = share of overall 4 or 5): no names, comments or links into projects. Not built yet: Sales and Content Editor access, testimonial hand-off, Save for later, edit window, CSV export. |
| `documents` | clientUserId, projectId?, proposalId?, type, title, fileUrl, createdAt | Feeds the client Documents page: proposals, signed copies, handover files. |
| `projectMilestones` | projectId, name, startDate, endDate, status, doneReason | Copied from the signed proposal. Status is automatic (§4). The PM can mark a milestone that has no tasks as done; that needs a reason, saved in `doneReason` and audited. |
| `sprints` | projectId, name, goal, startDate, endDate | Must fall inside the Development milestone. No overlapping sprints. Sprint status is derived from its dates, not stored. No sprint demo date for now. |
| `tasks` | projectId, milestoneId, sprintId?, title, description, assigneeId, dueDate, priority, status, carriedOver | Status is automatic (§4). The milestone is fixed at creation. `carriedOver` marks a task moved into the next sprint at sprint end (§4). A backlog task can be deleted only if it was never started; the delete is audited. No task source or change-request link for now. |
| `taskSubmissions` | taskId, files[], links[], note, submittedAt | At least one file or link. No AI fields. |
| `payments` | projectId, scheduleItemId, amount, status, becameDueAt, dueDate, method, referenceNo, receivedAt, orNumber, proofFileUrl, proofRejectedReason, confirmedBy | See §5. For cheques, `referenceNo` holds the cheque number and bank. |
| `notifications` | userId, type, entityType, entityId, readAt | Every hand-off between roles creates one. Menu badge = unread count. |
| `auditLog` | actorId, actorRole, action, entityType, entityId, details, createdAt | **Append-only.** Never updated or deleted. Write one row for every create/update/status change and every sign-in, lock and account change. |
| `services` | name, shortDescription, included[], imageUrl, sortOrder, isPreset, status, showOnServicesPage, showInInquiry | 6 presets: Web Development, Mobile App, UI/UX Design, E-commerce Website, Custom Business System, Website Maintenance. Presets can be hidden, not deleted. "Other" is not a row: it is always the last option in the inquiry form. |
| `portfolioItems` | title, serviceId, clientDisplayName, clientConsent, summary, images[], liveUrl, sortOrder, status | Cannot publish with the real client name unless `clientConsent` is true. Not linked to real project records. |
| `pages` / `pageVersions` | slug ('home','about','contact'), fields (JSON), status, publishedAt, publishedBy | Fixed fields per page. Every publish saves a version that can be restored. |
| `generatedReports` | type, periodStart, periodEnd, compareWith, createdBy, fileUrl | Types: sales_pipeline, proposals, project_status, payments, system_usage. |

---

## 4. Statuses that change by themselves

### Lead stage

`new_lead` → (first interaction logged or meeting booked) → `discovery` → (PM sends a proposal) → `proposal_sent` → (client requests changes) → `negotiation` → (client signs) → `closed_won`; (client declines) → `closed_lost`.

The pipeline shows a sub-status for context: No contact yet, Scheduled, Meeting done, Pricing meeting, Needs revision, Signed.

Sales can reopen a `closed_lost` lead with a required reason. The stage goes back to `discovery` and a `system` interaction records the reopen and the reason. Archiving is not a stage: it sets `archivedAt`, which hides the lead from the pipeline. Claiming a lead writes a `system` interaction but does not move the stage.

### Task status

| From | Action | To |
|---|---|---|
| (new) | PM creates and assigns it | `to_do` (or `backlog` if added to the backlog without a sprint) |
| `backlog` | PM adds it to a sprint | `to_do` |
| `to_do` | Developer clicks Start | `in_progress` |
| `in_progress` / `changes_requested` | Developer submits work (≥1 file or link) | `in_review` |
| `in_review` | PM approves | `done` |
| `in_review` | PM requests changes (with a comment) | `changes_requested` |
| `to_do` | Its sprint ends | `backlog` (sprint cleared) |
| `in_progress` / `in_review` / `changes_requested` | Its sprint ends | Keeps its status and carries into the next sprint, marked "carried over" |

Nobody picks a status from a dropdown. There is no `Blocked` status. PM review (Approve or Request changes) is the only review; nothing is scored or reviewed automatically. A task can be started only in the milestone that is currently `in_progress`.

### Milestone status

`not_started` → `in_progress` when the previous milestone is `done` (the first milestone starts when the project is created) → `done` when all its tasks are `done`. There is no `Client Approval` status, and clients do not approve milestones. Client progress = done tasks / all tasks, per milestone and overall.

- Only one milestone is `in_progress` at a time.
- A milestone with no tasks can be marked `done` by the PM, with a reason. The action is audited.
- Progress counts only milestones that have tasks. A project with no tasks at all shows 0%.
- Development cannot close while backlog tasks remain. The PM schedules them into a sprint or deletes them (only if never started; audited).

### Meeting status

`awaiting_client` (invite sent) → `confirmed` / `reschedule_requested` / `cancelled` (client declined) → `done` (marked by the organizer). Reminder email one day before `startsAt`.

`reschedule_requested` → the organizer picks a new time → back to `awaiting_client`. If the client declines a `budget_pricing` meeting, the PM is notified and the proposal stays `pricing_meeting_requested` until the PM logs an outside discussion or sends a priced version.

### Account

5 failed sign-ins → `locked` for 15 minutes (unlocks by itself, or Super Admin clicks Unlock). `deactivated` blocks sign-in and keeps all history; the deactivated user's open tasks stay as they are and the PM is notified to reassign them. A client account is `invited` until its email is verified.

Forgot password: the sign-in page links to a screen where the user enters their email. A reset link, valid 1 hour, opens a screen to set a new password. The request and the password change are written to the audit log.

---

## 5. Payments

1. The schedule comes from the signed proposal. A payment becomes `due` when its trigger happens: signing, a milestone done, or `before_completion`, which becomes due when the UAT and testing milestone is done. The client is emailed and sees it in the portal. `dueDate` is the day the payment becomes `due` plus 14 days. A payment is late when it is unpaid after `dueDate`.
2. The client pays **outside the system** (bank transfer, GCash, cheque or cash) and may upload proof → `proof_uploaded`.
   - If the proof is wrong, the PM clicks Reject proof and gives a reason. The payment goes back to `due` and the client is notified.
3. The PM checks the money arrived, then confirms with: method, date received, reference number, and official receipt (OR) number → `paid`. The client is notified.
   - Bank transfer / GCash: transaction reference from the proof.
   - Cheque: cheque number and bank, both stored in `referenceNo`; confirm only after it clears.
   - Cash: no reference number; the OR number is the proof.
4. The final payment must be `paid` before the completion sign-off can be recorded. The project can be marked complete only when all milestones are `done`, the final payment is `paid`, handover files are uploaded and the client has accepted (or 14 days passed and the PM gave a reason) (§2, steps 30–30a).

---

## 6. Super Admin (monitor only)

Screens: Dashboard, Users, Add staff account, User detail, Deactivate, Roles (read-only table), Analytics (Business and System tabs), Reports (generate + list + preview), Audit log. There is no settings screen for now; the system settings that already exist in code are listed in `docs/gap-list.md`.

- Can: create staff accounts (Sales, PM, Developer, Content Editor), change a user's role, send a password reset, unlock, deactivate or reactivate.
- Cannot: open or change any lead, proposal, meeting, project, task or payment. Analytics and reports show **counts and totals only**, with no client names and no links into records.
- The audit log and recent activity may show names, roles and record type, read-only, with no links into records. "Counts and totals only" applies to analytics and reports.
- Business analytics: new leads per month, revenue collected per month, conversion funnel with step rates, proposal win rate, average days per stage, milestones on time, late payments.
- System analytics: uptime, average page load, weekly active users, errors, adoption (proposals signed online, meetings booked in the system, clients using the portal, tasks updated on time, notifications read within a day), security (sign-ins, failed sign-ins, locks, resets, email delivery), storage.
- Reports: pick a type and period, compare with the previous period, generate, then download PDF/CSV. Saved in a list.

---

## 7. Content Editor (public website)

- Simple content management with fixed fields, not a page builder.
- Changes stay as drafts until **Publish**. Every create, update, status change and publish is written to the audit log.
- The published services list feeds both the public Services page and the inquiry form's Service dropdown, so they can never disagree.
- Home page: heading, intro, main image, up to 3 featured services and 3 featured portfolio items (published only). The "Request a service" button is fixed and always opens the inquiry form.
- About page: heading, story, mission, vision, "how we work" line, team cards (photo, name, job title). Team cards are content, not user accounts.
- Contact page: heading, intro, email, phone, address, office hours. Version history with restore.

---

## 8. Out of scope (see paper: limitations)

- **Retainer** agreements are out of scope. The warranty is always 3 months. Optrizo will add retainers themselves.
- Online payment processing. Payments happen outside the system; the system records and confirms them.
- Blog and testimonials. They are hidden from menus and routes, and the code is kept.
- For now: task source or change-request link, and sprint demo date.

---

## 9. Suggested build order

1. Roles, auth, forgot password, route guards, audit log, notifications (foundation).
2. Inquiry → lead → activity log → automatic stages.
3. Meetings (discovery) and the discovery form, with the proposal lock.
4. Proposals: versions, fixed milestones, price modes, payment schedule, pricing meeting, changes, outside discussions, signing.
5. Project created on signing: milestones, project team members, tasks with automatic status, sprints, Gantt.
6. Payments, completion sign-off and project completion.
7. Client portal, including the Documents page and project feedback.
8. Super Admin: accounts, roles, audit log, analytics, reports.
9. Content Editor.

---

## 10. Recorded decisions

These settle earlier conflicts between this spec and the mockups. This spec wins where a mockup says otherwise. Rows marked 2026-10-31 record answers from a spec review.

| Topic | Decision |
|---|---|
| Role names | Keep `superadmin` and `manager`. Map display labels in one place. |
| Task review | The PM's Approve or Request changes only. No AI or automated review. |
| Demo data | Existing data can be reset. A seed script creates one user per role, plus one local and one international client at different workflow steps. |
| Dropped statuses | `Blocked` and `Client Approval`. Clients do not approve milestones. |
| Blog and testimonials | Out of scope. Hidden from menus and routes, code kept. |
| Step 26 | Status is `changes_requested`, shown in the In progress column with a red tag. Mockup text "back to In progress" does not apply. |
| Steps 4 and 4a | Stage moves to `discovery` on the first logged interaction or booked meeting, whichever comes first. |
| Steps 4b and 5 | No stage change. Marking the discovery meeting done only unlocks the discovery form. |
| Meeting types | The four in §3 only. |
| Added, build now (2026-10-31) | Project team members, completion sign-off (30a), client feedback 1–5 (31), client Documents page (steps 4.11, 4.14, 4.15), cheque bank in `referenceNo`. |
| Skipped for now | Task source and change-request link, sprint demo date. Sprint status comes from its dates. |
| `requestProposal` | No new table. Uses `proposalRequestedAt` on the lead. |
| Analytics `Own` | A small report strip on the role's own dashboard. No analytics page for Sales or the PM. |
| Unassigned leads | Every Sales user can see unassigned leads and claim one. Leads never fall back to Super Admin. |
| Site settings (2026-10-31) | No Super Admin settings screen for now. Website content settings belong to the Content Editor. The system settings that already exist in code are listed in `docs/gap-list.md`. |
| Reopen and archive (2026-10-31) | Sales reopens a `closed_lost` lead with a required reason: stage → `discovery`, and a `system` interaction records it. Archive is `archivedAt`, not a stage, and hides the lead from the pipeline. |
| Meetings (2026-10-31) | Sales edits `discovery`; the PM edits `budget_pricing`, `project_review` and `uat`. Each role can view the other's. |
| Sales and projects (2026-10-31) | On a won lead, Sales sees "Project created" as text only, with no link into the project. |
| Outside discussions (2026-10-31) | The PM logs them from the proposal; the system copies them into the lead's activity log. The PM has no access to leads; Sales reads the copy. |
| Developer "All tasks" (2026-10-31) | Read-only view of all tasks in the developer's own projects. They act only on tasks assigned to them. |
| Retainer and warranty (2026-10-31) | Retainer is out of scope. The warranty is always 3 months. |
| Completion (2026-10-31) | Needs all milestones done, final payment paid, handover files uploaded and client acceptance (online). Replaces the PM-recorded sign-off: the PM requests acceptance, the client accepts or requests fixes; after 14 days without an answer the PM may complete with a reason (assumed, audited). The signed paper form is optional. The client is notified automatically. |
| Sprint end (2026-10-31) | `to_do` tasks go back to `backlog` (sprint cleared). Started tasks keep their status and carry into the next sprint, marked "carried over". |
| PM owner (2026-10-31) | `assignedPmId` on the lead, set when a PM opens the request. Proposals and projects use the lead's PM. If none is assigned yet, notify every PM. |
| Client accounts (2026-10-31) | The step 4 invite email links to creating a portal account, status `invited` until the email is verified. Same-email sign-up links to the lead; a different email does not. |
| Milestone rules (2026-10-31) | One milestone `in_progress` at a time; tasks start only there. The PM can close an empty milestone with a reason (audited). Progress counts only milestones that have tasks; no tasks at all is 0%. Development cannot close while backlog tasks remain. |
| Payment rules (2026-10-31) | `before_completion` becomes due when the UAT and testing milestone is done. `dueDate` is the due day plus 14 days. The PM can reject proof with a reason (payment back to `due`, client notified). `confirmPayment` notifies the client. The 100% check runs on save and on send. |
| Meeting replies (2026-10-31) | `reschedule_requested` → the organizer picks a new time → `awaiting_client`. If the client declines a pricing meeting, the PM is notified and the proposal stays `pricing_meeting_requested`. |
| Added milestones (2026-11-08) | Decided by the team (user): the PM may add milestones between the 5 defaults on a proposal and rename or re-describe any milestone; the 5 defaults cannot be removed. Replaces "always exactly the 5 default milestones; only dates". |
| Signing (2026-10-31) | Online signing stores `signerName`, `signatureData`, `signedAt` and `signerIp`. After `validUntil` the client cannot sign; no automatic status change. |
| Local pricing (2026-10-31) | A local client's v1 defaults to `to_be_discussed`. The PM can switch it to `priced`. |
| `clientType` (2026-10-31) | The discovery form is the source of truth. Submitting it copies the value to the lead. |
| `claimLead` (2026-10-31) | Writes a `system` interaction. It does not count as the first interaction for the stage change. |
| Audit log visibility (2026-10-31) | The audit log and recent activity may show names, roles and record type, read-only, with no links into records. "Counts and totals only" applies to analytics and reports. |
| Forgot password (2026-10-31) | A screen: enter email, get a reset link valid 1 hour, set a new password. Audited. |
| Inquiry form (2026-10-31) | Email is required and phone is optional. "Urgency" is the correct field name. |
| Audit coverage (2026-10-31) | Every create, update and status change, including website content. |
| Stale mockup text (2026-10-31) | The spec wins. Affected: 4b ("moves the lead forward"), 20a (project link for Sales), 26 ("back to In progress"), Ref Sales appointments ("Proposal discussion"), 17b and 30 (retainer wording, "client signs completion"), 22b, 23, 23a, 23b and 23d (task source, change-request link, sprint demo date, sprint Done when approved), 24a ("All tasks" is read-only). The mockups will be fixed separately. |
