import { db } from "@/db";
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

    const availableServices = await db.query.services.findMany({
        columns: {
            id: true,
            title: true,
        },
    });

    const selectedService = availableServices.find(s => s.id === serviceId);

    return (
        <div className="container mx-auto px-4 py-12 max-w-3xl">
            <h1 className="text-4xl font-bold mb-4 tracking-tight">Request a <span className="text-primary text-glow">Proposal</span></h1>
            {selectedService && (
                <div className="mb-6 p-4 rounded-xl bg-primary/10 border border-primary/30 text-primary flex items-center justify-between">
                    <div>
                        <span className="text-xs uppercase tracking-widest text-primary/80 font-bold block mb-1">Selected Service</span>
                        <h3 className="text-lg font-semibold">{selectedService.title}</h3>
                    </div>
                </div>
            )}
            <p className="text-muted-foreground mb-8">
                Fill out the form below to give us an overview of your needs. Our team will review your request and get back to you with a tailored proposal.
            </p>
            <IntakeForm availableServices={availableServices} preSelectedServiceId={serviceId} />
        </div>
    );
}
