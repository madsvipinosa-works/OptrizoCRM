import { getSiteSettings } from "@/features/cms/actions";

export default async function AboutPage() {
    const settings = await getSiteSettings();

    return (
        <div className="container mx-auto px-4 py-24">
            <h1 className="text-4xl font-bold mb-6">About Optrizo</h1>
            <div className="prose prose-invert max-w-none">
                <div
                    className="text-xl text-muted-foreground"
                    dangerouslySetInnerHTML={{ __html: settings?.aboutText || "<p>We are a team of passionate developers...</p>" }}
                />
            </div>
        </div>
    );
}
