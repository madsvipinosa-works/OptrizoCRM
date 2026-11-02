export const DEFAULT_PROPOSAL_MILESTONES = [
    {
        name: "requirements" as const,
        key: "requirements",
        title: "Requirements & Architecture",
        description: "Confirm features, user stories, acceptance criteria",
    },
    {
        name: "design" as const,
        key: "design",
        title: "UI/UX Design & Prototyping",
        description: "Wireframes and screen designs for approval",
    },
    {
        name: "development" as const,
        key: "development",
        title: "Full-Stack Development",
        description: "Built in two-week sprints with a demo after each",
    },
    {
        name: "uat_testing" as const,
        key: "uat_testing",
        title: "QA & UAT Testing",
        description:
            "Internal QA verification followed by end-to-end client user acceptance testing",
    },
    {
        name: "handover" as const,
        key: "handover",
        title: "Final Handover & Deployment",
        description:
            "Production release, warranty period activation, and formal sign-off",
    },
] as const;

