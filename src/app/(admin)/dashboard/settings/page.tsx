import { redirect } from "next/navigation";
import { auth, hasRole } from "@/auth";
import { getSiteSettings } from "@/features/cms/actions";
import { SettingsForm } from "@/features/cms/components/SettingsForm";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
    const session = await auth();
    if (!hasRole(session, ["superadmin"])) redirect("/dashboard");

    const settings = await getSiteSettings();

    return (
        <div className="mx-auto w-full max-w-4xl space-y-5 pb-12">
            <div>
                <h1 className="text-2xl font-semibold tracking-tight text-foreground">Settings</h1>
                <p className="mt-1 text-sm text-muted-foreground">System settings that exist today. Website content is managed by the Content Editor.</p>
            </div>
            <SettingsForm initialData={settings || undefined} />
        </div>
    );
}
