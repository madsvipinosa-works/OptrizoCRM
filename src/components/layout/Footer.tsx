import { db } from "@/db";
import { FooterSection } from "@/components/ui/footer-section";

export async function Footer() {
    const settings = await db.query.siteSettings.findFirst();

    return (
        <FooterSection contactEmail={settings?.contactEmail ?? undefined} />
    );
}
