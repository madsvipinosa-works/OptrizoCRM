export interface ServiceDefaultMetadata {
    inclusions: string[];
    deliverables: string[];
    scopeOverview: string;
    timelineEstimate: string;
    targetAudience: string;
}

export const SERVICE_METADATA_PRESETS: Record<string, ServiceDefaultMetadata> = {
    "Custom Web Applications": {
        timelineEstimate: "3-6 Weeks",
        targetAudience: "Startups, Scale-ups & Modern Enterprises",
        scopeOverview: "End-to-end fullstack engineering from architecture design to production release. We construct high-concurrency web platforms using Next.js App Router, TypeScript, resilient API layers, and scalable cloud databases with zero-downtime CI/CD pipelines.",
        inclusions: [
            "Technical discovery & system architecture blueprint",
            "Next.js App Router & React server components frontend",
            "Relational database design (PostgreSQL) & Drizzle/Prisma ORM",
            "Enterprise authentication (OAuth, magic links, session management)",
            "Role-based access control (RBAC) & security boundary auditing",
            "Accessible, responsive cyber-minimalist UI components (WCAG AAA)",
            "API integrations (payment gateways, CRM, third-party webhooks)",
            "Automated test suites (unit, integration & E2E checks)",
            "Continuous deployment automation via Vercel or cloud provider",
            "30-day post-launch warranty, bugfix support & telemetry monitoring",
        ],
        deliverables: [
            "Production-ready Git source code repository",
            "Complete system architecture and API documentation",
            "Figma component library and design token export",
            "DevOps infrastructure configuration & deployment runbook",
        ],
    },
    "Cloud & Scalable Infrastructure": {
        timelineEstimate: "2-4 Weeks",
        targetAudience: "Tech Leaders, CTOs & High-Traffic Platforms",
        scopeOverview: "Architecting enterprise-grade cloud ecosystems designed for maximum uptime, high throughput, and automated elasticity. We eliminate infrastructure bottlenecks, enforce zero-trust security postures, and cut cloud expenses through proactive optimization.",
        inclusions: [
            "Infrastructure audit & cloud readiness assessment",
            "Infrastructure as Code (Terraform / OpenTofu / Pulumi)",
            "Kubernetes / Docker container orchestration & auto-scaling",
            "Multi-region failover, automated snapshots & disaster recovery",
            "Automated CI/CD build and delivery pipelines",
            "Zero-trust network configuration, VPC peering & WAF security",
            "Real-time monitoring, metrics dashboards & alerting (Prometheus/Datadog)",
            "Cost optimization audit & cloud resource rightsizing",
        ],
        deliverables: [
            "Terraform / IaC modular infrastructure code",
            "CI/CD workflow definitions and build runners",
            "Observability dashboards and alert runbooks",
            "Disaster recovery & business continuity procedure document",
        ],
    },
    "UI/UX Design & Brand Systems": {
        timelineEstimate: "2-4 Weeks",
        targetAudience: "Founders, Product Teams & Rebranding Enterprises",
        scopeOverview: "Transforming complex workflows into intuitive, conversion-focused user interfaces and scalable design systems. We engineer digital product experiences that captivate users, elevate brand authority, and accelerate engineering velocity through codified design tokens.",
        inclusions: [
            "Stakeholder interviews & competitive product analysis",
            "User journey mapping, wireframing & information architecture",
            "High-fidelity interactive Figma prototypes with tactile micro-interactions",
            "Comprehensive cyber-minimalist design system with reusable components",
            "Color palette, typography scale & responsive grid rules",
            "Dark / light mode contrast validation & WCAG AAA compliance",
            "Engineering-ready developer handoff specifications",
        ],
        deliverables: [
            "Complete Figma organization file with editable components and variants",
            "Design tokens exported as CSS variables / Tailwind tokens",
            "Brand identity guidelines & usage manual",
            "Interactive clickable prototype for investor and user testing",
        ],
    },
    "Mobile App Engineering": {
        timelineEstimate: "4-8 Weeks",
        targetAudience: "B2C Consumer Brands, Field Operations & B2B SaaS",
        scopeOverview: "Engineering fluid, native-feel mobile applications for iOS and Android. Built with cross-platform frameworks or modern native stacks, our mobile solutions feature offline-first capabilities, real-time data sync, and delightful haptic interactions.",
        inclusions: [
            "Mobile product roadmap & technical feasibility audit",
            "Cross-platform or native application engineering (React Native / iOS / Android)",
            "Offline-first local caching and seamless background synchronization",
            "Biometric authentication (FaceID, TouchID, Secure Enclave)",
            "Push notification infrastructure & deep link routing",
            "In-app subscriptions / payment gateway integration",
            "App Store & Google Play Store submission management and compliance",
            "Crash analytics, performance monitoring & error telemetry setup",
        ],
        deliverables: [
            "Production mobile application source code",
            "App Store and Google Play distribution build artifacts",
            "Mobile API client documentation",
            "App store assets, screenshots, and release metadata package",
        ],
    },
    "General": {
        timelineEstimate: "2-4 Weeks",
        targetAudience: "Ambitious Teams Seeking Category-Defining Products",
        scopeOverview: "Dedicated digital product engineering and architectural advisory. We partner directly with your leadership team to scope, architect, and ship mission-critical software solutions with high velocity and enterprise craftsmanship.",
        inclusions: [
            "Dedicated staff engineer & architecture discovery sessions",
            "2-week rapid sprint cycles with live staging environments",
            "Clean, maintainable, fully typed codebase adhering to best practices",
            "Direct Slack/Discord channel with the lead architect",
            "Automated test coverage & security validation",
            "Comprehensive knowledge transfer & engineering onboarding",
        ],
        deliverables: [
            "Fully verified, production-ready codebase",
            "Technical architecture and system overview documentation",
            "Deployment and maintenance guides",
        ],
    },
};

export function getServiceMetadataDefaults(title?: string, category?: string): ServiceDefaultMetadata {
    const cleanTitle = (title || "").toLowerCase();
    const cleanCategory = (category || "").toLowerCase();

    if (cleanTitle.includes("web") || cleanCategory.includes("web") || cleanTitle.includes("fullstack") || cleanCategory.includes("architecture")) {
        return SERVICE_METADATA_PRESETS["Custom Web Applications"];
    }
    if (cleanTitle.includes("cloud") || cleanTitle.includes("devops") || cleanCategory.includes("devops") || cleanTitle.includes("infrastructure")) {
        return SERVICE_METADATA_PRESETS["Cloud & Scalable Infrastructure"];
    }
    if (cleanTitle.includes("design") || cleanTitle.includes("ui") || cleanTitle.includes("ux") || cleanCategory.includes("design")) {
        return SERVICE_METADATA_PRESETS["UI/UX Design & Brand Systems"];
    }
    if (cleanTitle.includes("mobile") || cleanTitle.includes("app") || cleanCategory.includes("mobile")) {
        return SERVICE_METADATA_PRESETS["Mobile App Engineering"];
    }

    return SERVICE_METADATA_PRESETS["General"];
}
