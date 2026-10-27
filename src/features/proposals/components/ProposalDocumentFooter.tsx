"use client";

import React from "react";
import { Building2, MapPin, Phone, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ProposalDocumentFooterProps {
    proposalCode?: string | null;
    agencyRegistration?: string | null;
    agencyAddress?: string | null;
    agencyPhone?: string | null;
    agencyEmail?: string | null;
    currentPage?: number;
    totalPages?: number;
    className?: string;
}

export function ProposalDocumentFooter({
    proposalCode = "OPT-2026-0001",
    agencyRegistration = "CS202612345",
    agencyAddress = "4th Floor, Innovation Hub Building, Metro Manila, Philippines",
    agencyPhone = "+63 (917) 555-1234",
    agencyEmail = "contact@optrizo.com",
    currentPage = 1,
    totalPages = 1,
    className,
}: ProposalDocumentFooterProps) {
    const regNo = agencyRegistration || "CS202612345";
    const address = agencyAddress || "4th Floor, Innovation Hub Building, Metro Manila, Philippines";
    const phone = agencyPhone || "+63 (917) 555-1234";

    return (
        <footer
            className={cn(
                "proposal-document-footer mt-10 pt-6 border-t-2 border-border/80 text-[11px] text-muted-foreground font-sans print:pt-4 print:mt-6 print:border-border",
                className
            )}
        >
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-border/40">
                {/* Legal Footprint: Entity & SEC Reg */}
                <div className="space-y-1 max-w-md min-w-0 break-words">
                    <div className="font-semibold text-foreground text-xs flex items-center gap-1.5 tracking-tight flex-wrap">
                        <Building2 className="h-3.5 w-3.5 text-primary shrink-0" />
                        <span>Optrizo Digital Solutions</span>
                        <span className="text-muted-foreground/60 font-normal">•</span>
                        <span className="font-mono text-[10px] text-primary/90 font-medium">
                            Company Reg. / SEC No: {regNo}
                        </span>
                    </div>
                    <div className="flex items-center gap-2 text-muted-foreground text-[10px] flex-wrap min-w-0 break-words">
                        <span className="flex items-start gap-1 min-w-0 max-w-full break-all" style={{ wordBreak: "break-all", overflowWrap: "anywhere" }}>
                            <MapPin className="h-3 w-3 text-muted-foreground/80 shrink-0 mt-0.5" />
                            <span className="min-w-0 flex-1 break-all" style={{ wordBreak: "break-all", overflowWrap: "anywhere" }}>{address}</span>
                        </span>
                        <span>•</span>
                        <span className="flex items-center gap-1 font-mono shrink-0">
                            <Phone className="h-3 w-3 text-emerald-500 shrink-0" />
                            <span>{phone}</span>
                        </span>
                    </div>
                </div>

                {/* Tracking & Dynamic Page Counter */}
                <div className="flex sm:flex-col items-center sm:items-end justify-between w-full sm:w-auto gap-2 text-right">
                    <div className="flex items-center gap-1.5 font-mono text-[10px] bg-muted/40 border border-border px-2.5 py-1 rounded">
                        <span className="text-muted-foreground">REF:</span>
                        <span className="font-bold text-foreground">{proposalCode}</span>
                        <span className="text-muted-foreground/50">|</span>
                        <span className="text-primary font-semibold">
                            Page {currentPage} of {totalPages}
                        </span>
                    </div>
                    <div className="text-[9px] text-muted-foreground/70 hidden sm:block">
                        Confidential &amp; Proprietary • Official Digital Document
                    </div>
                </div>
            </div>

            {/* Bottom Copyright & Legal Disclaimer */}
            <div className="pt-2.5 flex flex-col sm:flex-row items-center justify-between gap-1 text-[9px] text-muted-foreground/60">
                <p suppressHydrationWarning>
                    &copy; {new Date().getFullYear()} Optrizo Digital Solutions. All rights reserved. Generated and tracked via internal client portal audit controls.
                </p>
                <div className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
                    <ShieldCheck className="h-3 w-3" />
                    <span>Digital Portal Sign-Off &amp; Timestamp Verification</span>
                </div>
            </div>
        </footer>
    );
}
