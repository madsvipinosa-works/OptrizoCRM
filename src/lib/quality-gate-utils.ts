export type TaskCategory =
  | "ENGINEERING"
  | "DESIGN"
  | "MARKETING_CONTENT"
  | "GENERAL_DOCS";

export function classifyTaskCategory(
  title: string,
  description: string | null
): TaskCategory {
  const text = `${title} ${description || ""}`.toLowerCase();

  if (
    /(marketing|social media|facebook|reddit|instagram|tiktok|campaign|reels?|tweets?|\bposts?\b|newsletter|advertising)/i.test(
      text
    )
  ) {
    return "MARKETING_CONTENT";
  }

  if (
    /(figma|wireframe|mockup|prototype|brand identity|logo|typography|palette)/i.test(
      text
    ) ||
    (/(design|banner|graphic|layout)/i.test(title) && !/(backend|api|database|sql|migration|server|route)/i.test(title))
  ) {
    return "DESIGN";
  }

  if (
    /(api|backend|frontend|auth|database|endpoint|component|crud|test|deploy|bug|fix|code|query|schema|drizzle|postgres|react|nextjs|route|service|migration|oauth)/i.test(
      text
    )
  ) {
    return "ENGINEERING";
  }

  if (
    /(design|banner|graphic|layout|\bui\b|\bux\b)/i.test(
      text
    )
  ) {
    return "DESIGN";
  }

  return "GENERAL_DOCS";
}

export const SHORT_FORM_VIDEO_PATTERNS = [
  { host: /(^|\.)youtube\.com$/, path: /^\/shorts(\/.*)?$/i, label: "YouTube Shorts" },
  { host: /^youtu\.be$/, path: /^\/shorts(\/.*)?$/i, label: "YouTube Shorts" },
  { host: /(^|\.)tiktok\.com$/, path: /.*/, label: "TikTok" },
  { host: /(^|\.)instagram\.com$/, path: /^\/(reels?|stories)(\/.*)?$/i, label: "Instagram Reels/Stories" },
  { host: /(^|\.)(facebook|fb)\.com$/, path: /^\/(reel|reels|watch)(\/.*)?$/i, label: "Facebook Reel/Watch" },
  { host: /^fb\.watch$/, path: /.*/, label: "Facebook Watch" },
  { host: /(^|\.)snapchat\.com$/, path: /^\/spotlight(\/.*)?$/i, label: "Snapchat Spotlight" },
];

export const DISALLOWED_ENTERTAINMENT_DOMAINS = [
  "facebook.com",
  "fb.com",
  "instagram.com",
  "tiktok.com",
  "reddit.com",
  "twitter.com",
  "x.com",
  "twitch.tv",
  "netflix.com",
  "hulu.com",
  "disneyplus.com",
  "max.com",
  "primevideo.com",
  "9gag.com",
  "pinterest.com",
  "spotify.com",
  "soundcloud.com",
  "music.youtube.com",
  "music.apple.com",
  "pandora.com",
  "snapchat.com",
  "discord.com",
  "discord.gg",
  "threads.net",
  "tumblr.com",
  "steampowered.com",
  "epicgames.com",
  "roblox.com",
];

export const VERIFIED_CODE_HOSTS = [
  "github.com",
  "gitlab.com",
  "bitbucket.org",
  "dev.azure.com",
  "gist.github.com",
  "codesandbox.io",
  "stackblitz.com",
  "replit.com",
  "codepen.io",
];

export const VERIFIED_STAGING_HOST_PATTERNS = [
  /\.vercel\.app$/,
  /\.netlify\.app$/,
  /\.pages\.dev$/,
  /\.ngrok-free\.app$/,
  /\.ngrok\.app$/,
  /\.ngrok\.io$/,
  /\.onrender\.com$/,
  /\.render\.com$/,
  /\.fly\.dev$/,
  /\.railway\.app$/,
  /\.supabase\.co$/,
  /\.supabase\.in$/,
  /\.herokuapp\.com$/,
  /\.amplifyapp\.com$/,
  /\.web\.app$/,
  /\.firebaseapp\.com$/,
  /\.azurewebsites\.net$/,
  /\.cloudfunctions\.net$/,
  /^localhost$/,
  /^127\.0\.0\.1$/,
];

