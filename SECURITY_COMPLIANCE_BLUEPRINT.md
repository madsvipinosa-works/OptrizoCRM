## Security & Compliance Blueprint (Optrizo)

### 1. Security Model Summary
The system implements a layered security model:
1. **Authentication**: NextAuth session required for protected routes and all sensitive server actions.
2. **Authorization**: Server-side role checks and ownership/scoping validation for client-initiated actions.
3. **Data boundary**: Confidential artifacts (lead/proposal/client assets) are delivered via authenticated routes, not publicly reachable blob URLs.
4. **Auditability**: Security-sensitive actions write to `audit_log` via `logAction(...)`.

### 2. DB-Layer Enforcement Expectation (Defense in Depth)
Blueprint requirement:
- For confidential tables (leads, proposals, client feedback, audit logs, and any client attachment metadata), database-layer enforcement (e.g., PostgreSQL RLS or equivalent) should be enabled so that a missed app-layer filter does not become a data breach.

Current implementation note:
- This blueprint defines the requirement; it is not a substitute for correct app-layer authorization checks.

### 3. Audit Events (Accountability)
Canonical audited actions:
- Authentication events:
  - user login (`LOGIN`)
- Business workflow:
  - proposal accept/reject
  - lead won/provisioning automation triggers
  - milestone feedback submissions
- Admin actions:
  - lead/proposal updates
  - project/milestone/task structural updates
- Security-sensitive file operations:
  - file uploads (`CREATE` on entity `Upload`)
  - file deletions (`DELETE` on entity `Upload`)

Implementation principle:
- Audit logs should record “who/what/when/where context” with minimal sensitive data where possible.

### 4. Retention / Deletion Policy (Data Classes)
Define retention by data class:
- Public CMS content:
  - Retain until explicitly unpublished/deleted by admin.
- CRM private data (leads + internal notes):
  - Retain for a configurable business period.
  - Support deletion workflows if subject to legal/data subject requests.
- Client attachments:
  - Default to “retained deliverables” during active project lifecycle.
  - Provide admin-driven removal or replacement.
  - Ensure deletion cascades to remove references and underlying blobs (where supported).
- Audit logs:
  - Retain to meet operational/dispute resolution needs.

Deletion guidance:
- Deleting a reference should not accidentally leave downloadable content accessible.
- When removing files, delete from the private blob store and purge local private fallback files.

### 5. Upload Risk Controls (Malware and Abuse)
Current controls (implemented):
- Type allowlist (images/PDF/zip variants depending on uploader)
- Max file size validation
- Authenticated private storage and authenticated download proxy

Blueprint requirement (still to be fully implemented operationally):
- Malware scanning of uploaded content before it is marked usable.
- Enforce stricter content validation:
  - MIME sniffing vs header-only checks
  - archive scanning for ZIP uploads
- Apply rate limiting and anti-abuse throttling per uploader/session.

### 6. Backdoor Safety
- The debug endpoint `api/make-me-admin` is disabled by default.
- It can only be enabled if an explicit environment variable `ALLOW_MAKE_ME_ADMIN=true` is set.

### 7. Compliance Considerations (Data Privacy)
Given the system processes personal data (names/emails/inquiry content):
- Lawful basis/consent and purpose limitation should be documented.
- Retention duration and deletion handling must be specified in the project’s compliance documentation.
- Provide a process for data subject access requests and deletion requests.

