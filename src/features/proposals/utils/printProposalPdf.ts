"use client";

/**
 * Prints the server-rendered proposal PDF (the exact same file produced by "Download PDF")
 * via a hidden iframe, so the print preview is always identical to the downloaded document.
 * Falls back to opening the PDF in a new tab, and finally to window.print().
 */
export async function printProposalPdf(proposalId: string): Promise<void> {
    const res = await fetch(`/api/proposals/${proposalId}/pdf`);
    if (!res.ok) throw new Error(`PDF generation failed (${res.status})`);

    const blob = await res.blob();
    const url = URL.createObjectURL(new Blob([blob], { type: "application/pdf" }));

    const iframe = document.createElement("iframe");
    iframe.style.position = "fixed";
    iframe.style.right = "0";
    iframe.style.bottom = "0";
    iframe.style.width = "0";
    iframe.style.height = "0";
    iframe.style.border = "0";
    iframe.src = url;

    const cleanup = () => {
        setTimeout(() => {
            iframe.remove();
            URL.revokeObjectURL(url);
        }, 60_000);
    };

    iframe.onload = () => {
        try {
            iframe.contentWindow?.focus();
            iframe.contentWindow?.print();
        } catch {
            // Some browsers block printing PDF iframes — open in a new tab instead.
            window.open(url, "_blank", "noopener");
        }
        cleanup();
    };

    document.body.appendChild(iframe);
}
