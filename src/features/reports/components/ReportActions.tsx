"use client";

import { useEffect } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

type Table = { title: string; columns: string[]; rows: (string | number)[][]; total?: (string | number)[] };

const csvCell = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;

/** Back link plus Download PDF, Download CSV and Print. PDF opens the print dialog: choose "Save as PDF". */
export function ReportActions({ filename, title, tables, autoPrint }: { filename: string; title: string; tables: Table[]; autoPrint: boolean }) {
    useEffect(() => {
        if (autoPrint) window.print();
    }, [autoPrint]);

    const downloadCsv = () => {
        const lines: string[] = [csvCell(title), ""];
        for (const t of tables) {
            lines.push(csvCell(t.title), t.columns.map(csvCell).join(","));
            t.rows.forEach((r) => lines.push(r.map(csvCell).join(",")));
            if (t.total) lines.push(t.total.map(csvCell).join(","));
            lines.push("");
        }
        const url = URL.createObjectURL(new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" }));
        const a = document.createElement("a");
        a.href = url;
        a.download = `${filename}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };

    return (
        <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
            <Link href="/dashboard/reports" className="inline-flex items-center gap-1.5 rounded-md text-sm font-medium text-brand-deep outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring">
                <ArrowLeft className="size-4" strokeWidth={1.75} aria-hidden="true" />
                Back to reports
            </Link>
            <div className="flex flex-wrap gap-2">
                <Button onClick={() => window.print()}>Download PDF</Button>
                <Button variant="outline" onClick={downloadCsv}>
                    Download CSV
                </Button>
                <Button variant="outline" onClick={() => window.print()}>
                    Print
                </Button>
            </div>
        </div>
    );
}
