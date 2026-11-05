BEGIN;

-- 1. Create content_status enum idempotently
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'content_status') THEN
    CREATE TYPE content_status AS ENUM ('draft', 'published', 'hidden');
  END IF;
END $$;

-- 2. Alter service table and run guarded one-time backfill
DO $$
DECLARE
  v_service_status_added boolean := false;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'service' AND column_name = 'status'
  ) THEN
    ALTER TABLE service ADD COLUMN status content_status NOT NULL DEFAULT 'draft';
    v_service_status_added := true;
  END IF;

  ALTER TABLE service ADD COLUMN IF NOT EXISTS is_preset boolean NOT NULL DEFAULT false;
  ALTER TABLE service ADD COLUMN IF NOT EXISTS show_on_services_page boolean NOT NULL DEFAULT true;
  ALTER TABLE service ADD COLUMN IF NOT EXISTS show_in_inquiry boolean NOT NULL DEFAULT true;
  ALTER TABLE service ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();
  ALTER TABLE service ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
  ALTER TABLE service ADD COLUMN IF NOT EXISTS published_at timestamptz;

  IF v_service_status_added THEN
    -- Existing rows become published so nothing vanishes from the public site.
    -- Legacy descriptions (83-113 chars) are NOT truncated; zod limits apply on next save.
    UPDATE service
    SET status = 'published',
        show_on_services_page = true,
        show_in_inquiry = true,
        published_at = COALESCE(published_at, now()),
        updated_at = now();

    -- Mark the 6 preset services by case-insensitive trimmed title
    UPDATE service
    SET is_preset = true
    WHERE lower(btrim(title)) IN (
      'web development',
      'mobile app',
      'ui/ux design',
      'e-commerce website',
      'custom business system',
      'website maintenance'
    );

    -- Guarded preset seed (all 6 already exist in live DB, so WHERE NOT EXISTS inserts 0 rows)
    INSERT INTO service (id, title, description, slug, "order", status, is_preset, show_on_services_page, show_in_inquiry, published_at)
    SELECT gen_random_uuid()::text, v.title, v.description, v.slug, v.ord, 'published'::content_status, true, true, true, now()
    FROM (VALUES
      ('Web Development', 'Websites and web apps built for your business.', 'web-development', 1),
      ('Mobile App', 'iOS and Android apps for your customers or team.', 'mobile-app', 2),
      ('UI/UX Design', 'Research, wireframes, and interface design.', 'ui-ux-design', 3),
      ('E-commerce Website', 'Online stores with payments and order management.', 'e-commerce-website', 4),
      ('Custom Business System', 'CRM, inventory and internal business systems.', 'custom-business-system', 5),
      ('Website Maintenance', 'Updates, fixes and backups for existing sites.', 'website-maintenance', 6)
    ) AS v(title, description, slug, ord)
    WHERE NOT EXISTS (
      SELECT 1 FROM service s WHERE lower(btrim(s.title)) = lower(v.title)
    );

    -- Fill NULL or empty slugs from title before creating unique index
    UPDATE service
    SET slug = regexp_replace(lower(btrim(title)), '[^a-z0-9]+', '-', 'g')
    WHERE slug IS NULL OR btrim(slug) = '';

    UPDATE service
    SET slug = regexp_replace(slug, '(^-+|-+$)', '', 'g')
    WHERE slug IS NOT NULL;

    -- Deduplicate any colliding slugs by appending -2, -3, ...
    WITH ranked AS (
      SELECT id, slug,
             row_number() OVER (PARTITION BY slug ORDER BY "order" NULLS LAST, id) AS rn
      FROM service
      WHERE slug IS NOT NULL
    )
    UPDATE service s
    SET slug = ranked.slug || '-' || ranked.rn
    FROM ranked
    WHERE s.id = ranked.id AND ranked.rn > 1;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS service_slug_unique ON service (slug) WHERE slug IS NOT NULL;

