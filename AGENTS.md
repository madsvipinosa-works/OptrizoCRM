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

## Testing Guidelines

Tests are TypeScript files named `test-<area>.ts` in `tests/`; run the supported group with `npm run test:capstone`. Add or update focused checks alongside related tests when changing domain behavior. Run `npm run lint` for static checks and `npm run build` when validating production compilation.

## Commit & Pull Request Guidelines

Recent commits use short, imperative summaries, commonly prefixed with `feat:`, `fix:`, or a scoped form such as `fix(upload):`. Keep changes focused and describe their user-visible or technical effect. Pull requests should summarize the change, note relevant testing, link related issues where applicable, and include screenshots for UI changes.

## Security & Configuration

Keep credentials and environment-specific settings in local environment files; never commit secrets. Review the security and access-boundary documents at the repository root before changing authentication, uploads, client data, or public/private route behavior. Use the documented Drizzle workflows for database changes and include migration updates when needed.
