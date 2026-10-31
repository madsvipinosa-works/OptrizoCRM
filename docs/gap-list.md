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
