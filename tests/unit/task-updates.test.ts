import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("@/auth", async () => (await import("../helpers/mock-auth")).authModuleMock());
vi.mock("@/db", async () => ({ db: (await import("../helpers/mock-db")).createMockDb() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/features/audit/log", () => ({ logAction: vi.fn() }));
vi.mock("@/features/notifications/send", () => ({
    notifyAllAdmins: vi.fn(),
    createSystemNotification: vi.fn(),
}));

import { auth } from "@/auth";
import { db } from "@/db";
import { logAction } from "@/features/audit/log";
import { postTaskUpdate, updateTaskDetails } from "@/features/pm/actions";
import { cleanTaskAttachments, cleanUpdateNote, fileNameFromUrl } from "@/features/pm/task-attachments";
import { fileBelongsToProject } from "@/lib/authz";
import { ROLES, signInAs } from "../helpers/mock-auth";
import { expectNoWrites, type MockDb } from "../helpers/mock-db";

const mockDb = db as unknown as MockDb;

const fileFor = (projectId: string, name = "report.pdf") =>
    `/api/private-file?blobUrl=${encodeURIComponent(`https://blob.example/tenants/u1/1700000000-${name}`)}&projectId=${projectId}`;

/** Captures `db.insert(...).values(row)`. */
function captureInserts() {
    const rows: Record<string, unknown>[] = [];
    mockDb.insert.mockImplementation(() => ({
        values: (row: Record<string, unknown>) => {
            rows.push(row);
            return Promise.resolve();
        },
    }));
    return rows;
}

/** Captures `db.update(...).set(values)`. */
function captureUpdates() {
    const sets: Record<string, unknown>[] = [];
    mockDb.update.mockImplementation(() => ({
        set: (values: Record<string, unknown>) => {
            sets.push(values);
            return { where: () => Object.assign(Promise.resolve([]), { returning: () => Promise.resolve([{ id: "t1" }]) }) };
        },
    }));
    return sets;
}

beforeEach(() => {
    mockDb.resetMocks();
    vi.clearAllMocks();
});

describe("cleanTaskAttachments", () => {
    it("accepts a link and a file uploaded for this project, naming the file", () => {
        const res = cleanTaskAttachments(
            [
                { kind: "link", label: " Figma ", url: "figma.com/file/abc" },
                { kind: "file", label: "", url: fileFor("p1", "mockups.zip") },
            ],
            "p1"
        );
        expect(res).toEqual({
            ok: true,
            attachments: [
                { kind: "link", label: "Figma", url: "https://figma.com/file/abc" },
                { kind: "file", label: "mockups.zip", url: fileFor("p1", "mockups.zip") },
            ],
        });
    });

    it("rejects a file uploaded for another project", () => {
        expect(cleanTaskAttachments([{ kind: "file", label: "x", url: fileFor("other") }], "p1").ok).toBe(false);
    });

    it("rejects links that cannot be opened and files passed off as links", () => {
        expect(cleanTaskAttachments([{ kind: "link", label: "x", url: "dada" }], "p1").ok).toBe(false);
        expect(cleanTaskAttachments([{ kind: "link", label: "x", url: "javascript:alert(1)" }], "p1").ok).toBe(false);
        expect(cleanTaskAttachments([{ kind: "link", label: "x", url: fileFor("p1") }], "p1").ok).toBe(false);
    });

    it("allows at most 10 items", () => {
        const eleven = Array.from({ length: 11 }, (_, i) => ({ kind: "link", label: `l${i}`, url: `https://a${i}.com` }));
        expect(cleanTaskAttachments(eleven, "p1").ok).toBe(false);
        expect(cleanTaskAttachments(eleven.slice(0, 10), "p1").ok).toBe(true);
    });

    it("treats nothing as an empty list", () => {
        expect(cleanTaskAttachments(undefined, "p1")).toEqual({ ok: true, attachments: [] });
    });
});

describe("small helpers", () => {
    it("trims and caps a note, and returns null when blank", () => {
        expect(cleanUpdateNote("  hi  ")).toBe("hi");
        expect(cleanUpdateNote("   ")).toBeNull();
        expect(cleanUpdateNote("x".repeat(2500))).toHaveLength(2000);
    });

    it("reads the file name from a blob or local upload URL", () => {
        expect(fileNameFromUrl(fileFor("p1", "spec.docx"))).toBe("spec.docx");
        const local = `/api/private-file?blobUrl=${encodeURIComponent("/uploads/3f2b1c9e-1111-4222-8333-444455556666-notes.pdf")}&projectId=p1`;
        expect(fileNameFromUrl(local)).toBe("notes.pdf");
    });
});

describe("postTaskUpdate", () => {
    const task = (status: string) => ({ id: "t1", title: "Login page", projectId: "p1", status });

    it.each(ROLES.filter((r) => r !== "manager" && r !== "developer"))("rejects %s", async (role) => {
        signInAs(auth, role);
        const res = await postTaskUpdate({ taskId: "t1", note: "done" });
        expect(res.success).toBe(false);
        expectNoWrites(mockDb);
    });

    it("rejects a developer who is not assigned to the task", async () => {
        signInAs(auth, "developer", "dev-2");
        mockDb.query.taskAssignees.findFirst.mockResolvedValue(undefined);
        expect((await postTaskUpdate({ taskId: "t1", note: "done" })).success).toBe(false);
        expectNoWrites(mockDb);
    });

    describe("as the assigned developer", () => {
        beforeEach(() => {
            signInAs(auth, "developer", "dev-1");
            mockDb.query.taskAssignees.findFirst.mockResolvedValue({ taskId: "t1", userId: "dev-1" });
        });

        it.each(["to_do", "in_review", "done"])("cannot post while the task is %s", async (status) => {
            mockDb.query.tasks.findFirst.mockResolvedValue(task(status));
            expect((await postTaskUpdate({ taskId: "t1", note: "hello" })).success).toBe(false);
            expectNoWrites(mockDb);
        });

        it("needs a note or an attachment", async () => {
            mockDb.query.tasks.findFirst.mockResolvedValue(task("in_progress"));
            expect((await postTaskUpdate({ taskId: "t1", note: "   " })).success).toBe(false);
            expectNoWrites(mockDb);
        });

        it("rejects a link that cannot be opened and a file from another project", async () => {
            mockDb.query.tasks.findFirst.mockResolvedValue(task("in_progress"));
            expect((await postTaskUpdate({ taskId: "t1", attachments: [{ kind: "link", label: "x", url: "dada" }] })).success).toBe(false);
            expect((await postTaskUpdate({ taskId: "t1", attachments: [{ kind: "file", label: "x", url: fileFor("other") }] })).success).toBe(false);
            expectNoWrites(mockDb);
        });

        it("saves a progress update, audits it, and never changes the task status", async () => {
            mockDb.query.tasks.findFirst.mockResolvedValue(task("in_progress"));
            const rows = captureInserts();

            const res = await postTaskUpdate({
                taskId: "t1",
                note: "  Form done, validating next  ",
                attachments: [{ kind: "file", label: "form.pdf", url: fileFor("p1", "form.pdf") }],
            });

            expect(res).toEqual({ success: true });
            expect(rows).toHaveLength(1);
            expect(rows[0]).toMatchObject({ taskId: "t1", authorId: "dev-1", kind: "progress", note: "Form done, validating next" });
            expect(mockDb.update).not.toHaveBeenCalled();
            expect(logAction).toHaveBeenCalledWith("CREATE", "TaskUpdate", expect.stringContaining("Login page"), "dev-1", "p1");
        });

        it("can post again after changes were requested", async () => {
            mockDb.query.tasks.findFirst.mockResolvedValue(task("changes_requested"));
            captureInserts();
            expect((await postTaskUpdate({ taskId: "t1", note: "Fixing it" })).success).toBe(true);
        });
    });

    it("lets the PM post on a task that is in review, but not on a done one", async () => {
        signInAs(auth, "manager", "pm-1");
        captureInserts();
        mockDb.query.tasks.findFirst.mockResolvedValue(task("in_review"));
        expect((await postTaskUpdate({ taskId: "t1", note: "Please also check mobile" })).success).toBe(true);

        mockDb.query.tasks.findFirst.mockResolvedValue(task("done"));
        expect((await postTaskUpdate({ taskId: "t1", note: "late note" })).success).toBe(false);
    });
});

describe("updateTaskDetails deliverables", () => {
    beforeEach(() => {
        mockDb.query.tasks.findFirst.mockResolvedValue({ projectId: "p1" });
    });

    it.each(ROLES.filter((r) => r !== "manager"))("rejects %s", async (role) => {
        signInAs(auth, role);
        const res = await updateTaskDetails("t1", { attachments: [{ kind: "link", label: "x", url: "https://a.com" }] });
        expect(res.success).toBe(false);
        expectNoWrites(mockDb);
    });

    it("saves the manager's deliverables on the task", async () => {
        signInAs(auth, "manager", "pm-1");
        const sets = captureUpdates();
        const attachments = [{ kind: "file" as const, label: "brief.pdf", url: fileFor("p1", "brief.pdf") }];

        const res = await updateTaskDetails("t1", { attachments });

        expect(res.success).toBe(true);
        expect(sets[0]).toMatchObject({ attachments });
    });

    it("rejects a file from another project and leaves the task unchanged", async () => {
        signInAs(auth, "manager", "pm-1");
        const res = await updateTaskDetails("t1", { attachments: [{ kind: "file", label: "x", url: fileFor("other") }] });
        expect(res.success).toBe(false);
        expect(mockDb.update).not.toHaveBeenCalled();
    });
});

describe("fileBelongsToProject", () => {
    const ref = "https://blob.example/tenants/u1/1700000000-report.pdf";

    beforeEach(() => {
        mockDb.query.agencyProjects.findFirst.mockResolvedValue({ documents: [], signOffFileUrl: null, lead: null });
        mockDb.query.tasks.findMany.mockResolvedValue([]);
        mockDb.query.payments.findMany.mockResolvedValue([]);
        mockDb.query.document.findMany.mockResolvedValue([]);
        mockDb.setSelectRows([]);
    });

    it("finds a file the PM attached to a task", async () => {
        mockDb.query.tasks.findMany.mockResolvedValue([{ proofLinks: [], attachments: [{ kind: "file", label: "r", url: fileFor("p1", "report.pdf") }] }]);
        expect(await fileBelongsToProject("p1", ref)).toBe(true);
    });

    it("finds a file posted in a progress update", async () => {
        mockDb.setSelectRows([{ attachments: [{ kind: "file", label: "r", url: fileFor("p1", "report.pdf") }] }]);
        expect(await fileBelongsToProject("p1", ref)).toBe(true);
    });

    it("does not find a file that is nowhere in the project", async () => {
        expect(await fileBelongsToProject("p1", ref)).toBe(false);
    });
});
