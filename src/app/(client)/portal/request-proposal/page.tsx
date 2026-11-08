import { getPublishedServices } from "@/features/cms/content/public-queries";
import { IntakeForm } from "@/components/crm/IntakeForm";
import { redirect } from "next/navigation";
import { auth } from "@/auth";

interface PageProps {
    searchParams: Promise<{ serviceId?: string }>;
}

export default async function RequestProposalPage({ searchParams }: PageProps) {
    const session = await auth();
    const { serviceId } = await searchParams;

    if (!session?.user?.id) {
        const callback = serviceId ? `/portal/request-proposal?serviceId=${serviceId}` : "/portal/request-proposal";
        redirect(`/login?callbackUrl=${encodeURIComponent(callback)}&reason=proposal_auth`);
    }

    const publishedServices = await getPublishedServices({ forInquiry: true });
    const availableServices = publishedServices.map((s) => ({ id: s.id, title: s.title }));

    // Validate the serviceId against published+showInInquiry services
    const selectedService = availableServices.find((s) => s.id === serviceId);

    return (
        <div className="container mx-auto px-4 py-12 max-w-3xl">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">Request a <span className="text-brand-deep text-glow">Proposal</span></h1>
            {selectedService && (
                <div className="mb-6 p-4 rounded-xl bg-primary/10 border border-primary/30 text-brand-deep flex items-center justify-between">
                    <div>
                        <span className="text-xs text-brand-deep font-semibold block mb-1">Selected Service</span>
                        <h3 className="text-lg font-semibold">{selectedService.title}</h3>
                    </div>
                </div>
            )}
            <p className="text-muted-foreground mb-8">
                Fill out the form below to give us an overview of your needs. Our team will review your request and get back to you with a tailored proposal.
            </p>
            <IntakeForm availableServices={availableServices} preSelectedServiceId={selectedService?.id} />
        </div>
    );
}
