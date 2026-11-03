import { auth, hasRole } from "@/auth";
import { redirect } from "next/navigation";
import { getClientDocuments } from "@/features/client-portal/queries";
import Link from "next/link";
import { FolderOpen, FileText, ExternalLink, Download } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export default async function ClientDocumentsPage() {
    const session = await auth();

    if (!session?.user?.id) {
        redirect("/login?callbackUrl=/portal/documents");
    }

    if (!hasRole(session, ["client"])) {
        redirect("/dashboard");
    }

    const { proposals, handoverDocuments } = await getClientDocuments(session.user.id);

    return (
        <div className="space-y-8 max-w-5xl animate-in fade-in duration-500">
            <div>
                <div className="flex items-center gap-2">
                    <FolderOpen className="w-5 h-5 text-primary" />
                    <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
                        Documents & Deliverables
                    </h1>
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                    Access your signed contracts, proposal scopes, and post-completion handover files.
                </p>
            </div>

            {/* Section 1: Proposals & Contracts */}
            <div className="glass-card rounded-2xl border border-border p-5 space-y-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-primary" />
                        <h2 className="text-lg font-bold text-foreground">Contracts & Proposals</h2>
                    </div>
                    <span className="text-xs text-muted-foreground font-mono">
                        {proposals.length} document(s)
                    </span>
                </div>

                {proposals.length === 0 ? (
                    <div className="text-xs text-muted-foreground py-6 text-center">
                        No proposals or contracts on file.
                    </div>
                ) : (
                    <div className="divide-y divide-border/60">
                        {proposals.map((p) => (
                            <div
                                key={p.id}
                                className="py-3 flex items-center justify-between gap-4 text-xs"
                            >
                                <div className="space-y-0.5">
                                    <div className="font-semibold text-foreground flex items-center gap-2">
                                        <span>{p.title}</span>
                                        <Badge variant="outline" className="text-[10px]">
                                            {p.status}
                                        </Badge>
                                    </div>
                                    <div className="text-muted-foreground font-mono text-[11px]">
                                        Code: {p.proposalCode || "PROPOSAL"} • {new Date(p.createdAt).toLocaleDateString()}
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                    {p.signedFileUrl ? (
                                        <Button variant="outline" size="sm" asChild className="h-8 text-xs font-semibold">
                                            <a
                                                href={p.signedFileUrl}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="inline-flex items-center gap-1"
                                            >
                                                <Download className="w-3.5 h-3.5" /> Signed Copy
                                            </a>
                                        </Button>
                                    ) : (
                                        <Button variant="ghost" size="sm" asChild className="h-8 text-xs text-primary">
                                            <Link href={`/proposal/${p.id}`}>
                                                View Proposal <ExternalLink className="w-3 h-3 ml-1" />
                                            </Link>
                                        </Button>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Section 2: Handover Files from Completed Projects */}
            <div className="glass-card rounded-2xl border border-border p-5 space-y-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <FolderOpen className="w-4 h-4 text-primary" />
                        <h2 className="text-lg font-bold text-foreground">Handover Files & Deliverables</h2>
                    </div>
                    <span className="text-xs text-muted-foreground font-mono">
                        {handoverDocuments.length} deliverable(s)
                    </span>
                </div>

                {handoverDocuments.length === 0 ? (
                    <div className="text-xs text-muted-foreground py-6 text-center">
                        No handover deliverables available. Handover documents unlock automatically once a project reaches Completed status.
                    </div>
                ) : (
                    <div className="divide-y divide-border/60">
                        {handoverDocuments.map((doc) => (
                            <div
                                key={doc.id}
                                className="py-3 flex items-center justify-between gap-4 text-xs"
                            >
                                <div className="space-y-0.5">
                                    <div className="font-semibold text-foreground">{doc.title}</div>
                                    <div className="text-muted-foreground text-[11px]">
                                        {doc.fileName} • {doc.projectTitle}
                                    </div>
                                </div>
                                <Button variant="outline" size="sm" asChild className="h-8 text-xs shrink-0">
                                    <a
                                        href={doc.fileUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-1"
                                    >
                                        <Download className="w-3.5 h-3.5" /> Download
                                    </a>
                                </Button>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

