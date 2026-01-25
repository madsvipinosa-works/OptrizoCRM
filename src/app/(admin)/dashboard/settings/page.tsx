import { getSiteSettings } from "@/features/cms/actions";
import { SettingsForm } from "./settings-form";

export default async function SettingsPage() {
    const settings = await getSiteSettings();

    return (
        <div className="max-w-4xl mx-auto">
            <h1 className="text-3xl font-bold mb-8">Global Site Settings</h1>
            <SettingsForm initialData={settings} />
        </div>
    );
}
