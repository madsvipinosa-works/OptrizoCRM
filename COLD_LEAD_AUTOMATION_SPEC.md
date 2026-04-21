## Cold Lead Follow-Up Automation Spec

### Goal
Reduce lead leakage by automatically scheduling and triggering follow-ups for leads that stop responding after an initial inquiry or proposal cycle.

### Inputs (from current CRM data)
- `leads.nextActionDate` (scheduled follow-up datetime)
- `leads.status` (pipeline/terminal state)
- `leads.updatedAt` (last staff action timestamp)
- `leads.assignees` (optional: internal owners of the lead)
- Lead identity:
  - `leads.email`, `leads.name`, `leads.service`, `leads.budget`, `leads.subject`, `leads.message`

### Cold Lead Definition (product rules)
A lead is considered “cold” when:
- `leads.isArchived = false`
- `leads.nextActionDate` is set and `nextActionDate <= now`
- `leads.status` is not terminal

Terminal statuses (examples; align to your business vocabulary):
- `Won`, `Lost`, and any equivalent “closed” states

### Trigger Cadence
- Run follow-up checks on a fixed interval (e.g., every 15 minutes or hourly).
- The interval must be coordinated with rate limiting to prevent notification/email floods.

### Delivery Channels (based on your earlier decision)
- In-app notifications (to lead assignees and/or admins)
- Email follow-up (to `leads.email`)
- Messaging import is explicitly out-of-scope.

### Stop Conditions (must suppress further automation)
Stop follow-ups when any of the following occurs:
- Lead transitions to terminal state (`Won` or `Lost`)
- Staff updates the lead pipeline state in a way that indicates response or conversion (e.g., `Qualified`, `Proposal Sent`, `Negotiation`)
- Staff manually sets a new `nextActionDate` AND indicates it is no longer a “cold lead” moment (by policy)

Additionally, the system should treat any “reply captured” event as a stop condition:
- Because external messaging import is out-of-scope, define “reply captured” as a staff action in the CRM (e.g., logging a call/email/note that indicates the client responded).

### Required State to Prevent Repeated Sends
The current schema only has `nextActionDate` and does not include “follow-up already sent” metadata.

To avoid repeated follow-ups on every automation run, implement one of these approaches:
- Add fields to `leads`:
  - `lastColdFollowUpSentAt`
  - `coldFollowUpCount`
  - `coldFollowUpSuppressedUntil`
- Or add a dedicated table:
  - `lead_followups` with `sentAt`, `channel`, `sequence`, `reason`, `actor`

Blueprint requirement:
- Exactly one follow-up should be sent per lead per “sequence” when `nextActionDate <= now`.

### Rate Limiting and Templates
- Apply per-lead and per-IP throttles to prevent abuse.
- Email templates:
  - Must include lead name, service context, and a clear call-to-action.
  - Must include opt-out / preference handling (at least a suppression rule if the client indicates “not interested”).

### Staff Override UX Requirements
- Staff should be able to:
  - set/clear `nextActionDate`
  - mark the lead as “responded” via a structured CRM action
  - suppress cold automation for specific leads

