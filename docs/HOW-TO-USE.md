# How to use this pack

## 1. Add it to the repo

Unzip at the **root of the repository** (next to `package.json`). You get:

```
CLAUDE.md                 standing rules Claude Code reads automatically
docs/workflow-spec.md     roles, permissions, records, statuses, automations
docs/api-contract.md      backend ↔ UI agreements (fill in per module)
docs/mockups/README.md    every screen in step order, with notes
docs/mockups/<section>/   one screenshot per screen
docs/mockups/html/        the HTML each screenshot was drawn from
```

If the repo already has a `CLAUDE.md`, merge the two instead of replacing yours.

Commit it on a branch (e.g. `docs/spec-pack`) and merge it, so both of you have it.

## 2. First session with Claude Code

Open a terminal in the project folder and run `claude`. Switch to plan mode, then send:

> Read CLAUDE.md, docs/workflow-spec.md and docs/mockups/README.md. Then compare them with the current code. Give me a gap list grouped by module (auth and roles, leads, meetings, proposals, projects and tasks, payments, client portal, Super Admin, Content Editor). For each item say: already matches, partly there, missing, or conflicts with the spec. Don't change any code yet.

Save the answer as `docs/gap-list.md`, then work through it one module at a time, following the build order in section 9 of the spec.

## 3. Prompts for each person

Backend and process:
> Implement automatic lead stages from docs/workflow-spec.md section 4. Add the Drizzle schema changes and a migration, the server actions, the audit log rows and the notifications. Add the contract to docs/api-contract.md first.

UI/UX:
> Build the Sales pipeline page and lead detail page (steps 2–8 in docs/mockups) using our existing components. Use mock data shaped like the entries in docs/api-contract.md. Layout and content from the mockups; styling from our design system.

## 4. Keeping the two of you in sync

- Agree on the `docs/api-contract.md` entry for a module before either of you starts it.
- Branches: `backend/<topic>` and `ui/<topic>`. Small pull requests into `main`. Pull `main` every day.
- Each of you can run Claude Code on your own branch. Both sessions read the same `CLAUDE.md` and spec, so they build toward the same thing.
- When the spec changes, change `docs/workflow-spec.md` in the same PR as the code.
