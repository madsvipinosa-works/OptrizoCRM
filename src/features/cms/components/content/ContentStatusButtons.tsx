"use client";

import { useState, useTransition } from "react";
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

/** Publish (draft), Hide (published) or Unhide (hidden). Buttons only, never a status dropdown. */
export function ContentStatusButtons({ kind, id, status }: Props) {
    const router = useRouter();
    const [pending, startTransition] = useTransition();
    const [error, setError] = useState<string | null>(null);

    function run(action: "publish" | "hide" | "unhide") {
        setError(null);
        startTransition(async () => {
            const result =
                kind === "service"
                    ? await (action === "publish" ? publishService(id) : action === "hide" ? hideService(id) : unhideService(id))
                    : await (action === "publish" ? publishPortfolio(id) : action === "hide" ? hidePortfolio(id) : unhidePortfolio(id));
            if ("error" in result) {
                setError(contentErrorMessage(result.error));
                return;
            }
            router.refresh();
        });
    }

    return (
        <div className="flex flex-col items-end gap-1">
            {status === "draft" && (
                <Button size="sm" disabled={pending} onClick={() => run("publish")}>
                    Publish
                </Button>
            )}
            {status === "published" && (
                <Button size="sm" variant="outline" disabled={pending} onClick={() => run("hide")}>
                    Hide
                </Button>
            )}
            {status === "hidden" && (
                <Button size="sm" variant="outline" disabled={pending} onClick={() => run("unhide")}>
                    Unhide
                </Button>
            )}
            {error && (
                <p role="alert" className="max-w-xs text-right text-xs text-destructive">
                    {error}
                </p>
            )}
        </div>
    );
}
