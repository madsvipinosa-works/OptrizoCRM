import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/authz";
import { ServiceEditorForm } from "@/features/cms/components/content/ServiceEditorForm";

export const dynamic = "force-dynamic";

export default async function NewServicePage() {
    const a = await requireRole("content_editor");
    if (!a.ok) notFound();

    return (
        <div className="max-w-2xl mx-auto space-y-6">
            <div>
                <Link href="/dashboard/services" className="text-sm text-muted-foreground hover:underline">
                    ← Back to services
                </Link>
                <h1 className="mt-2 text-3xl font-bold tracking-tight">Add a service</h1>
                <p className="text-muted-foreground">Saved as a draft. Visitors see it only after you publish.</p>
            </div>
            <ServiceEditorForm />
        </div>
    );
}
