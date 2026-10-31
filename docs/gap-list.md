# Gap list

Known gaps between `docs/workflow-spec.md` and the current code. Add an entry when you find one and remove it when it is closed.

## Existing system settings

The spec has no Super Admin settings screen for now (spec §6 and §10). These settings already exist in the code.

### Global Site Settings page

- Page: `/dashboard/settings` ("Global Site Settings"), in `src/app/(admin)/dashboard/settings/page.tsx`.
- Storage: one row in `site_settings` (id `singleton_root`), defined in `src/db/schema.ts`.
- Saved by `updateSiteSettings` in `src/features/cms/actions.ts`, which requires the `superadmin` role.
- `middleware.ts` treats `/dashboard/settings` as a system route.

| Setting | Field | Used for |
|---|---|---|
| Notification emails | `notificationEmails` | Addresses that receive notification emails (read in `src/lib/notifications.ts`). A system setting. |
| Public contact email | `contactEmail` | Shown on the public site. Website content. |
| Logo (light and dark), favicon | `logoUrl`, `logoDarkUrl`, `faviconUrl` | Branding on the public site. Website content. |
| Homepage hero and media | `heroTitle`, `heroDescription`, `demoVideoUrl` | Home page. Website content. |
| FAQs | `faqs` | Public site. Website content. |
| About page | `aboutText`, `aboutHeroTitle`, `missionStatement`, `companyStats`, `aboutTechStack`, `aboutTechStackItems`, `aboutCtaHeadline`, `aboutCtaText` | About page. Website content. |

Gap: the spec gives website content to the Content Editor (§7), but only `superadmin` can save this form today.

### Rate limits

Set in code, with no screen, in `src/lib/rate-limit.ts` (stored in Upstash Redis):

| Policy | Limit |
|---|---|
| `loginIp` | 20 per 15 minutes |
| `loginEmail` | 5 per 15 minutes |
| `signupIp` | 5 per 60 minutes |
| `passwordResetRequestIp` | 5 per 15 minutes |
| `passwordResetRequestEmail` | 3 per 15 minutes |
| `passwordResetSubmitIp` | 10 per 15 minutes |
| `contact` | 3 per 10 minutes |
| `intake` | 5 per 10 minutes |

Gap: these are rate limits. The account lock in spec §4 (5 failed sign-ins set the account to `locked` for 15 minutes) is not implemented; `src` has no `failedLogins` or `lockedUntil`.

### Environment variables

Configured outside the app, with no screen:

| Variable | Used for |
|---|---|
| `RESEND_API_KEY`, `RESEND_FROM_EMAIL` | Sending email (`src/lib/notifications.ts`, `src/features/proposals/actions.ts`). |
| `NEXTAUTH_URL` | Base URL for links in emails, such as the password reset link. |
| `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` | Rate-limit storage. |
| `WEBHOOK_SECRET` | Bearer token for `POST /api/webhooks/leads`. Required: with it unset, the webhook returns 500 and creates nothing. |
| `BLOB_READ_WRITE_TOKEN` | Vercel Blob access. Only sent to `*.blob.vercel-storage.com` by `/api/private-file`. |

## Exposed endpoints and actions

Fixed on `fix/exposed-endpoints` (Step B1), each with tests in `tests/unit/authz/`:

- Deleted `/api/debug`, `/api/test-db` and `/api/make-me-admin`.
- The leads webhook has no fallback secret and fails closed.
- `src/lib/authz.ts` holds the shared checks: PM reaches every project; a developer reads only projects where they hold a task; a client reaches only their own project; Sales, Content Editor and Super Admin have no project or task access.
- Session, role and ownership checks on `getProjectForLead`, `getProjectProgress`, `submitTaskForVerification`, `getLatestTaskSubmission`, `polishDeliveryNotes`, `getTaskAuditReport`, `getClientUsers`, `addProjectDocument`, `deleteProjectDocument` and `addClientLeadDocument`.
- `/api/private-file` always needs a `projectId`, a caller who can read that project, a file that belongs to it, and only sends the storage token to Vercel Blob.
- `logAction` and the notification helpers are in server-only modules, so a browser cannot write audit rows or send notifications. `syncProjectStatus` is no longer exported.
- CRM task and inquiry actions write audit rows and validate their input.

Still open:

- Super Admin is still allowed in the CRM task and inquiry actions until the monitor-only change (B3).
- `getProjectForLead` still returns the project `id` to Sales. The spec says Sales sees "Project created" as text only, which needs a `LeadDetailsDrawer` change.
- Developer project access follows `task_assignee` until the project team feature exists.
- Project documents and task proofs are uploaded to Vercel Blob with `access: "public"`, so `/api/private-file` is not a real secrecy boundary for those URLs. Moving to private blobs is a separate change.
- Local uploads (`public/uploads`) are served as static files and bypass `/api/private-file`.
- `reportClientError` is public by design and has no rate limit.
- The email helpers in `src/lib/notifications.ts` are not marked `server-only`.
- `tests/test-quality-gate.ts` is out of `test:capstone` until Step C deletes the quality gate.
