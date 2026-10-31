# Lint baseline

Existing ESLint problems, recorded on 2026-10-31 so they can be fixed later. None were fixed when this file was added.

**Total: 191 errors and 119 warnings. Errors are in 69 files.**

`npm run lint` shows 0 errors because the 191 are listed in `eslint-suppressions.json`. They still exist, and this file is the record of them.

## How the check works

- The pre-commit hook runs `npx lint-staged`, which lints only staged files.
- Existing errors pass because they are suppressed.
- A new error fails the commit. This covers a new rule in a file, and going over a file's recorded count for a rule.
- Warnings don't block commits.

## By folder

| Folder | Errors | Warnings | Files with problems |
|---|---:|---:|---:|
| `src/features` | 99 | 50 | 41 |
| `src/app` | 37 | 33 | 20 |
| `src/components` | 28 | 18 | 16 |
| `src/auth.ts` | 8 | 0 | 1 |
| `scripts` | 6 | 5 | 8 |
| `tests` | 5 | 7 | 5 |
| `src/auth.config.ts` | 4 | 0 | 1 |
| `src/actions` | 2 | 3 | 2 |
| Repo root | 1 | 3 | 2 |
| `src/lib` | 1 | 0 | 1 |

## By rule

| Rule | Errors | Warnings |
|---|---:|---:|
| `@typescript-eslint/no-explicit-any` | 161 | 0 |
| `react-hooks/set-state-in-effect` | 9 | 0 |
| `react/no-unescaped-entities` | 8 | 0 |
| `@typescript-eslint/no-require-imports` | 5 | 0 |
| `react-hooks/purity` | 3 | 0 |
| `react-hooks/refs` | 2 | 0 |
| `prefer-const` | 1 | 0 |
| `react-hooks/immutability` | 1 | 0 |
| `react-hooks/rules-of-hooks` | 1 | 0 |
| `@typescript-eslint/no-unused-vars` | 0 | 107 |
| `react-hooks/exhaustive-deps` | 0 | 7 |
| `@next/next/no-img-element` | 0 | 5 |

The `react-hooks` errors are the ones most likely to be real bugs, so fix those first.

## Files with the most errors

| File | Errors |
|---|---:|
| `src/features/proposals/components/ProposalBuilderStudio.tsx` | 13 |
| `src/features/crm/components/LeadDetailsDrawer.tsx` | 12 |
| `src/app/(admin)/dashboard/page.tsx` | 11 |
| `src/features/pm/actions.ts` | 11 |
| `src/app/api/proposals/[id]/pdf/route.ts` | 8 |
| `src/auth.ts` | 8 |
| `src/components/providers/SmoothScrollProvider.tsx` | 8 |
| `src/app/(client)/proposal/[id]/page.tsx` | 6 |
| `src/features/crm/components/LeadCard.tsx` | 6 |
| `src/features/crm/components/LeadsPipelineView.tsx` | 6 |

## Fixing errors later

See every suppressed error. The file must exist, so create an empty one first (Git Bash):

```
echo '{}' > .no-suppressions.json
npx eslint --suppressions-location .no-suppressions.json
rm .no-suppressions.json
```

After fixing some, remove their entries so they can't come back:

```
npx eslint --prune-suppressions
```

Commit the updated `eslint-suppressions.json` and update the tables here.
