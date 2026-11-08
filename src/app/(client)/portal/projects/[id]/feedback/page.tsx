import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { auth, hasRole } from "@/auth";
import { getClientProject } from "@/features/client-portal/queries";
import { FeedbackSurvey } from "@/features/client-portal/components/FeedbackSurvey";
import { FeedbackSent, type SentFeedback } from "@/features/client-portal/components/FeedbackSent";
import { firstNameOf } from "@/lib/email-templates";
import { formatDate } from "@/lib/datetime";

export const dynamic = "force-dynamic";

/** Client satisfaction survey (step 31). Shows the form until it is sent, then the read-only answers. */
export default async function ClientFeedbackPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const session = await auth();
    if (!session?.user?.id) redirect(`/login?callbackUrl=/portal/projects/${id}/feedback`);
    if (!hasRole(session, ["client"])) redirect("/dashboard");

    const project = await getClientProject(id, session.user.id);
    if (!project) notFound();
    if (project.status !== "Completed") redirect(`/portal/projects/${id}`);

    const sent = project.userFeedback as SentFeedback | null;

    return (
        <div className="mx-auto w-full max-w-5xl space-y-5 pb-12">
            <Link href={`/portal/projects/${id}`} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground hover:underline">
                <ArrowLeft className="size-3.5" aria-hidden="true" /> Back to project
            </Link>

            {sent ? (
                <>
                    <div className="rounded-xl bg-brand-soft px-4 py-3 text-sm text-foreground">
                        <strong>Thank you, {firstNameOf(session.user.name)}.</strong> Your feedback for {project.title} was sent on {formatDate(sent.createdAt)}.
                    </div>
                    <h1 className="text-2xl font-semibold tracking-tight text-foreground">Feedback sent</h1>
                    <FeedbackSent feedback={sent} />
                </>
            ) : (
                <>
                    <div className="flex flex-wrap items-end justify-between gap-2">
                        <div>
                            <h1 className="text-2xl font-semibold tracking-tight text-foreground">How did we do on {project.title}?</h1>
                            <p className="text-sm text-muted-foreground">Client satisfaction survey · 5 questions · about 2 minutes</p>
                        </div>
                        {project.completedAt && <p className="text-sm text-muted-foreground">Project completed {formatDate(project.completedAt)}</p>}
                    </div>
                    <FeedbackSurvey projectId={id} />
                </>
            )}
        </div>
    );
}
