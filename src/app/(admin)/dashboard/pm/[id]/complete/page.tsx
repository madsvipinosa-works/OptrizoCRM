import { db } from "@/db";
import { agencyProjects, document, milestones, payments } from "@/db/schema";
import { eq, and, isNull } from "drizzle-orm";
import { notFound, redirect } from "next/navigation";
import { auth, hasRole } from "@/auth";
import Link from "next/link";
import { ArrowLeft, Award } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CompletionPanel, CompletionGateData, HandoverDoc } from "@/features/pm/components/CompletionPanel";

export const dynamic = "force-dynamic";

export default async function PmProjectCompletePage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id } = await params;
    const session = await auth();

    if (!session?.user?.id) {
        redirect(`/login?callbackUrl=/dashboard/pm/${id}/complete`);
    }

    if (!hasRole(session, ["manager"])) {
        redirect(`/dashboard/pm/${id}`);
    }

    const project = await db.query.agencyProjects.findFirst({
        where: eq(agencyProjects.id, id),
        with: {
            lead: true,
        },
    });

    if (!project) notFound();

    // 1. Check milestones
    const projectMilestones = await db.query.milestones.findMany({
        where: and(eq(milestones.projectId, id), isNull(milestones.deletedAt)),
        columns: { id: true, title: true, status: true },
    });

    const allMilestonesCompleted =
        projectMilestones.length > 0 &&
        projectMilestones.every((m) => m.status === "Completed");

    const uncompletedMilestones = projectMilestones.filter((m) => m.status !== "Completed");

    // 2. Check final payment
    const projectPayments = await db.query.payments.findMany({
        where: eq(payments.projectId, id),
        with: {
            scheduleItem: { columns: { sortOrder: true } },
        },
    });

    const sortedPayments = [...projectPayments].sort(
        (a, b) => (b.scheduleItem?.sortOrder ?? 0) - (a.scheduleItem?.sortOrder ?? 0)
    );
    const finalPayment = sortedPayments[0];
    const finalPaymentPaid = finalPayment?.status === "paid";

    // 3. Check handover files
    const handoverRecords = await db.query.document.findMany({
        where: eq(document.projectId, id),
        orderBy: (document, { desc }) => [desc(document.createdAt)],
    });

    const handoverDocuments: HandoverDoc[] = handoverRecords.map((d) => ({
        id: d.id,
        title: d.title,
        fileName: d.fileName,
        fileUrl: d.fileUrl,
        createdAt: d.createdAt,
    }));

    const gateData: CompletionGateData = {
        projectId: project.id,
        projectTitle: project.title,
        status: project.status,
        completedAt: project.completedAt,
        warrantyEndsAt: project.warrantyEndsAt,
        signOffFileUrl: project.signOffFileUrl,
        signedOffAt: project.signedOffAt,
        allMilestonesCompleted,
        uncompletedMilestones,
        finalPaymentPaid,
        finalPaymentLabel: finalPayment?.label || "Final Milestone Payment",
        finalPaymentStatus: finalPayment?.status || "none",
        handoverDocuments,
    };

    return (
        <div className="space-y-6 max-w-4xl mx-auto py-2">
            <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <Button variant="ghost" size="icon" asChild>
                        <Link href={`/dashboard/pm/${project.id}`}>
                            <ArrowLeft className="h-4 w-4" />
                        </Link>
                    </Button>
                    <div>
                        <div className="flex items-center gap-2">
                            <Award className="w-5 h-5 text-primary" />
                            <h1 className="text-2xl font-bold tracking-tight text-foreground">
                                Project Completion & Handover
                            </h1>
                        </div>
                        <p className="text-sm text-muted-foreground mt-0.5">
                            {project.title} • {project.lead?.businessName || project.lead?.contactName || "Client"}
                        </p>
                    </div>
                </div>
            </div>

            <CompletionPanel data={gateData} />
        </div>
    );
}

