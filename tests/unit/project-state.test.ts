import { describe, expect, it } from "vitest";
import { projectState } from "@/features/pm/project-state";

const now = new Date("2026-11-08T10:00:00+08:00");
const ms = [
    { title: "Requirements", status: "Completed", order: 1 },
    { title: "Design", status: "In Progress", order: 2 },
    { title: "Development", status: "Pending", order: 3 },
];

describe("projects list status", () => {
    it("shows the first milestone that is not completed", () => {
        expect(projectState({ status: "In Progress", milestones: ms, tasks: [{ status: "to_do", dueDate: null }] }, now).milestone).toBe("Design");
    });

    it("flags a project with no tasks yet", () => {
        expect(projectState({ status: "Kickoff", milestones: ms, tasks: [] }, now)).toMatchObject({ label: "New: assign tasks", tone: "new" });
    });

    it("counts open tasks past their due date", () => {
        const tasks = [
            { status: "in_progress", dueDate: new Date("2026-11-01") },
            { status: "done", dueDate: new Date("2026-11-01") },
            { status: "to_do", dueDate: new Date("2026-12-01") },
        ];
        expect(projectState({ status: "In Progress", milestones: ms, tasks }, now)).toMatchObject({ label: "1 task overdue", tone: "late" });
    });

    it("is on track otherwise, and completed wins over everything", () => {
        expect(projectState({ status: "In Progress", milestones: ms, tasks: [{ status: "to_do", dueDate: null }] }, now).tone).toBe("ok");
        expect(projectState({ status: "Completed", milestones: ms, tasks: [] }, now)).toMatchObject({ label: "Completed", tone: "done" });
    });

    it("handles a project with no milestones", () => {
        expect(projectState({ status: "Kickoff", milestones: [], tasks: [] }, now).milestone).toBe("Not set");
    });
});
