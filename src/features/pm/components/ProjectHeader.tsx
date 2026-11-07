import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";

type View = "board" | "timeline" | "activity" | "payments" | "completion";

/**
 * One header for every project page (mockup 22): who it is for, the project name, the three
 * views as a segmented control, then the project tools as a quieter group.
 */
export function ProjectHeader({
    projectId,
    title,
    businessName,
    clientName,
    current,
    showTools = true,
    extraTools,
}: {
    projectId: string;
    title: string;
    businessName?: string | null;
    clientName?: string | null;
    current: View;
    /** Payments and Completion are PM tools. */
    showTools?: boolean;
    /** Board-only tools (Files, Settings). */
    extraTools?: ReactNode;
}) {
    const base = `/dashboard/pm/${projectId}`;
    const views: [View, string, string][] = [
        ["board", "Board", base],
        ["timeline", "Timeline", `${base}/timeline`],
        ["activity", "Activity", `${base}/activity`],
    ];
    const tools: [View, string, string][] = [
        ["payments", "Payments", `${base}/payments`],
        ["completion", "Completion", `${base}/complete`],
    ];

    return (
        <>
            <Link
                href={current === "board" ? "/dashboard/pm" : base}
                className="inline-flex w-fit items-center gap-1 rounded-md text-sm text-muted-foreground outline-none underline-offset-4 hover:text-foreground hover:underline focus-visible:ring-2 focus-visible:ring-ring"
            >
                <ArrowLeft className="size-3.5" aria-hidden="true" /> {current === "board" ? "Back to projects" : "Back to the board"}
            </Link>

            <header className="flex shrink-0 flex-wrap items-start justify-between gap-x-6 gap-y-3">
                <div className="min-w-[min(100%,22rem)] flex-1">
                    <p className="text-sm text-muted-foreground">
                        Business name: {businessName || "Not given"} · Client name: {clientName || "Not given"}
                    </p>
                    <h1 className="mt-1 break-words text-2xl font-semibold tracking-tight text-foreground">Project name: {title}</h1>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <nav aria-label="Project views" className="inline-flex items-center rounded-lg bg-muted p-1 ring-1 ring-inset ring-border/60">
                        {views.map(([key, label, href]) => (
                            <Link
                                key={key}
                                href={href}
                                aria-current={current === key ? "page" : undefined}
                                className={cn(
                                    "flex h-8 items-center rounded-md px-3 text-sm font-medium outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-ring",
                                    current === key ? "bg-card text-foreground ring-1 ring-border/70" : "text-muted-foreground hover:text-foreground"
                                )}
                            >
                                {label}
                            </Link>
                        ))}
                    </nav>
                    {showTools && (
                        <div role="group" aria-label="Project tools" className="flex flex-wrap items-center gap-0.5 sm:ml-2">
                            {tools.map(([key, label, href]) => (
                                <Link
                                    key={key}
                                    href={href}
                                    aria-current={current === key ? "page" : undefined}
                                    className={cn(
                                        "inline-flex h-9 items-center rounded-md px-3 text-sm font-medium outline-none transition-[color,background-color,transform] duration-150 ease-out focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.97]",
                                        current === key ? "bg-brand-soft text-brand-deep" : "text-muted-foreground hover:bg-muted hover:text-foreground"
                                    )}
                                >
                                    {label}
                                </Link>
                            ))}
                            {extraTools}
                        </div>
                    )}
                </div>
            </header>
        </>
    );
}
