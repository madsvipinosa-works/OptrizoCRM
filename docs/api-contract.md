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
Side effects: sets `proposalRequestedAt` on the lead (no separate request table); notification to the PM; audit log row; request appears in the PM proposal queue (step 9).

### claimLead  (step 2)
Who can call: sales
Input:  `{ leadId: string }`
Output: `{ ok: true, leadId: string }`
Errors:
- `FORBIDDEN`: caller is not Sales.
- `ALREADY_ASSIGNED`: the lead already has a Sales owner.
Side effects: lead assigned to the caller; activity log entry; audit log row.

### sendProposal  (steps 10d and 17b)
Who can call: manager
Input:  `{ proposalId: string }`
Output: `{ ok: true, version: number, status: 'sent' }`
Errors:
- `MILESTONES_INVALID`: not exactly the 5 default milestones, or dates missing.
- `SCHEDULE_NOT_100`: priced proposal whose payment schedule doesn't total 100%.
Side effects: lead stage → `proposal_sent` (if earlier); previous version → `replaced`; client email + portal notification; audit log row.

### requestPricingMeeting  (step 11)
Who can call: client (own proposal only)
Input:  `{ proposalId: string, note?: string }`
Output: `{ ok: true }`
Side effects: proposal status → `pricing_meeting_requested`; PM notification (step 12); audit log row.

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
Side effects: payment → `paid`; client sees "Paid · confirmed by Optrizo"; audit log row.

---

## Entries

(Add one per action as modules are built.)
