# Optrizo CRM: scope rules

Source of truth: docs/workflow-spec.md. Layout reference: the screen files in docs/mockups/. Contracts: docs/api-contract.md. Also follow CLAUDE.md.

Do only what the current prompt lists. Specifically:
- No new features, screens, fields, settings, options or statuses that the prompt or the spec doesn't name.
- No new npm packages, services or environment variables without asking first.
- No refactoring, renaming, reformatting or "cleanup" of code the prompt doesn't name. Don't touch unrelated files.
- No new abstractions (helpers, hooks, base classes, wrappers) unless the prompt asks for one.
- No styling changes beyond what a screen needs to work. Visual polish is done separately.
- No extra error handling, logging, analytics, caching, i18n or tests beyond what the prompt asks.
- Never edit .env, never push, never run migrations against a remote database.
- If something seems needed but isn't listed, stop and ask. Write it under "Not done / questions" in the report instead of doing it.
- If the spec and the code or mockups disagree, follow the spec and report the conflict.
- Never connect to DATABASE_URL or run any DB command. Never run drizzle-kit push or migrate.
- Never merge, rebase, amend, push, or checkout main. Stay on the session branch; I do merges.
- Don't create scratch scripts in the repo. If you need one, use the OS temp folder and delete it.
- Don't commit files that aren't in the plan. If a fix needs another file, ask first.
- Use exact function and file names from the code in reports. Don't rename them from memory.
- Don't add helpers or overloads for convenience. If an existing function fits, use it.
