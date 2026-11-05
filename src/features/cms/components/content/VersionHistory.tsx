"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { restoreVersion } from "@/features/cms/content/pages.actions";
import type { PageSlugValue } from "@/features/cms/content/schemas";
import { pageErrorMessage } from "./PageEditor";
import { PlainFieldsView } from "./PageFields";

export type VersionItem = {
    versionNo: number;
    action: "publish" | "restore";
    restoredFrom: number | null;
    authorName: string | null;
    createdAt: string;
    fields: Record<string, unknown>;
};

const manilaDateTime = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Manila",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
});

type Props = {
    slug: PageSlugValue;
    /** `pages.version`: the live version, sent as `baseVersion` when restoring. */
    currentVersion: number;
    /** A saved, unpublished draft exists. Restoring needs an explicit discard. */
    hasDraft: boolean;
    versions: VersionItem[];
    titles: Record<string, string>;
};

export function VersionHistory({ slug, currentVersion, hasDraft, versions, titles }: Props) {
    const router = useRouter();
    const [pending, startTransition] = useTransition();
    const [viewing, setViewing] = useState<number | null>(null);
    const [confirming, setConfirming] = useState<number | null>(null);
    const [discard, setDiscard] = useState(false);
    const [error, setError] = useState<string | null>(null);

    function restore(versionNo: number) {
        setError(null);
        startTransition(async () => {
            const result = await restoreVersion(slug, versionNo, currentVersion, hasDraft ? discard : undefined);
            if ("error" in result) {
                setError(pageErrorMessage(result.error));
                return;
            }
            setConfirming(null);
            setDiscard(false);
            router.refresh();
        });
    }

    return (
        <section className="space-y-3 rounded-xl border border-border p-6">
            <div>
                <h2 className="text-lg font-semibold">Version history</h2>
                <p className="text-sm text-muted-foreground">
                    Every publish is saved. You can restore an older version: it goes live right away as a new version.
                </p>
            </div>

            {error && (
                <p role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
                    {error}
                </p>
            )}

            {versions.length === 0 ? (
                <p className="text-sm text-muted-foreground">No versions yet.</p>
            ) : (
                <ul className="divide-y divide-border rounded-lg border border-border">
                    {versions.map((item) => {
                        const isLive = item.versionNo === currentVersion;
                        return (
                            <li key={item.versionNo} className="space-y-3 px-4 py-3 text-sm">
                                <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                                    <span className="font-mono font-medium">v{item.versionNo}</span>
                                    <Badge variant={item.action === "publish" ? "secondary" : "outline"}>
                                        {item.action === "publish"
                                            ? "Published"
                                            : `Restored from v${item.restoredFrom ?? "?"}`}
                                    </Badge>
                                    {isLive && <Badge>Live</Badge>}
                                    <span className="text-muted-foreground">
                                        {item.authorName ?? "Unknown user"} · {manilaDateTime.format(new Date(item.createdAt))}
                                    </span>
                                    <span className="ml-auto flex gap-2">
                                        <Button
                                            type="button"
                                            size="sm"
                                            variant="ghost"
                                            onClick={() => setViewing(viewing === item.versionNo ? null : item.versionNo)}
                                        >
                                            {viewing === item.versionNo ? "Close" : "View"}
                                        </Button>
                                        {!isLive && (
                                            <Button
                                                type="button"
                                                size="sm"
                                                variant="outline"
                                                disabled={pending}
                                                onClick={() => {
                                                    setError(null);
                                                    setDiscard(false);
                                                    setConfirming(confirming === item.versionNo ? null : item.versionNo);
                                                }}
                                            >
                                                Restore
                                            </Button>
                                        )}
                                    </span>
                                </div>

                                {confirming === item.versionNo && (
                                    <div className="space-y-3 rounded-md border border-border bg-muted/30 p-3">
                                        <p>
                                            Restore v{item.versionNo}? It goes live right away and is saved as a new
                                            version. The current live version stays in the history.
                                        </p>
                                        {hasDraft && (
                                            <div className="flex items-center gap-2">
                                                <Checkbox
                                                    id={`discard-${item.versionNo}`}
                                                    checked={discard}
                                                    onCheckedChange={setDiscard}
                                                />
                                                <Label htmlFor={`discard-${item.versionNo}`}>
                                                    Discard my unpublished draft
                                                </Label>
                                            </div>
                                        )}
                                        <div className="flex gap-2">
                                            <Button
                                                type="button"
                                                size="sm"
                                                disabled={pending || (hasDraft && !discard)}
                                                onClick={() => restore(item.versionNo)}
                                            >
                                                Confirm restore
                                            </Button>
                                            <Button type="button" size="sm" variant="ghost" onClick={() => setConfirming(null)}>
                                                Cancel
                                            </Button>
                                        </div>
                                    </div>
                                )}

                                {viewing === item.versionNo && (
                                    <div className="rounded-md border border-dashed border-border p-3">
                                        <PlainFieldsView slug={slug} fields={item.fields} titles={titles} />
                                    </div>
                                )}
                            </li>
                        );
                    })}
                </ul>
            )}
        </section>
    );
}
