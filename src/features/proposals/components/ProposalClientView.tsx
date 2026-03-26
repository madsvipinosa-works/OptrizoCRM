"use client";

import { useState } from "react";
import { CheckCircle2, ChevronRight, FileCheck, Loader2, Info, ExternalLink } from "lucide-react";
import { acceptProposalByClient } from "@/features/proposals/actions";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";

interface Props {
    proposal: { id: string; status: string; fileUrl?: string | null; scope?: string | null; timeline?: string | null; };
    parsedDeliverables: string[];
    parsedPricing: { items: { name: string; price: number }[]; total: number };
}

export function ProposalClientView({ proposal, parsedDeliverables, parsedPricing }: Props) {
    const [isLoading, setIsLoading] = useState(false);
    const router = useRouter();
    const isApproved = proposal.status === "Approved";

    const handleAccept = async () => {
        setIsLoading(true);
        try {
            const res = await acceptProposalByClient(proposal.id);
            if (res.success) {
                toast.success(res.message);
                // Trigger confetti or some success state here if desired
                router.refresh(); // re-fetch the server component to show "Approved"
            } else {
                toast.error(res.message || "Failed to accept proposal");
            }
        } catch {
            toast.error("A system error occurred.");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="space-y-12 pb-12">
            {proposal.fileUrl && (
                <section>
                    <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 md:p-6 flex flex-col md:flex-row items-center justify-between gap-4">
                        <div className="flex items-center gap-4">
                            <div className="h-12 w-12 bg-primary/20 rounded-lg flex items-center justify-center text-primary shrink-0">
                                <FileCheck className="h-6 w-6" />
                            </div>
                            <div>
                                <h3 className="text-lg font-semibold text-white">Attached Proposal Document</h3>
                                <p className="text-sm text-muted-foreground">Please review the attached PDF for full proposal details.</p>
                            </div>
                        </div>
                        <a href={proposal.fileUrl} target="_blank" rel="noreferrer" className="shrink-0 w-full md:w-auto">
                            <Button variant="outline" className="w-full bg-primary/10 border-primary/30 hover:bg-primary/20 hover:border-primary/50 text-primary transition-colors">
                                <ExternalLink className="h-4 w-4 mr-2" />
                                View Full Document
                            </Button>
                        </a>
                    </div>
                </section>
            )}

            {/* Scope */}
            {proposal.scope && (
                <section>
                    <h2 className="text-xl font-semibold mb-4 text-white flex items-center gap-2">
                        <Info className="h-5 w-5 text-primary" /> Scope of Work
                    </h2>
                    <Card className="glass-card border-white/10">
                        <CardContent className="pt-6 text-gray-300 leading-relaxed whitespace-pre-wrap">
                            {proposal.scope}
                        </CardContent>
                    </Card>
                </section>
            )}

            {/* Deliverables & Timeline Grid */}
            <div className="grid md:grid-cols-2 gap-8">
                {parsedDeliverables.length > 0 && (
                    <section>
                        <h2 className="text-xl font-semibold mb-4 text-white flex items-center gap-2">
                            <CheckCircle2 className="h-5 w-5 text-primary" /> Deliverables
                        </h2>
                        <ul className="space-y-3">
                            {parsedDeliverables.map((item, idx) => (
                                <li key={idx} className="flex items-start gap-3 bg-white/5 border border-white/10 p-3 rounded-lg">
                                    <ChevronRight className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                                    <span className="text-gray-300 text-sm leading-tight">{item}</span>
                                </li>
                            ))}
                        </ul>
                    </section>
                )}

                {proposal.timeline && (
                    <section>
                        <h2 className="text-xl font-semibold mb-4 text-white flex items-center gap-2">
                            <FileCheck className="h-5 w-5 text-primary" /> Timeline
                        </h2>
                        <Card className="glass-card border-white/10 h-full">
                            <CardContent className="pt-6 flex flex-col justify-center h-full min-h-[120px]">
                                <p className="text-3xl font-bold text-white text-center">{proposal.timeline}</p>
                                <p className="text-center text-muted-foreground text-sm mt-2">Estimated Time to Completion</p>
                            </CardContent>
                        </Card>
                    </section>
                )}
            </div>

            {/* Investment / Pricing */}
            {parsedPricing.items.length > 0 && (
                <section>
                    <h2 className="text-xl font-semibold mb-4 text-white">Investment details</h2>
                    <div className="rounded-xl border border-white/10 overflow-hidden bg-white/[0.02]">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-white/5 border-b border-white/10 text-muted-foreground">
                                <tr>
                                    <th className="px-6 py-4 font-medium">Description</th>
                                    <th className="px-6 py-4 font-medium text-right w-32">Amount</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5 text-gray-300">
                                {parsedPricing.items.map((item, idx) => (
                                    <tr key={idx} className="hover:bg-white/5 transition-colors">
                                        <td className="px-6 py-4">{item.name}</td>
                                        <td className="px-6 py-4 text-right font-medium">${item.price.toLocaleString()}</td>
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot className="bg-primary/10 border-t border-primary/20 text-white font-semibold">
                                <tr>
                                    <td className="px-6 py-5 rounded-bl-xl text-primary tracking-wide uppercase text-xs">Total Estimate</td>
                                    <td className="px-6 py-5 text-right rounded-br-xl text-primary text-xl">${parsedPricing.total.toLocaleString()}</td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                </section>
            )}

            {/* Action Bar */}
            <section className="pt-8 border-t border-white/10">
                {isApproved ? (
                    <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-8 text-center space-y-3">
                        <div className="mx-auto h-12 w-12 bg-green-500/20 rounded-full flex items-center justify-center mb-4 text-green-400">
                            <CheckCircle2 className="h-6 w-6" />
                        </div>
                        <h3 className="text-2xl font-bold text-green-400">Proposal Approved</h3>
                        <p className="text-green-300/80 max-w-md mx-auto">
                            Thank you for your business! This proposal was accepted. You will receive an onboarding email shortly with your Client Portal access.
                        </p>
                    </div>
                ) : (
                    <div className="bg-white/5 border border-white/10 rounded-xl p-6 md:p-8 flex flex-col md:flex-row items-center justify-between gap-6 print:hidden">
                        <div>
                            <h3 className="text-xl font-bold text-white mb-1">Ready to start?</h3>
                            <p className="text-muted-foreground text-sm">By accepting this proposal, you agree to the scope and pricing outlined above. We will automatically provision your project board and client portal.</p>
                        </div>
                        <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto shrink-0">
                            <Button
                                onClick={() => window.print()}
                                variant="outline"
                                size="lg"
                                className="w-full sm:w-auto bg-transparent border-white/20 text-white hover:bg-white/10"
                            >
                                Download / Print PDF
                            </Button>
                            <Button 
                                onClick={handleAccept} 
                                disabled={isLoading}
                                size="lg" 
                                className="w-full sm:w-auto bg-primary text-black hover:bg-primary/90 text-lg h-14 px-8 shadow-[0_0_20px_rgba(255,255,255,0.1)] hover:shadow-[0_0_30px_rgba(255,255,255,0.2)] transition-all"
                            >
                                {isLoading ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : <FileCheck className="h-5 w-5 mr-2" />}
                                Accept Proposal
                            </Button>
                        </div>
                    </div>
                )}
            </section>
        </div>
    );
}
