import { db } from "@/db";
import { FooterSection } from "@/components/ui/footer-section";

export async function Footer({ className }: { className?: string }) {
    const settings = await db.query.siteSettings.findFirst();

    return (
        <FooterSection className={className} contactEmail={settings?.contactEmail ?? undefined} />
    );
}
