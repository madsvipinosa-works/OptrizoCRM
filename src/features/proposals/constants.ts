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


/** When a payment falls due, with the words shown to the PM and in the proposal document. */
export const PAYMENT_TRIGGERS: Array<[value: string, label: string]> = [
    ["on_signing", "On signing"],
    ["requirements", "Requirements done"],
    ["design", "Design done"],
    ["development", "Development done"],
    ["uat_testing", "UAT and testing done"],
    ["handover", "Handover"],
    ["before_completion", "Before completion"],
];
