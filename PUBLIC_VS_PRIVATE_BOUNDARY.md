## Public vs Private Data Boundary (Optrizo)

### Data Classes
1. Public CMS Data
   - Blog content, services, portfolio/case-study media that is intended for public web visitors.
2. CRM Private Data
   - Leads, internal notes, assignment/operational workflow data.
3. Confidential/Client Assets
   - Proposal documents, client-uploaded revision/supporting files, and other artifacts that must not be accessible to the general public.

### Implementation Boundary (current system behavior)
- Client-facing confidential assets are delivered through an authenticated proxy route:
  - `GET /api/private-file?blobUrl=...` or `GET /api/private-file?local=...`
  - The route requires an authenticated session.
- Uploads are stored as **private Vercel Blob objects** going forward:
  - New uploads use `@vercel/blob` with private access.
  - The stored reference returned to the application is the authenticated download route URL.
- Local/dev fallback is stored outside the `public/` folder:
  - Files are saved under `.private-uploads/` and served only via the authenticated proxy route.

### What this prevents
- Prevents confidential documents from being directly accessible via publicly reachable stored URLs.

### Operational note / migration consideration
- Any previously stored public blob URLs or `public/uploads` files may still be publicly reachable until migrated.
- A migration script/one-time re-upload strategy is recommended if you need full historical containment.