-- 3. Alter case_study table and run guarded one-time backfill
DO $$
DECLARE
  v_case_study_status_added boolean := false;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'case_study' AND column_name = 'status'
  ) THEN
    ALTER TABLE case_study ADD COLUMN status content_status NOT NULL DEFAULT 'draft';
    v_case_study_status_added := true;
  END IF;

  ALTER TABLE case_study ADD COLUMN IF NOT EXISTS service_id text REFERENCES service(id) ON DELETE SET NULL;
  ALTER TABLE case_study ADD COLUMN IF NOT EXISTS client_display_name text;
  ALTER TABLE case_study ADD COLUMN IF NOT EXISTS client_consent boolean NOT NULL DEFAULT false;
  ALTER TABLE case_study ADD COLUMN IF NOT EXISTS summary text;
  ALTER TABLE case_study ADD COLUMN IF NOT EXISTS live_url text;
  ALTER TABLE case_study ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0;
  ALTER TABLE case_study ADD COLUMN IF NOT EXISTS published_at timestamptz;
  ALTER TABLE case_study ADD COLUMN IF NOT EXISTS updated_by text REFERENCES "user"(id) ON DELETE SET NULL;

  IF v_case_study_status_added THEN
    -- Real client name stays in private "clientName". Public display defaults to 'Confidential client'
    -- until client_consent is ticked by Content Editor. Do not truncate legacy description when copying to summary.
    UPDATE case_study
    SET status = CASE WHEN published THEN 'published'::content_status ELSE 'draft'::content_status END,
        summary = COALESCE(description, ''),
        sort_order = CASE WHEN "order" ~ '^-?[0-9]+$' THEN ("order")::integer ELSE 0 END,
        client_consent = false,
        client_display_name = 'Confidential client',
        published_at = CASE WHEN published THEN COALESCE(created_at, now()) ELSE NULL END;
  END IF;
END $$;

-- 4. Create pages and page_version tables with RLS enabled
CREATE TABLE IF NOT EXISTS pages (
  slug text PRIMARY KEY CHECK (slug IN ('home', 'about', 'contact')),
  fields jsonb NOT NULL DEFAULT '{}'::jsonb,
  draft_fields jsonb,
  status content_status NOT NULL DEFAULT 'draft',
  version integer NOT NULL DEFAULT 0,
  published_at timestamptz,
  published_by text REFERENCES "user"(id) ON DELETE SET NULL,
  draft_updated_at timestamptz,
  draft_updated_by text REFERENCES "user"(id) ON DELETE SET NULL
);

