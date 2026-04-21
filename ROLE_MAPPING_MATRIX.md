## Role → Permission/Action Matrix (Optrizo)

This matrix aligns the product roles described in Chapter 1 with the technical roles used by the implemented system.

### Technical Role Mapping
- **Administrator (Chapter 1)** → technical role: `admin`
- **General Staff (Chapter 1)** → technical role: `editor`
- **Client (Chapter 1)** → technical role: `client`

### Module-Level Permissions

#### CRM (Leads, Lead Notes, Analytics, Deal Won)
- View (Chapter intent):
  - `admin`: can view all non-archived leads.
  - `editor`: can view only leads assigned to them (server-side scope).
- Mutate (Chapter intent):
  - `admin`: allowed to update leads, add lead notes, mark deals won, and view CRM analytics.
  - `editor`: **not allowed** to mutate CRM commercial workflow data (updates/notes/analytics).

#### Proposals (Draft/Sent/Approved/Rejected)
- Mutate:
  - `admin`: allowed to create/update proposals and send proposal emails.
  - `editor`: **not allowed** to create/update/send proposals.
- Client-initiated:
  - `client`: can view the proposal only for the lead tied to their email, and can accept/reject proposals.

#### CMS (Public Content Management)
- Mutate:
  - `admin`: allowed to create/update/publish public site content and global settings.
  - `editor`: **not allowed** to manage CMS content.
- Public read:
  - All visitors can read published content according to CMS publishing state.

#### Project Workflow Tracking (PM Engine)
- Project board view:
  - `admin` and `editor`: can view the board for a project they can access.
- Task execution (Chapter intent):
  - `editor` can update task statuses **only if the task is assigned to them**.
  - `editor` cannot create tasks, create/edit milestones, delete tasks/milestones, or change milestone workflow status.
- Workflow structure changes:
  - `admin` only: can create/edit/delete milestones and manage project/milestone statuses.

#### Client Portal
- `client`: can access the portal only with role `client` and can only see projects where they are listed as a stakeholder.
- `client`: can submit milestone feedback only for milestones in their stakeholder-scoped projects.
- `client`: can upload revision/supporting documents into their portal (attachments stored and served privately).

### Enforcement Notes
- Authorization is enforced at server entry points for sensitive actions (server actions/pages).
- UI components may be hidden/disabled to reduce unauthorized attempts, but server-side checks remain the source of truth.

