"use client";

import { useState } from "react";
import { CheckCircle2, ChevronRight, FileCheck, Loader2, Info, ExternalLink, XCircle } from "lucide-react";
import { acceptProposalByClient, rejectProposalByClient } from "@/features/proposals/actions";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

interface Props {
    proposal: { id: string; status: string; fileUrl?: string | null; scope?: string | null; timeline?: string | null; };
    parsedDeliverables: string[];
    parsedPricing: { items: { name: string; price: number }[]; total: number };
    isPreview?: boolean;
}

export function ProposalClientView({ proposal, parsedDeliverables, parsedPricing, isPreview }: Props) {
    const [isLoading, setIsLoading] = useState(false);
    const [isRejecting, setIsRejecting] = useState(false);
    const [rejectReason, setRejectReason] = useState("");
    const [isRejectDialogOpen, setIsRejectDialogOpen] = useState(false);
    const router = useRouter();
    
    const isApproved = proposal.status === "Approved" || proposal.status === "Accepted";
    const isRejected = proposal.status === "Rejected";

    const handleAccept = async () => {
        setIsLoading(true);
        try {
            const res = await acceptProposalByClient(proposal.id);
            if (res.success) {
                toast.success(res.message);
                router.refresh();
            } else {
                toast.error(res.message || "Failed to accept proposal");
            }
        } catch {
            toast.error("A system error occurred.");
        } finally {
            setIsLoading(false);
        }
    };

    const handleReject = async () => {
        if (!rejectReason.trim()) {
            toast.error("Please provide a reason for declining.");
            return;
        }
        setIsRejecting(true);
        try {
            const res = await rejectProposalByClient(proposal.id, rejectReason);
            if (res.success) {
                toast.success(res.message);
                setIsRejectDialogOpen(false);
                router.refresh();
            } else {
                toast.error(res.message || "Failed to decline proposal");
            }
        } catch {
            toast.error("A system error occurred.");
        } finally {
            setIsRejecting(false);
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
                {isPreview && !isApproved && !isRejected ? (
                    <div className="bg-sky-500/10 border border-sky-500/20 rounded-xl p-8 text-center space-y-3">
                        <div className="mx-auto h-12 w-12 bg-sky-500/20 rounded-full flex items-center justify-center mb-4 text-sky-400">
                            <Info className="h-6 w-6" />
                        </div>
                        <h3 className="text-2xl font-bold text-sky-400">Staff Preview Mode</h3>
                        <p className="text-sky-200/80 max-w-sm mx-auto">
                            You are previewing this proposal. Only the client who matches the Lead explicitly can formally accept or decline it from their account.
                        </p>
                    </div>
                ) : isApproved ? (
                    <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-8 text-center space-y-3">
                        <div className="mx-auto h-12 w-12 bg-green-500/20 rounded-full flex items-center justify-center mb-4 text-green-400">
                            <CheckCircle2 className="h-6 w-6" />
                        </div>
                        <h3 className="text-2xl font-bold text-green-400">Proposal Approved</h3>
                        <p className="text-green-300/80 max-w-md mx-auto">
                            Thank you for your business! This proposal was accepted. You will receive an onboarding email shortly with your Client Portal access.
                        </p>
                    </div>
                ) : isRejected ? (
                     <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-8 text-center space-y-3">
                        <div className="mx-auto h-12 w-12 bg-red-500/20 rounded-full flex items-center justify-center mb-4 text-red-500">
                            <XCircle className="h-6 w-6" />
                        </div>
                        <h3 className="text-2xl font-bold text-red-500">Proposal Declined</h3>
                        <p className="text-red-300/80 max-w-md mx-auto">
                            This proposal has been formally declined. Our team has been notified and we will follow up with you shortly.
                        </p>
                    </div>
                ) : (
                    <div className="bg-white/5 border border-white/10 rounded-xl p-6 md:p-8 flex flex-col md:flex-row items-center justify-between gap-6 print:hidden">
                        <div>
                            <h3 className="text-xl font-bold text-white mb-1">Ready to start?</h3>
                            <p className="text-muted-foreground text-sm">By accepting this proposal, you agree to the scope and pricing outlined above. We will automatically provision your project board and client portal.</p>
                        </div>
                        <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto shrink-0 mt-4 md:mt-0">
                            <Button
                                onClick={() => window.print()}
                                variant="outline"
                                className="w-full sm:w-auto bg-transparent border-white/20 text-white hover:bg-white/10 h-12"
                            >
                                Download PDF
                            </Button>

                            <Dialog open={isRejectDialogOpen} onOpenChange={setIsRejectDialogOpen}>
                                <DialogTrigger asChild>
                                    <Button 
                                        variant="outline" 
                                        className="w-full sm:w-auto border-red-500/20 text-red-400 hover:text-red-300 hover:bg-red-500/10 hover:border-red-500/40 h-12"
                                    >
                                        Decline
                                    </Button>
                                </DialogTrigger>
                                <DialogContent className="glass-card border-white/10 text-white">
                                    <DialogHeader>
                                        <DialogTitle>Decline Proposal</DialogTitle>
                                        <DialogDescription>
                                            Please let us know why you are declining this proposal so we can better assist you.
                                        </DialogDescription>
                                    </DialogHeader>
                                    <div className="py-4">
                                        <Textarea
                                            value={rejectReason}
                                            onChange={(e) => setRejectReason(e.target.value)}
                                            placeholder="e.g. Budget constraints, timing, missing requirements..."
                                            className="bg-black/50 border-white/10 min-h-[100px]"
                                        />
                                    </div>
                                    <DialogFooter>
                                        <Button variant="ghost" onClick={() => setIsRejectDialogOpen(false)}>Cancel</Button>
                                        <Button 
                                            variant="destructive" 
                                            onClick={handleReject} 
                                            disabled={isRejecting || !rejectReason.trim()}
                                        >
                                            {isRejecting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                                            Submit Decline
                                        </Button>
                                    </DialogFooter>
                                </DialogContent>
                            </Dialog>

                            <Button 
                                onClick={handleAccept} 
                                disabled={isLoading}
                                className="w-full sm:w-auto bg-primary text-black hover:bg-primary/90 font-semibold h-12 px-8 shadow-[0_0_20px_rgba(255,255,255,0.1)] hover:shadow-[0_0_30px_rgba(255,255,255,0.2)] transition-all"
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
