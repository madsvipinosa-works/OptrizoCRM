## Optrizo Implementation Rollout Plan (Phased)

This rollout follows the phased improvement order defined in your plan:
Phase 0 through Phase 4, emphasizing security hardening first.

### Phase 0: Production Safety Gates
- Disable/lock down debug backdoors:
  - Ensure `ALLOW_MAKE_ME_ADMIN` is unset or `!= true` in all production-like environments.
- Verify route protection:
  - Confirm all confidential views (proposal viewing and client portal) are protected by the same authorization model.
- Validate that auth/session role propagation works end-to-end:
  - A `client` user must have role `client` in the DB before they can access proposal and portal workflows.

### Phase 1: Authorization + Confidentiality Boundaries
- Enforce strict client-only proposal access:
  - Proposal viewing requires an authenticated `client` role and email ownership match.
  - Proposal accept/reject requires authenticated `client` role and ownership validation.
- Enforce strict client portal role:
  - Portal access requires role `client`.
- Enforce ownership validation for milestone feedback:
  - Client feedback actions require stakeholder membership in the milestone’s project.
- Enforce internal staff scope:
  - Editors (General Staff) are restricted to their assigned operational tasks and assigned CRM leads (server-side scoping).

### Phase 2: Workflow Correctness (State Machines + Progress Semantics)
- Confirm lead → project → milestone → tasks transitions are consistent:
  - “Revision requested” and “approved” feedback deterministically drives milestone status and unblocks tasks.
- Confirm progress computations:
  - Ensure admin dashboards and client portal progress bars use the same definition.

### Phase 3: Functional Completeness (Promised Workflows)
- Cold lead follow-ups:
  - Operationally define cold triggers using `nextActionDate`, and ensure stop conditions prevent repeated outreach.
- Client portal file uploads:
  - Enable client upload of revision/supporting documents via portal.
  - Ensure attachment visibility is linked to the correct lead/project stakeholder scope.

### Phase 4: Compliance + Operational Readiness
- Security/compliance validation:
  - Upload scanning policy (define tool/provider, scanning thresholds, and rejection workflow).
  - Ensure audit log coverage includes high-risk actions (workflows, uploads, deletions).
- Retention/delete operations:
  - Define retention durations and implement deletion behavior consistently across references and underlying storage.

### Migration / Data Onboarding
1. Existing files:
   - Legacy public blob URLs may remain accessible until migrated.
   - Recommended migration approach:
     - Re-upload legacy attachments into the private blob store.
     - Update DB references to authenticated download route URLs.
     - Remove legacy public files/blobs if feasible.
2. Existing users:
   - Ensure that client users have role `client` before the proposal/portal workflow is used.
   - Ensure editor accounts correspond to assigned lead/task scope.

### Acceptance Test Checklist (Non-exhaustive)
- Admin:
  - Can create/edit leads, proposals, CMS content, and PM workflows.
- Editor (General Staff):
  - Can view only assigned leads.
  - Can view only assigned tasks on the Kanban board.
  - Cannot mutate leads/proposals/CMS or create milestones/projects.
- Client:
  - Can view only their proposals and portal projects.
  - Can submit milestone feedback only for milestones in stakeholder-scoped projects.
  - Can upload documents in the Document Hub.
- Confidentiality:
  - Attempt to open proposal pages or file download routes without authentication fails.

