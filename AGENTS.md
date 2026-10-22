# Repository Guidelines

## Project Structure & Module Organization

This is a Next.js App Router application. Routes and layouts live in `src/app`; reusable UI is in `src/components`; domain code is grouped under `src/features`; shared configuration, database schema/access, utilities, state, and types are in `src/config`, `src/db`, `src/lib`, `src/store`, and `src/types`. Put static assets in `public`, database scripts and maintenance tools in `scripts`, and focused checks in `tests`. Root-level migration and test scripts support existing workflows; follow their established placement when extending them.

## Build, Test, and Development Commands

- `npm run dev` starts Next.js with Turbopack for local development.
- `npm run build` creates a production build; `npm start` serves that build.
- `npm run lint` runs ESLint across the repository.
- `npm run test:capstone` runs the CRM routing, scope engine, and quality gate checks.
- `npm run db:generate`, `npm run db:migrate`, and `npm run db:push` generate or apply Drizzle schema changes; use `npm run db:studio` to inspect the database.

## Coding Style & Naming Conventions

Use TypeScript for application and script code. Follow the repository Prettier settings: 2-space indentation, semicolons, double quotes, trailing commas where valid, and a 100-character print width. Tailwind class ordering is handled by `prettier-plugin-tailwindcss`. Use PascalCase for React component files and component names, and kebab-case or descriptive lowercase names for route segments and utility files. Keep feature-specific behavior within its `src/features/<area>` module.

## Responsive Design & Kanban Standards

- **Card Containment**: Cards in Kanban boards and grid layouts must specify `w-full min-w-0 overflow-hidden` to prevent content blowout. Use `line-clamp` on titles/descriptions, wrap metadata footers (`flex-wrap gap-y-1.5`), and set `whitespace-nowrap shrink-0` on badges, timestamps, and action icons.
- **Multi-Column Boards on Mobile**: For boards with 4+ columns (e.g. Sales Pipeline, PM Active Delivery), avoid squeezing columns horizontally on mobile (< 768px). Implement a horizontal snap-carousel (`flex overflow-x-auto snap-x snap-mandatory` with `w-[84vw] max-w-[320px] shrink-0 snap-center`) paired with a quick-switch column tab bar (`md:hidden`).
- **Touch Drag-and-Drop Sensors**: When using `@dnd-kit/core`, do not use bare `PointerSensor` as it hijacks vertical touch scrolling. Use `MouseSensor` (`distance: 8`) for desktop and `TouchSensor` with `{ activationConstraint: { delay: 200, tolerance: 6 } }` for mobile touch interactions.

## Testing Guidelines

Tests are TypeScript files named `test-<area>.ts` in `tests/`; run the supported group with `npm run test:capstone`. Add or update focused checks alongside related tests when changing domain behavior. Run `npm run lint` for static checks and `npm run build` when validating production compilation.

## Commit & Pull Request Guidelines

Recent commits use short, imperative summaries, commonly prefixed with `feat:`, `fix:`, or a scoped form such as `fix(upload):`. Keep changes focused and describe their user-visible or technical effect. Pull requests should summarize the change, note relevant testing, link related issues where applicable, and include screenshots for UI changes.

- **Pre-Commit Verification**: Validate focused changes with `npx tsc --noEmit` and `npm run test:capstone`. If legacy files trigger pre-existing repository lint errors during Husky pre-commit hooks, pass `--no-verify` to commit verified changes.
- **PowerShell Path Escaping**: Always wrap file paths containing Route Group parentheses `(admin)` or dynamic route brackets `[id]` in double quotes when executing CLI commands.

## Security & Configuration

Keep credentials and environment-specific settings in local environment files; never commit secrets. Review the security and access-boundary documents at the repository root before changing authentication, uploads, client data, or public/private route behavior. Use the documented Drizzle workflows for database changes and include migration updates when needed.
