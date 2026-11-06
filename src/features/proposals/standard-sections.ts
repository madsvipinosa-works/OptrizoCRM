/**
 * The standard sections that appear in every proposal (mockup 14c-ref "Standard sections").
 * Read-only in the editor: the same text goes to every client. To change wording for one client, use
 * "Edit terms" on the proposal. Lasting changes belong in the proposal template.
 */
export type StandardSection = {
    key: "about" | "how_we_work" | "project_team" | "terms" | "next_steps";
    title: string;
    /** Paragraphs and bullet lines. A line that starts with "- " is shown as a bullet. */
    lines: string[];
};

export const STANDARD_SECTIONS: StandardSection[] = [
    {
        key: "about",
        title: "About us",
        lines: [
            "Optrizo Digital Solutions builds custom web and mobile software for local and international businesses, from requirements and design through development, testing, and support.",
        ],
    },
    {
        key: "how_we_work",
        title: "How we work",
        lines: [
            "- Method: sprints of two weeks, each ending with a demo; you approve each milestone before the next starts.",
            "- Progress: you follow milestones and progress in the Optrizo client portal.",
            "- Technology: final choices are confirmed in Requirements.",
        ],
    },
    {
        key: "project_team",
        title: "Project team",
        lines: [
            "- Project Manager: your main contact; plans, reviews, and reports progress.",
            "- Developers: build the software.",
            "- QA tester: tests each release and supports UAT.",
        ],
    },
    {
        key: "terms",
        title: "Terms and conditions",
        lines: [
            "- Confidentiality: both parties keep all project information confidential.",
            "- Changes to scope: quoted separately and agreed in writing.",
            "- Ownership: after full payment, the client owns the software, source code, and documentation.",
            "- Warranty: 3 months after the final completion sign-off; defects fixed at no charge.",
            "- Termination: 30 days written notice; completed work is paid.",
            "- Liability: limited to the total amount paid.",
        ],
    },
    {
        key: "next_steps",
        title: "Next steps",
        lines: [
            "- Review this proposal and ask for changes if needed.",
            "- Sign online in the portal, or sign a printed copy and return it to your Project Manager.",
            "- After signing, the project starts with Requirements on the first milestone date.",
        ],
    },
];
