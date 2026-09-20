export interface PlaybookTaskTemplate {
    id?: string;
    title: string;
    description?: string;
    taskType: "Call" | "Email" | "Meeting" | "To-do";
    priority: "Low" | "Medium" | "High";
    dueHours: number; // offset from creation in hours
}

export interface CrmPlaybookConfig {
    defaultAssignmentStrategy: "round-robin" | "unassigned";
    defaultTasks: PlaybookTaskTemplate[];
    applyToConvertedInquiries: boolean;
}

export const DEFAULT_CRM_PLAYBOOK: CrmPlaybookConfig = {
    defaultAssignmentStrategy: "round-robin",
    applyToConvertedInquiries: true,
    defaultTasks: [
        {
            title: "Initial Discovery Call",
            description: "Reach out to qualify budget, requirements, and timeline.",
            taskType: "Call",
            priority: "High",
            dueHours: 24, // +24 hours
        },
        {
            title: "Send Tailored Scope & Proposal",
            description: "Prepare and send tailored scope and proposal contract.",
            taskType: "Email",
            priority: "Medium",
            dueHours: 72, // +72 hours
        },
    ],
};
