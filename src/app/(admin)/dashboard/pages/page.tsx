import { notFound, redirect } from "next/navigation";
import { requireRole } from "@/lib/authz";

export const dynamic = "force-dynamic";

export default async function PagesIndexPage() {
    const a = await requireRole("content_editor");
    if (!a.ok) notFound();

    redirect("/dashboard/pages/home");
}
