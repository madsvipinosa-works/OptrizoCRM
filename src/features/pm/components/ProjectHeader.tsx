"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * The project header (mockup 22), drawn once by the project layout. The active tab comes from the URL,
 * so switching Board / Timeline / Activity only swaps the content below.
 */
export function ProjectHeader({
    projectId,
    title,
    businessName,
    clientName,
    isManager,
    extraTools,
}: {
    projectId: string;
    title: string;
    businessName?: string | null;
    clientName?: string | null;
    /** Payments, Completion, Files, Settings and Activity are PM tools. */
    isManager: boolean;
    /** Files and Settings (rendered by the layout). */
    extraTools?: ReactNode;
}) {
    const pathname = usePathname();
    const base = `/dashboard/pm/${projectId}`;
    const views: [string, string][] = [
        ["Board", base],
        ["Timeline", `${base}/timeline`],
        ...(isManager ? ([["Activity", `${base}/activity`]] as [string, string][]) : []),
    ];
    const tools: [string, string][] = [
        ["Payments", `${base}/payments`],
        ["Completion", `${base}/complete`],
    ];

    return (
        <>
            {/* User asked for a way back to the projects list (not in the mockup). */}
            <Link
                href="/dashboard/pm"
                className="inline-flex w-fit items-center gap-1 rounded-md text-sm text-muted-foreground outline-none underline-offset-4 hover:text-foreground hover:underline focus-visible:ring-2 focus-visible:ring-ring"
            >
                <ArrowLeft className="size-3.5" aria-hidden="true" /> Back to projects
            </Link>

            <header className="flex shrink-0 flex-col gap-3">
                <div>
                    <p className="text-sm text-muted-foreground">
                        Business name: {businessName || "Not given"} · Client name: {clientName || "Not given"}
                    </p>
                    <h1 className="mt-0.5 break-words text-2xl font-semibold tracking-tight text-foreground">Project name: {title}</h1>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <nav aria-label="Project views" className="inline-flex items-center rounded-lg bg-muted p-1 ring-1 ring-inset ring-border/60">
                        {views.map(([label, href]) => {
                            const active = pathname === href;
                            return (
                                <Link
                                    key={label}
                                    href={href}
                                    scroll={false}
                                    aria-current={active ? "page" : undefined}
                                    className={cn(
                                        "flex h-8 items-center rounded-md px-3 text-sm font-medium outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-ring",
                                        active ? "bg-card text-foreground ring-1 ring-border/70" : "text-muted-foreground hover:text-foreground"
                                    )}
                                >
                                    {label}
                                </Link>
                            );
                        })}
                    </nav>
                    {isManager && (
                        <div role="group" aria-label="Project tools" className="ml-auto flex flex-wrap items-center gap-2">
                            {tools.map(([label, href]) => {
                                const active = pathname === href;
                                return (
                                    <Link
                                        key={label}
                                        href={href}
                                        scroll={false}
                                        aria-current={active ? "page" : undefined}
                                        className={cn(
                                            "inline-flex h-9 items-center rounded-md border px-3 text-sm font-medium outline-none transition-[color,background-color,transform] duration-150 ease-out focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.97]",
                                            active ? "border-brand-deep/40 bg-brand-soft text-brand-deep" : "border-border bg-card text-foreground hover:bg-muted"
                                        )}
                                    >
                                        {label}
                                    </Link>
                                );
                            })}
                            {extraTools}
                            {/* The board puts Team here (KanbanBoard renders into this slot), so the tools wrap as one group. */}
                            <div id="project-header-actions" className="flex items-center gap-2 empty:hidden" />
                        </div>
                    )}
                </div>
            </header>
        </>
    );
}
