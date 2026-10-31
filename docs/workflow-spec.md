# Optrizo CRM: workflow spec

This document is the source of truth for **how the system behaves**: roles, records, statuses, what changes them, and what happens automatically. The mockups in `docs/mockups/` show **where things are on screen**. If the code, the mockups and this spec disagree, follow this spec and flag the conflict.

Stack: Next.js + React + Drizzle ORM. Code sketches below are TypeScript. The enum values are written for `pgEnum`; if the project uses MySQL, use `mysqlEnum` with the same values.

---

## 1. Roles

One account has exactly one role. After sign-in, each role lands on its own home page (mockup `004-sign-in-where-each-role-lands`). Nobody switches accounts to do their job.

Role values in code and data are `superadmin` and `manager`, not `super_admin` and `project_manager`. Display labels ("Super Admin", "Project Manager") are mapped in one place.

| Role | Lands on | Does |
|---|---|---|
| `sales` | Sales dashboard | Owns leads: contacts them, logs interactions, books **discovery** meetings, fills in the discovery form, requests a proposal. Views proposals (read-only). |
| `manager` | PM dashboard | Owns proposals and pricing (Optrizo has no finance department). Books **pricing** meetings, sends proposal versions, runs projects (tasks, sprints, Gantt), confirms payments, completion. |
| `developer` | My tasks | Works on tasks assigned to them only. Starts, submits, fixes. |
| `content_editor` | Website content | Manages public website content: services, portfolio, Home/About/Contact pages. No CRM access. |
| `client` | Client portal home | Sees only their own proposals, meetings, projects, payments, documents. Signs, requests changes, declines, confirms meetings, uploads payment proof. |
| `superadmin` | Super Admin dashboard | **Oversees and monitors only.** Manages accounts and roles, reads analytics, reports and the audit log. **Never creates, edits or deletes leads, proposals, projects, tasks or payments.** |

### Permissions

`Edit` = can view and change. `View` = read-only. `Own` = only records that belong to them. `—` = no access (hide the menu item and block the route and the server action).

| Area | Sales | PM | Developer | Content Editor | Client | Super Admin |
|---|---|---|---|---|---|---|
| Leads and pipeline | Edit | View | — | — | — | — |
| Meetings | Edit | Edit | — | — | Own | — |
| Proposals | View | Edit | — | — | Own | — |
| Projects and tasks | — | Edit | Own | — | Own (progress only) | — |
| Payments | — | Edit | — | — | Own | — |
| Website content | — | — | — | Edit | — | — |
| Analytics and reports | Own | Own | — | — | — | View + export |
| Users and roles | — | — | — | — | — | Edit |
| Audit log | — | — | — | — | — | View |

For Analytics and reports, `Own` means only the small report strip on that role's own dashboard. Sales and the PM have no analytics page.

Clients never approve milestones. Developers see only the projects they are on (`projectTeamMembers`).

Enforce permissions on the server (server actions, route handlers, and `middleware.ts` for route groups), not only by hiding buttons.

---

## 2. Main workflow (local client)

Step numbers match the mockup titles. See `docs/mockups/00-workflow-overview-start-here/`.