export const VERIFIED_DESIGN_HOSTS = [
  "figma.com",
  "canva.com",
  "adobe.com",
  "xd.adobe.com",
  "dribbble.com",
  "behance.net",
  "framer.com",
  "framer.app",
  "miro.com",
  "invisionapp.com",
  "zeplin.io",
];

export const VERIFIED_WALKTHROUGH_HOSTS = [
  "loom.com",
  "vimeo.com",
  "tango.us",
  "supademo.com",
  "screenpal.com",
];

export const VERIFIED_DOCS_MANAGEMENT_HOSTS = [
  "docs.google.com",
  "drive.google.com",
  "sheets.google.com",
  "notion.so",
  "notion.site",
  "coda.io",
  "linear.app",
  "clickup.com",
  "trello.com",
  "asana.com",
  "atlassian.net",
  "jira.com",
  "confluence.com",
  "postman.com",
  "swagger.io",
  "gitbook.io",
  "gitbook.com",
];

export function isGibberishOrNonInformative(text: string): boolean {
  const cleaned = text.trim().toLowerCase();
  if (cleaned.length < 3) return true;

  const placeholders = new Set([
    "test",
    "testing",
    "asdf",
    "asdasd",
    "qwerty",
    "temp",
    "foo",
    "bar",
    "baz",
    "none",
    "sample",
    "dummy",
    "placeholder",
    "xxx",
    "abc",
    "fsdf",
  ]);
  if (placeholders.has(cleaned)) return true;

  // Words with 4+ consonants and NO vowels (e.g. "fsdfsdfs", "ghjkl", "bcdfgh")
  const hasVowels = /[aeiouy]/i.test(cleaned);
  if (!hasVowels && cleaned.length >= 4) return true;

  // Repetitive character patterns (e.g. "fsdfsdfs" -> "fsdf" repeated, "asdasd" -> "asd" repeated)
  const isRepetitive = /^(.{1,4})\1+$/.test(cleaned);
  if (isRepetitive && cleaned.length >= 6) return true;

  return false;
}

