"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Back link, then real PDF and CSV downloads (served by /api/reports/export) and Print. */
export function ReportActions({ pdfHref, csvHref }: { pdfHref: string; csvHref: string }) {
    return (
        <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
            <Link href="/dashboard/reports" className="inline-flex items-center gap-1.5 rounded-md text-sm font-medium text-brand-deep outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring">
                <ArrowLeft className="size-4" strokeWidth={1.75} aria-hidden="true" />
                Back to reports
            </Link>
            <div className="flex flex-wrap gap-2">
                <Button asChild>
                    <a href={pdfHref} download>
                        Download PDF
                    </a>
                </Button>
                <Button asChild variant="outline">
                    <a href={csvHref} download>
                        Download CSV
                    </a>
                </Button>
                <Button variant="outline" onClick={() => window.print()}>
                    Print
                </Button>
            </div>
        </div>
    );
}