| # | Who | What happens | System does automatically |
|---|---|---|---|
| 1 | Visitor | Sends an inquiry from the website (service, urgency, business name, client name, industry, role, contact preference, details). No budget field. No lead score. | Creates a lead with stage `new_lead`. Notifies Sales. Sends a confirmation email (1c). |
| 2 | Sales | Sees the new lead in the pipeline. | — |
| 3 | Sales | Opens the lead, logs calls/emails/notes. | The stage moves to `discovery` on whichever comes first: a logged interaction or a booked meeting. |
| 4 | Sales | Books the **discovery** meeting (4a). | Stage → `discovery` if not already. Client gets an invite (email + portal). |
| 4c | Client | Confirms, suggests another time, or declines the invite. | Reminder email the day before. |
| 5 | Sales | Marks the meeting done and writes the outcome. | Unlocks the discovery form. No stage change. |
| 6 | Sales | Fills in and submits the discovery form (goals, features, timeline, confirmed budget range, client type: local or international). | — |
| 7 | Sales | Sees "requirements complete". | **Create/Request proposal is locked until the discovery meeting is done AND the discovery form is submitted.** |
| 8 | Sales | Requests a proposal from the PM. | Sets `proposalRequestedAt` on the lead. Notifies the PM. Request appears in the PM's proposal queue. |
| 9 | PM | Opens the request with the discovery notes attached. | — |
| 10–10d | PM | Drafts proposal v1. Local client: price is **"to be discussed"**. Previews and sends. | Stage → `proposal_sent`. Client notified. |
| 11 | Client | Reviews v1 and clicks **Request pricing meeting**. | Notifies the PM (notification + badge). |
| 12–13 | PM | Opens the notification and books the **budget and pricing** meeting. | Client gets the invite. |
| 14 | Client | Confirms the pricing meeting. | Reminder the day before. |
| 15–16 | PM | Runs the meeting, writes notes, marks it done. | Shows "next step: add the price and send v2". |
| 17–17b | PM | Opens the proposal, includes the price (currency, total, payment schedule), previews, sends v2. | v1 status → `replaced`. Client notified. |
| 19 | Client | Accepts and signs v2 online. | — |
| 20 | System | — | Proposal → `signed`. Lead → `closed_won`. **Project created** with the 5 fixed milestones and the payment schedule from the proposal. First payment (on signing) becomes `due`. PM and Sales notified. |
| 21–23e | PM | Sets up the team, backlog, sprints; views the Gantt. | Gantt bars come from milestone and sprint dates, never drawn by hand. |
| 24–25 | Developer | Starts tasks, submits work (at least one file or link). | Task status changes by itself (see §4). There is no automated or AI review. |
| 26–27 | PM | Reviews: approve or request changes. This is the only task review. | Approve → task `done`. |
| 28 | System | — | When every task in a milestone is `done`, the milestone is `done`, the next milestone starts, any payment tied to it becomes `due`, and the client's progress bar updates. |
| 29–29b | Client / PM | Client sees progress and pays outside the portal, optionally uploads proof. PM confirms the payment. | — |
| 30–30a | PM | After UAT on the agreed testing day: records the completion sign-off and marks the project complete. | Blocked until the final payment is `paid` and the sign-off is recorded. Starts the **3-month warranty**. Client notified. |
| 31 | Client | Sees "project complete", warranty end date, downloads handover files, gives feedback (1–5 + comment). | — |

### Other paths

