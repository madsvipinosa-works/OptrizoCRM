import { getSiteSettings } from "@/features/cms/actions";
import { FooterSection } from "@/components/ui/footer-section";

export async function Footer({ className }: { className?: string }) {
    const settings = await getSiteSettings();

    return (
        <FooterSection className={className} contactEmail={settings?.contactEmail ?? undefined} />
    );
}
