import { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/authz";
import { InviteStaffForm } from "./InviteStaffForm";
import { ArrowLeft } from "lucide-react";

export const metadata: Metadata = {
    title: "Add Staff Account - Admin Dashboard",
    description: "Invite a new staff member to Optrizo.",
};

export const dynamic = "force-dynamic";

export default async function NewStaffPage() {
    // 1. Strict server-side role check: requireRole(["superadmin"]) BEFORE any operation
    const authz = await requireRole(["superadmin"]);
    if (!authz.ok) {
        redirect("/dashboard");
    }

    return (
        <div className="space-y-6 max-w-4xl">
            <div>
                <Link
                    href="/dashboard/team"
                    className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#0e6b7e] hover:underline mb-3"
                >
                    <ArrowLeft className="w-4 h-4" />
                    Back to team
                </Link>
                <h1 className="text-3xl font-bold tracking-tight text-foreground">Add staff account</h1>
                <p className="text-sm text-muted-foreground mt-1">
                    Clients create their own accounts. Super Admin accounts are not created here.
                </p>
            </div>

            <InviteStaffForm />
        </div>
    );
}
