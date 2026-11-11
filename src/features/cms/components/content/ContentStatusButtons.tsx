"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { hideService, publishService, unhideService } from "@/features/cms/content/services.actions";
import { hidePortfolio, publishPortfolio, unhidePortfolio } from "@/features/cms/content/portfolio.actions";

/** Plain-language text for the error codes returned by the content actions. */
export function contentErrorMessage(error: string): string {
    switch (error) {
        case "FORBIDDEN":
            return "You don't have permission to do this.";
        case "VALIDATION_ERROR":
            return "Fix the highlighted fields and try again.";
        case "CONSENT_REQUIRED":
            return "Cannot publish: enter the client's real name to show it with their consent, or untick consent and use a general name.";
        case "SERVICE_REQUIRED":
            return "Cannot publish: pick the service this project belongs to.";
        case "SERVICE_NOT_FOUND":
            return "The linked service no longer exists. Pick another one.";
        case "INVALID_STATUS":
            return "This item's status has changed. Refresh the page and try again.";
        case "SLUG_TAKEN":
            return "Another item already uses that web address. Change the name or title.";
        case "NOT_FOUND":
            return "This item no longer exists.";
        case "SERVER_ERROR":
            return "Something went wrong. Try again.";
        default:
            return error;
    }
}

type Status = "draft" | "published" | "hidden";

type Props = {
    kind: "service" | "portfolio";
    id: string;
    status: Status;
};

// Errors fixed in the editor get a short line and a link there, instead of a long sentence in a narrow row.
const FIX_IN_EDITOR: Record<string, string> = {
    SERVICE_REQUIRED: "Pick a service first.",
    SERVICE_NOT_FOUND: "Its service was removed.",
    CONSENT_REQUIRED: "The client's real name is missing.",
    VALIDATION_ERROR: "Some fields need fixing.",
};

/** Publish (draft), Hide (published) or Unhide (hidden). Buttons only, never a status dropdown. */
export function ContentStatusButtons({ kind, id, status }: Props) {
    const router = useRouter();
    const [pending, startTransition] = useTransition();
    const [error, setError] = useState<string | null>(null);
    const [errorCode, setErrorCode] = useState<string | null>(null);

    function run(action: "publish" | "hide" | "unhide") {
        setError(null);
        setErrorCode(null);
        startTransition(async () => {
            const result =
                kind === "service"
                    ? await (action === "publish" ? publishService(id) : action === "hide" ? hideService(id) : unhideService(id))
                    : await (action === "publish" ? publishPortfolio(id) : action === "hide" ? hidePortfolio(id) : unhidePortfolio(id));
            if ("error" in result) {
                setError(contentErrorMessage(result.error));
                setErrorCode(result.error);
                return;
            }
            router.refresh();
        });
    }

    return (
        <div className="flex flex-col items-end gap-1">
            {status === "draft" && (
                <Button size="sm" variant="ghost" disabled={pending} onClick={() => run("publish")} className="h-8 font-semibold text-brand-deep hover:text-brand-deep active:scale-[0.97]">
                    Publish
                </Button>
            )}
            {status === "published" && (
                <Button size="sm" variant="ghost" disabled={pending} onClick={() => run("hide")} className="h-8 text-muted-foreground hover:text-foreground active:scale-[0.97]">
                    Hide
                </Button>
            )}
            {status === "hidden" && (
                <Button size="sm" variant="ghost" disabled={pending} onClick={() => run("unhide")} className="h-8 text-muted-foreground hover:text-foreground active:scale-[0.97]">
                    Unhide
                </Button>
            )}
            {error && (
                <p role="alert" className="max-w-xs text-right text-sm text-destructive">
                    {errorCode && FIX_IN_EDITOR[errorCode] ? (
                        <>
                            {FIX_IN_EDITOR[errorCode]}{" "}
                            <Link href={`/dashboard/${kind === "service" ? "services" : "portfolio"}/${id}`} className="font-medium underline underline-offset-4">
                                Open editor
                            </Link>
                        </>
                    ) : (
                        error
                    )}
                </p>
            )}
        </div>
    );
}

// Status colour carries meaning: green = live, amber = draft, grey = hidden. Text stays on --foreground.
const STATUS_CHIP: Record<string, string> = {
    published: "bg-brand-soft text-brand-deep",
    draft: "bg-stage-negotiation/15 text-foreground",
    hidden: "bg-muted text-muted-foreground",
};
const STATUS_DOT: Record<string, string> = { published: "bg-brand-deep", draft: "bg-stage-negotiation", hidden: "bg-muted-foreground" };

/** Read-only chip for a service or portfolio status (C2, C5). */
export function ContentStatusChip({ status, label }: { status: string; label?: string }) {
    return (
        <span className={`inline-flex flex-none items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium capitalize ${STATUS_CHIP[status] ?? STATUS_CHIP.hidden}`}>
            <span className={`size-1.5 rounded-full ${STATUS_DOT[status] ?? STATUS_DOT.hidden}`} aria-hidden="true" />
            {label ?? status}
        </span>
    );
}
