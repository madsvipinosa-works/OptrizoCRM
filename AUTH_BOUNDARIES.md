## Authorization Boundaries (Optrizo CRM/CMS/PM)

This document defines the strict authorization boundaries implemented for Phase 1 of the improvement plan.

### Roles
- `client`: external user who can access the client portal and submit milestone feedback / accept or reject proposals that belong to their lead.
- `admin` / `editor`: internal agency users who can manage leads, proposals, and project workflows.

### Proposal Viewing (login-only, client-scoped)
- The proposal page requires authentication.
- Only users with role `client` may access the page.
- Ownership rule: the authenticated client must have the same email as the proposal’s linked lead email.
- If either authentication/role or ownership checks fail, the page returns `not found` (no disclosure).

### Proposal State Changes (client-initiated)
- `acceptProposalByClient` and `rejectProposalByClient` require authentication.
- Only role `client` may call these actions.
- Ownership rule: the authenticated client’s email must match the linked lead email on the proposal.
- If checks fail, the action returns an authorization error without modifying proposal or lead state.

### Client Portal Access (strict-client-role)
- The client portal requires authentication.
- Only users with role `client` may access the portal.
- Portal data is fetched through `projectStakeholders` membership for the authenticated user id.

### Milestone Feedback Submission (client-initiated)
- Submitting milestone feedback requires authentication.
- Only role `client` may submit feedback.
- Ownership rule: the milestone’s project must include the authenticated user as a stakeholder in `projectStakeholders`.
- After a client submits feedback:
  - The system unblocks tasks that were blocked by client action.
  - The milestone status is updated deterministically based on feedback type:
    - `REVISION_REQUESTED` => `In Progress`
    - `APPROVED` => `Completed`

### Backdoor / Debug Endpoint Safety
- The `api/make-me-admin` endpoint is disabled by default.
- It can only be enabled if an explicit environment variable `ALLOW_MAKE_ME_ADMIN` is set to `true`.
- In all other cases, the endpoint returns `403`.