ALTER TABLE pages ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS page_version (
  id text PRIMARY KEY,
  page_slug text NOT NULL REFERENCES pages(slug) ON DELETE CASCADE,
  version_no integer NOT NULL,
  fields jsonb NOT NULL,
  action text NOT NULL CHECK (action IN ('publish', 'restore')),
  restored_from integer,
  created_by text REFERENCES "user"(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT page_version_slug_version_unique UNIQUE (page_slug, version_no)
);

ALTER TABLE page_version ENABLE ROW LEVEL SECURITY;

-- 5. Seed initial published pages ('home', 'about', 'contact') and version 1 snapshots idempotently

-- Home page
INSERT INTO pages (slug, fields, draft_fields, status, version, published_at)
VALUES (
  'home',
  jsonb_build_object(
    'heading', COALESCE((SELECT NULLIF(btrim("heroTitle"), '') FROM site_settings WHERE id = 'singleton_root'), $txt$OPTRIZO // CUSTOM SOLUTIONS$txt$),
    'intro', COALESCE((SELECT NULLIF(btrim("heroDescription"), '') FROM site_settings WHERE id = 'singleton_root'), $txt$We engineer bespoke web platforms, enterprise software, and scalable digital infrastructure through modern architecture.$txt$),
    'mainImageUrl', '',
    'featuredServiceIds', COALESCE(
      (
        SELECT jsonb_agg(s.id)
        FROM (
          SELECT id
          FROM service
          WHERE status = 'published'
          ORDER BY is_featured DESC, "order" ASC NULLS LAST, id ASC
          LIMIT 3
        ) s
      ),
      '[]'::jsonb
    ),
    'featuredPortfolioIds', COALESCE(
      (
        SELECT jsonb_agg(c.id)
        FROM (
          SELECT id
          FROM case_study
          WHERE status = 'published'
          ORDER BY sort_order ASC, created_at DESC, id ASC
          LIMIT 3
        ) c
      ),
      '[]'::jsonb
    )
  ),
  NULL,
  'published',
  1,
  now()
)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO page_version (id, page_slug, version_no, fields, action, restored_from, created_by, created_at)
SELECT gen_random_uuid()::text, p.slug, 1, p.fields, 'publish', NULL, NULL, COALESCE(p.published_at, now())
FROM pages p
WHERE p.slug = 'home'
ON CONFLICT (page_slug, version_no) DO NOTHING;

-- About page
-- site_settings."aboutText" holds HTML (<p>...</p>); strip tags, decode entities, collapse whitespace (plain text only).
-- team takes all users WHERE show_on_about_page AND is_active AND deleted_at IS NULL as-is (no dedupe or role filtering).
DO $about$
DECLARE
  v_story text;
BEGIN
  SELECT COALESCE("aboutText", '') INTO v_story
  FROM site_settings
  WHERE id = 'singleton_root';

  v_story := COALESCE(v_story, '');
  -- 1. strip HTML tags
  v_story := regexp_replace(v_story, $re$<[^>]*>$re$, ' ', 'g');
  -- 2. decode common entities (quote characters via chr() to avoid quoting problems)
  v_story := replace(v_story, '&nbsp;', ' ');
  v_story := replace(v_story, '&quot;', chr(34));
  v_story := replace(v_story, '&#39;', chr(39));
  v_story := replace(v_story, '&apos;', chr(39));
  v_story := replace(v_story, '&lt;', '<');
  v_story := replace(v_story, '&gt;', '>');
  v_story := replace(v_story, '&amp;', '&');
  -- 3. collapse whitespace and trim
  v_story := btrim(regexp_replace(v_story, $re$\s+$re$, ' ', 'g'));

INSERT INTO pages (slug, fields, draft_fields, status, version, published_at)
VALUES (
  'about',
  jsonb_build_object(
    'heading', COALESCE((SELECT NULLIF(btrim(about_hero_title), '') FROM site_settings WHERE id = 'singleton_root'), $txt$About Our Agency$txt$),
    'story', v_story,
    'mission', COALESCE((SELECT NULLIF(btrim(mission_statement), '') FROM site_settings WHERE id = 'singleton_root'), $txt$Optrizo is a full-service software studio. We combine modern technical architecture, high-converting UX design, and robust project workflows to transform ambitious ideas into enterprise digital assets.$txt$),
    'vision', '',
    'howWeWork', '',
    'team', COALESCE(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'name', COALESCE(u.name, ''),
            'jobTitle', COALESCE(u.job_title, ''),
            'photoUrl', COALESCE(u.image, '')
          )
          ORDER BY u.name NULLS LAST, u.id
        )
        FROM "user" u
        WHERE u.show_on_about_page = true
          AND u.is_active = true
          AND u.deleted_at IS NULL
      ),
      '[]'::jsonb
    )
  ),
  NULL,
  'published',
  1,
  now()
)
ON CONFLICT (slug) DO NOTHING;
END
$about$;

INSERT INTO page_version (id, page_slug, version_no, fields, action, restored_from, created_by, created_at)
SELECT gen_random_uuid()::text, p.slug, 1, p.fields, 'publish', NULL, NULL, COALESCE(p.published_at, now())
FROM pages p
WHERE p.slug = 'about'
ON CONFLICT (page_slug, version_no) DO NOTHING;

-- Contact page
INSERT INTO pages (slug, fields, draft_fields, status, version, published_at)
VALUES (
  'contact',
  jsonb_build_object(
    'heading', $txt$Let's Build Something Great$txt$,
    'intro', $txt$We'd love to hear from you. Please fill out this form or reach out through our direct engineering channels.$txt$,
    'email', COALESCE((SELECT NULLIF(btrim("contactEmail"), '') FROM site_settings WHERE id = 'singleton_root'), $txt$hello@optrizo.com$txt$),
    'phone', $txt$+1 (555) 123-4567$txt$,
    'address', $txt$123 Innovation Drive, Tech Valley, CA 94043$txt$,
    'officeHours', $txt$Mon - Fri from 9am to 6pm PST$txt$
  ),
  NULL,
  'published',
  1,
  now()
)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO page_version (id, page_slug, version_no, fields, action, restored_from, created_by, created_at)
SELECT gen_random_uuid()::text, p.slug, 1, p.fields, 'publish', NULL, NULL, COALESCE(p.published_at, now())
FROM pages p
WHERE p.slug = 'contact'
ON CONFLICT (page_slug, version_no) DO NOTHING;

COMMIT;

