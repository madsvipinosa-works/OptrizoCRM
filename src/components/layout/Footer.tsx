import { getPublishedPage } from "@/features/cms/content/public-queries";
import type { ContactFields } from "@/features/cms/content/schemas";
import { FooterSection } from "@/components/ui/footer-section";

export async function Footer({ className }: { className?: string }) {
    const contactPage = await getPublishedPage("contact");
    const fields = contactPage?.fields as ContactFields | undefined;
    const email = fields?.email?.trim() || undefined;

    return (
        <FooterSection className={className} contactEmail={email} />
    );
}
