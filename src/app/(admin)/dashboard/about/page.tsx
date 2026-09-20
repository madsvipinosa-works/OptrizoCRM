import { db } from "@/db";
import { siteSettings, aboutValues } from "@/db/schema";
import { AboutSettingsForm } from "@/features/cms/about/components/AboutSettingsForm";
import { ValuesManager } from "@/features/cms/about/components/ValuesManager";

export default async function AboutCMSPage() {
    const settings = await db.query.siteSettings.findFirst();
    const values = await db.query.aboutValues.findMany({
        orderBy: (aboutValues, { asc }) => [asc(aboutValues.order)]
    });

    return (
        <div className="max-w-4xl mx-auto pb-24">
            <h1 className="text-3xl font-bold mb-4 text-glow">About Page Layout Manager</h1>
            <p className="text-muted-foreground mb-8">
                Control the content, stats, and Bento Box cards displayed on your public agency About Us page.
            </p>

            <div className="space-y-12">
                {/* Stats & Mission */}
                <AboutSettingsForm initialData={settings || {}} />

                <div className="h-px bg-border w-full" />

                {/* Values Bento Cards */}
                <ValuesManager initialValues={values} />
            </div>
        </div>
    );
}