| # | Path | Rules |
|---|---|---|
| 18a–18c | Client requests changes (topics: price, timeline, scope, other) and can message the PM. | Stage → `negotiation`. PM notified. |
| 18d–18g | PM reviews the request, replies in the system, **logs discussions held outside** (phone, email, in person, e.g. the client's lawyer), sends a revised version. | Every outside discussion is saved to the proposal history and the lead's activity log. Old version → `replaced`. |
| 18h | Client reviews the revised version. | Same choices as step 11/19. |
| 18i–18j | Client declines (optional reason and comment). | Proposal → `declined`. Lead → `closed_lost`. Sales can reopen or archive the lead. |
| 19a | Client signs on paper. | PM uploads the signed copy and records the date. Same automation as step 20. |
| 26a | PM requests changes on a task. | Task → `changes_requested`. On the board the card stays in the In progress column with a red "Changes requested" tag; there is no extra column. Developer fixes and resubmits → `in_review`. |

### International clients

No pricing meeting and no lawyer step. The PM sends the **priced** proposal as v1 (go straight to step 17), and the client signs (19).

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
| `users` | name, email, passwordHash, role, status, failedLogins, lockedUntil, emailVerifiedAt, lastSignInAt | Clients self-register (email verification, link valid 24 h). Staff accounts are created **only by Super Admin** via an invite link (valid 48 h, status `invited` until used). |
| `leads` | businessName, clientName, email, phone, industry, roleInCompany, contactPreference, urgency, serviceId, otherServiceText, details, clientType, stage, stageChangedAt, lastContactAt, assignedSalesId, clientUserId, proposalRequestedAt | Created from the inquiry form. `stage` changes only through the automations in §2, never by drag-and-drop. `proposalRequestedAt` records the proposal request; there is no separate request table. Every Sales user can see unassigned leads and claim one, which sets `assignedSalesId`. |
| `interactions` | leadId, type, occurredAt, summary, followUpAt, createdBy | The activity log. `system` entries record every automatic stage change and why. |
| `meetings` | leadId, proposalId?, projectId?, type, format, startsAt, attendees, agenda, notes, status, createdBy | Sales creates `discovery`; PM creates `budget_pricing`, `project_review`, `uat`. These four are the only types; "Proposal discussion" in the mockups is not used. One shared list, read-only for the role that didn't create it. |
| `discoveryForms` | leadId, goals, requiredFeatures, targetTimeline, budgetRange, clientType, notes, submittedAt | Submitting it (plus a done discovery meeting) unlocks the proposal request. |
| `proposals` | leadId, version, status, priceMode, currency, totalPrice, overview, solution, exclusions, needsGoals, validUntil, sentAt, signedAt, signatureType ('online' or 'paper'), signedFileUrl, declineReason | One row per version. Only one version can be "current". `needsGoals` is copied from the discovery form and editable per proposal. |
| `proposalMilestones` | proposalId, name (milestoneName), startDate, endDate | Always exactly the 5 default milestones. **Names cannot be changed, added or removed; only dates.** |
| `paymentScheduleItems` | proposalId, label, percent, trigger ('on_signing' or a milestone or 'before_completion') | Percents must total 100 before saving. Default 30/30/40. Amounts are calculated from the total price. |
| `proposalMessages` | proposalId, authorId, topics[], body | Change requests and replies. |
| `projects` | proposalId, leadId, status ('active','completed'), signedOffBy, signedOffAt, signOffFileUrl, completedAt, warrantyEndsAt | Created automatically on signing. The completion sign-off (30a) is required before the project can be marked complete. `warrantyEndsAt = completedAt + 3 months`. |
| `projectTeamMembers` | projectId, userId | Developers on the project. A developer sees only projects they are on. Build later. |
| `projectFeedback` | projectId, clientId, rating (1–5), comment, createdAt | Client feedback at step 31. Build later. |
| `documents` | clientUserId, projectId?, proposalId?, type, title, fileUrl, createdAt | Feeds the client Documents page: proposals, signed copies, handover files. Build later. |
| `projectMilestones` | projectId, name, startDate, endDate, status | Copied from the signed proposal. Status is automatic (§4). |
| `sprints` | projectId, name, goal, startDate, endDate | Must fall inside the Development milestone. No overlapping sprints. Sprint status is derived from its dates, not stored. No sprint demo date for now. |
| `tasks` | projectId, milestoneId, sprintId?, title, description, assigneeId, dueDate, priority, status | Status is automatic (§4). The milestone is fixed at creation. No task source or change-request link for now. |
| `taskSubmissions` | taskId, files[], links[], note, submittedAt | At least one file or link. No AI fields. |
| `payments` | projectId, scheduleItemId, amount, status, dueDate, method, referenceNo, receivedAt, orNumber, proofFileUrl, confirmedBy | See §5. For cheques, `referenceNo` holds the cheque number and bank. |
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

### Task status

| From | Action | To |
|---|---|---|
| (new) | PM creates and assigns it | `to_do` (or `backlog` if added to the backlog without a sprint) |
| `backlog` | PM adds it to a sprint | `to_do` |
| `to_do` | Developer clicks Start | `in_progress` |
| `in_progress` / `changes_requested` | Developer submits work (≥1 file or link) | `in_review` |
| `in_review` | PM approves | `done` |
| `in_review` | PM requests changes (with a comment) | `changes_requested` |

Nobody picks a status from a dropdown. There is no `Blocked` status. PM review (Approve or Request changes) is the only review; nothing is scored or reviewed automatically.

### Milestone status

`not_started` → `in_progress` when its first task starts (or when the previous milestone is done) → `done` when all its tasks are `done`. There is no `Client Approval` status, and clients do not approve milestones. Client progress = done tasks / all tasks, per milestone and overall.

### Meeting status

`awaiting_client` (invite sent) → `confirmed` / `reschedule_requested` / `cancelled` (client declined) → `done` (marked by the organizer). Reminder email one day before `startsAt`.

### Account

5 failed sign-ins → `locked` for 15 minutes (unlocks by itself, or Super Admin clicks Unlock). `deactivated` blocks sign-in and keeps all history; the deactivated user's open tasks stay as they are and the PM is notified to reassign them.

---

## 5. Payments

1. The schedule comes from the signed proposal. A payment becomes `due` when its trigger happens (signing, a milestone done, or before completion). The client is emailed and sees it in the portal.
2. The client pays **outside the system** (bank transfer, GCash, cheque or cash) and may upload proof → `proof_uploaded`.
3. The PM checks the money arrived, then confirms with: method, date received, reference number, and official receipt (OR) number → `paid`.
   - Bank transfer / GCash: transaction reference from the proof.
   - Cheque: cheque number and bank, both stored in `referenceNo`; confirm only after it clears.
   - Cash: no reference number; the OR number is the proof.
4. The final payment must be `paid` before the completion sign-off can be recorded. The sign-off must be recorded before the project can be marked complete.

---

## 6. Super Admin (monitor only)

Screens: Dashboard, Users, Add staff account, User detail, Deactivate, Roles (read-only table), Analytics (Business and System tabs), Reports (generate + list + preview), Audit log.

- Can: create staff accounts (Sales, PM, Developer, Content Editor), change a user's role, send a password reset, unlock, deactivate or reactivate.
- Cannot: open or change any lead, proposal, meeting, project, task or payment. Analytics and reports show **counts and totals only**, with no client names and no links into records.
- Business analytics: new leads per month, revenue collected per month, conversion funnel with step rates, proposal win rate, average days per stage, milestones on time, late payments.
- System analytics: uptime, average page load, weekly active users, errors, adoption (proposals signed online, meetings booked in the system, clients using the portal, tasks updated on time, notifications read within a day), security (sign-ins, failed sign-ins, locks, resets, email delivery), storage.
- Reports: pick a type and period, compare with the previous period, generate, then download PDF/CSV. Saved in a list.

---

## 7. Content Editor (public website)

- Simple content management with fixed fields, not a page builder.
- Changes stay as drafts until **Publish**. Every publish is written to the audit log.
- The published services list feeds both the public Services page and the inquiry form's Service dropdown, so they can never disagree.
- Home page: heading, intro, main image, up to 3 featured services and 3 featured portfolio items (published only). The "Request a service" button is fixed and always opens the inquiry form.
- About page: heading, story, mission, vision, "how we work" line, team cards (photo, name, job title). Team cards are content, not user accounts.
- Contact page: heading, intro, email, phone, address, office hours. Version history with restore.

---

## 8. Out of scope (see paper: limitations)

- **Retainer** agreements after the warranty ends. Optrizo will add this themselves.
- Online payment processing. Payments happen outside the system; the system records and confirms them.
- Blog and testimonials. They are hidden from menus and routes, and the code is kept.
- For now: task source or change-request link, and sprint demo date.

---

## 9. Suggested build order

1. Roles, auth, route guards, audit log, notifications (foundation).
2. Inquiry → lead → activity log → automatic stages.
3. Meetings (discovery) and the discovery form, with the proposal lock.
4. Proposals: versions, fixed milestones, price modes, payment schedule, pricing meeting, changes, outside discussions, signing.
5. Project created on signing: milestones, tasks with automatic status, sprints, Gantt.
6. Payments.
7. Client portal.
8. Super Admin: accounts, roles, audit log, analytics, reports.
9. Content Editor.

---

## 10. Recorded decisions

These settle earlier conflicts between this spec and the mockups. This spec wins where a mockup says otherwise.

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
| Added, build later | Project team members, completion sign-off (30a), client feedback 1–5 (31), client Documents page, cheque bank in `referenceNo`. |
| Skipped for now | Task source and change-request link, sprint demo date. Sprint status comes from its dates. |
| `requestProposal` | No new table. Uses `proposalRequestedAt` on the lead. |
| Analytics `Own` | A small report strip on the role's own dashboard. No analytics page for Sales or the PM. |
| Unassigned leads | Every Sales user can see unassigned leads and claim one. Leads never fall back to Super Admin. |
| Site settings | Split. Website content settings belong to the Content Editor. System settings (email, integrations, security, accounts) stay with Super Admin. |
