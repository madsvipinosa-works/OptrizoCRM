# Optrizo CRM

Capstone project: a web-based CRM with integrated public content management and project tracking workflow for Optrizo Digital Solutions.

Stack: Next.js, React, Drizzle ORM. Check `package.json`, `drizzle.config.*` and the existing folder structure before adding anything, and follow the patterns already in the repo (App Router vs Pages Router, server actions vs route handlers, database dialect, UI library).

## Where the requirements live

- `docs/workflow-spec.md`: **source of truth** for roles, permissions, records, statuses, automations, payments. Read it before changing any workflow code.
- `docs/mockups/README.md`: every screen in step order, with screenshots (`.png`) and the HTML they were drawn from (`html/`). Start with `00-workflow-overview-start-here`.
- `docs/api-contract.md`: agreed inputs and outputs between backend and UI. Update it in the same PR when a contract changes.
- `docs/gap-list.md`: known gaps between the spec and the code, including the system settings that exist today.

## Rules

- The mockups define **layout and workflow, not visual design**. Match what each screen contains and how steps connect; use the project's own components and styling.
- If code, mockups and spec disagree, follow `docs/workflow-spec.md` and say what conflicts. Don't silently pick one.
- Statuses change only through the actions in the spec (lead stage, task status, milestone status, payments). Never add a manual status dropdown. A lost lead is reopened only by Sales through Reopen (reason required); archive is `archivedAt`, not a stage.
- Meetings: Sales edits `discovery`; the PM edits `budget_pricing`, `project_review` and `uat`. Each role can view the other's.
- Proposal milestones: the 5 defaults are always there and cannot be removed, but the PM may rename them and add milestones of their own between them (decision 2026-11-08, migration 0020).
- No lead score and no budget field on the public inquiry form.
- Super Admin monitors only. It must never create, edit or delete leads, proposals, meetings, projects, tasks or payments. Analytics and reports show counts and totals only. The audit log and recent activity may show names, roles and record type, read-only, with no links into records.
- Check permissions on the server (server actions, route handlers, middleware), not only in the UI.
- Write an audit log row for every create, update, status change, sign-in, lock and account change. The audit log is append-only.
- Every hand-off between roles creates a notification. If the lead has no `assignedPmId` yet, a hand-off to the PM notifies every PM.
- Use the step numbers from the mockups (e.g. "step 13") in commit messages and PR titles, so work traces back to the workflow.

## Team

Two developers working in parallel:
- Backend and process: database schema, Drizzle migrations, status rules, permissions, notifications, server actions and API.
- UI/UX: pages, components, layout, front-end state.

Work on feature branches (`backend/<topic>`, `ui/<topic>`), merge to `main` through pull requests, keep PRs small, and pull `main` often. Agree on the contract in `docs/api-contract.md` before building a module, so the UI can use mock data while the backend is built.