export function validateArtifactRelevance(
  proofUrl: string,
  category: TaskCategory,
  taskTitle: string,
  taskDescription: string | null
): {
  isValid: boolean;
  isSpecificDeepLink: boolean;
  status: "PASS" | "FAIL" | "PARTIAL";
  reason: string;
} {
  try {
    const parsedUrl = new URL(proofUrl);
    const hostname = parsedUrl.hostname.toLowerCase().replace(/^www\./, "");
    const pathname = parsedUrl.pathname.trim();
    const taskText = `${taskTitle} ${taskDescription || ""}`.toLowerCase();

    // Check 1: Deep Link Specificity (Reject bare root homepages like https://github.com or https://figma.com)
    const isLocalhost = hostname === "localhost" || hostname === "127.0.0.1";
    const isRootDomainOnly = pathname === "" || pathname === "/";
    if (isRootDomainOnly && !isLocalhost) {
      return {
        isValid: false,
        isSpecificDeepLink: false,
        status: "FAIL",
        reason: `The submitted URL (${hostname}) is a top-level homepage without an artifact path or identifier. Please provide a direct link to the PR, file, or deployment.`,
      };
    }

    // Check 2: Consumer Short-Form Video (YouTube Shorts, TikTok, Reels)
    const shortFormMatch = SHORT_FORM_VIDEO_PATTERNS.find(
      (p) => p.host.test(hostname) && p.path.test(pathname)
    );

    if (shortFormMatch) {
      const isExplicitShortsMarketing =
        category === "MARKETING_CONTENT" &&
        /(short-form|shorts|tiktok|reels?|social media reel|promotional video clip)/i.test(
          taskText
        );

      if (!isExplicitShortsMarketing) {
        return {
          isValid: false,
          isSpecificDeepLink: true,
          status: "FAIL",
          reason: `The submitted URL is a ${shortFormMatch.label} vertical clip (${proofUrl}), which is an entertainment format and cannot be accepted as a technical or design work deliverable. Please provide an authentic work artifact (e.g. GitHub PR, Vercel/staging preview, Figma file, or Loom video).`,
        };
      } else {
        return {
          isValid: true,
          isSpecificDeepLink: true,
          status: "PASS",
          reason: `Verified ${shortFormMatch.label} marketing campaign deliverable.`,
        };
      }
    }

    // Check 3: Consumer Social Media & Entertainment Blacklist
    const isEntertainmentOrSocial = DISALLOWED_ENTERTAINMENT_DOMAINS.some(
      (d) => hostname === d || hostname.endsWith(`.${d}`)
    );

    if (isEntertainmentOrSocial) {
      const isExplicitMarketing =
        category === "MARKETING_CONTENT" ||
        /(marketing|social media|post|campaign|reel|reddit|facebook|tiktok|instagram|twitter|discord)/i.test(
          taskText
        );

      if (!isExplicitMarketing) {
        return {
          isValid: false,
          isSpecificDeepLink: true,
          status: "FAIL",
          reason: `The submitted URL (${hostname}) is a consumer social media or entertainment link, which is not an authoritative deliverable for a ${category.toLowerCase().replace("_", " ")} task. Please provide an authentic work artifact (e.g. GitHub PR, Vercel/staging preview, Figma file, or Loom video).`,
        };
      } else {
        return {
          isValid: true,
          isSpecificDeepLink: true,
          status: "PASS",
          reason: `Verified promotional / social media campaign deliverable on ${hostname}.`,
        };
      }
    }

    // Check 4: Standard Longform YouTube (youtube.com/watch?v=... or youtu.be/<id>)
    const isYouTubeStandard =
      hostname === "youtube.com" ||
      hostname === "m.youtube.com" ||
      hostname === "youtu.be";

    if (isYouTubeStandard) {
      if (category === "MARKETING_CONTENT") {
        return {
          isValid: true,
          isSpecificDeepLink: true,
          status: "PASS",
          reason: `Valid promotional video deliverable provided on ${hostname}.`,
        };
      }
      return {
        isValid: true,
        isSpecificDeepLink: true,
        status: "PARTIAL",
        reason: `YouTube video provided as a walkthrough. Technical tasks require code (GitHub PR) or a live staging deployment for full verification.`,
      };
    }

    // Check 5: Authoritative Work Platforms (Allowlist)
    const isVerifiedCode = VERIFIED_CODE_HOSTS.some(
      (d) => hostname === d || hostname.endsWith(`.${d}`)
    );
    if (isVerifiedCode) {
      return {
        isValid: true,
        isSpecificDeepLink: true,
        status: "PASS",
        reason: `Authoritative code repository / pull request deliverable verified on ${hostname}.`,
      };
    }

    const isVerifiedStaging = VERIFIED_STAGING_HOST_PATTERNS.some((p) =>
      p.test(hostname)
    );
    if (isVerifiedStaging) {
      return {
        isValid: true,
        isSpecificDeepLink: true,
        status: "PASS",
        reason: `Authoritative staging / cloud deployment deliverable verified on ${hostname}.`,
      };
    }

    const isVerifiedDesign = VERIFIED_DESIGN_HOSTS.some(
      (d) => hostname === d || hostname.endsWith(`.${d}`)
    );
    if (isVerifiedDesign) {
      return {
        isValid: true,
        isSpecificDeepLink: true,
        status: "PASS",
        reason: `Authoritative design / prototype deliverable verified on ${hostname}.`,
      };
    }

    const isVerifiedWalkthrough = VERIFIED_WALKTHROUGH_HOSTS.some(
      (d) => hostname === d || hostname.endsWith(`.${d}`)
    );
    if (isVerifiedWalkthrough) {
      return {
        isValid: true,
        isSpecificDeepLink: true,
        status: "PASS",
        reason: `Authoritative video walkthrough deliverable verified on ${hostname}.`,
      };
    }

    const isVerifiedDocs = VERIFIED_DOCS_MANAGEMENT_HOSTS.some(
      (d) => hostname === d || hostname.endsWith(`.${d}`)
    );
    if (isVerifiedDocs) {
      return {
        isValid: true,
        isSpecificDeepLink: true,
        status: "PASS",
        reason: `Authoritative project documentation / specification deliverable verified on ${hostname}.`,
      };
    }

    // Check 6: Custom / Unverified Third-Party Domain
    return {
      isValid: true,
      isSpecificDeepLink: true,
      status: "PARTIAL",
      reason: `The submitted URL is hosted on an unverified or custom domain (${hostname}). Ensure manual reviewer verification for this deployment artifact.`,
    };
  } catch {
    return {
      isValid: false,
      isSpecificDeepLink: false,
      status: "FAIL",
      reason: "Invalid URL format provided.",
    };
  }
}
