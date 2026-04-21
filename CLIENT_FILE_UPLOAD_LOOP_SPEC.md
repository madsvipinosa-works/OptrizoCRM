## Client Portal File Upload (Revision/Supporting Documents) Spec

### Objective
Enable clients to upload revision/supporting assets directly from the Client Portal, so project progress can continue without manual file collection outside the system.

### Current UI/Flow (implemented)
1. Client opens the `Client Portal` for their project.
2. In the `Document Hub` card, the client uploads a file via the portal upload control.
3. The system:
   - uploads the file using the authenticated private-upload pipeline
   - associates the uploaded file with the corresponding CRM `Lead` record (stored in `leads.files`)
   - refreshes the portal view
4. Admin/staff can later view the attached documents from the CRM lead view and use them during project delivery/revision.

### Security/Authorization Rules
- Only authenticated users with role `client` can upload.
- The upload is only allowed if the authenticated client is a stakeholder for a project derived from the provided `leadId`.
- File delivery is protected:
  - uploaded files are stored in private blob storage (or local dev private storage)
  - downloads require an authenticated session via `/api/private-file`.

### Retention Class (chosen)
- **Retained deliverables (default)**:
  - uploaded revision/supporting documents are stored in `leads.files`
  - files remain accessible to the client as part of their portal until removed/archived by internal staff.

### Auditability
- The system records the upload/attachment event in `audit_log` (via `logAction`).
- Any subsequent admin actions (e.g., proposal workflow steps, milestone moves, file removal) should also be logged to support dispute resolution and compliance.

### Audit Link Model
- Attachment is linked by business context:
  - file is linked to `Lead` (the CRM entity that backs the proposal + the resulting project)
  - portal visibility is derived from project stakeholder membership (`projectStakeholders`)

### Admin Removal / Lifecycle
- When staff needs to remove or supersede outdated uploads:
  - internal staff should remove the file reference from `leads.files`
  - and (optionally) delete the underlying blob via the existing deletion pipeline.

