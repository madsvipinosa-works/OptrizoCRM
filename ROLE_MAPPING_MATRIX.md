## Role → Permission/Action Matrix (Optrizo)

This matrix aligns the product roles described in Chapter 1 with the technical roles used by the implemented system.

### Technical Role Mapping
- **Administrator (Chapter 1)** → technical roles: `superadmin`, `manager`
- **General Staff (Chapter 1)** → technical roles: `sales`, `developer`, `content_editor`
- **Client (Chapter 1)** → technical role: `client`

### Module-Level Permissions

#### CRM (Leads, Lead Notes, Analytics, Deal Won)
- View (Chapter intent):
  - `superadmin`, `manager`, `sales`: can view all non-archived leads and analytics.
  - `developer`, `content_editor`: **locked out completely** (no access to CRM or Analytics).
- Mutate (Chapter intent):
  - `superadmin`, `manager`, `sales`: allowed to update leads, add lead notes, mark deals won, and view CRM analytics.
  - `developer`, `content_editor`: **locked out completely**.

#### Proposals (Draft/Sent/Approved/Rejected)
- Mutate:
  - `superadmin`, `manager`, `sales`: allowed to create/update proposals and send proposal emails.
  - `developer`, `content_editor`: **locked out completely**.
- Client-initiated:
  - `client`: can view the proposal only for the lead tied to their email, and can accept/reject proposals.

#### CMS (Public Content Management)
- Mutate:
  - `superadmin`, `manager`, `content_editor`: allowed to create/update/publish public site content (Portfolio, Services, Blog, Testimonials).
  - `sales`, `developer`: restricted or no access to CMS publishing.
- Public read:
  - All visitors can read published content according to CMS publishing state.

#### Project Workflow Tracking (PM Engine)
- Project board view:
  - `superadmin`, `manager`, `developer`, `content_editor`: can view the board for a project they can access.
- Task execution (Chapter intent):
  - `developer`, `content_editor` (General Staff): can update task statuses **only if the task is assigned to them**.
  - `developer`, `content_editor`: cannot create tasks, create/edit milestones, delete tasks/milestones, or change milestone workflow status.
- Workflow structure changes:
  - `superadmin`, `manager` only: can create/edit/delete milestones and manage project/milestone statuses.

#### Client Portal
- `client`: can access the portal only with role `client` and can only see projects where they are listed as a stakeholder.
- `client`: can submit milestone feedback only for milestones in their stakeholder-scoped projects.
- `client`: can upload revision/supporting documents into their portal (attachments stored and served privately).

### Enforcement Notes
- Authorization is enforced at server entry points for sensitive actions (server actions/pages).
- UI components may be hidden/disabled to reduce unauthorized attempts, but server-side checks remain the source of truth.

