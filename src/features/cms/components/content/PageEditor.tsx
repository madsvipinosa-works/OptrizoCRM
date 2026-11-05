"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { publishPage, saveDraft } from "@/features/cms/content/pages.actions";
import type { PageSlugValue } from "@/features/cms/content/schemas";
import { contentErrorMessage } from "./ContentStatusButtons";
import {
    AboutSection,
    ContactSection,
    HomeSection,
    normalizeFields,
    PlainFieldsView,
    type AboutValues,
    type ContactValues,
    type FeatureOption,
    type HomeValues,
    type PageValues,
} from "./PageFields";

/** Plain-language text for page error codes. Falls back to the shared content messages. */
export function pageErrorMessage(error: string): string {
    switch (error) {
        case "CONFLICT":
            return "Someone else changed this page. Reload the page to see the latest version, then try again.";
        case "DRAFT_EXISTS":
            return "There is an unpublished draft. Tick “Discard my unpublished draft” to restore over it.";
        case "NO_DRAFT":
            return "There is nothing to publish.";
        case "FEATURED_NOT_PUBLISHED":
            return "A featured service or project is no longer published. Untick it and try again.";
        case "VERSION_NOT_FOUND":
            return "That version no longer exists.";
        case "INVALID_SLUG":
            return "Unknown page.";
        default:
            return contentErrorMessage(error);
    }
}

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
    /** `pages.version`. Sent as `baseVersion` on every save and publish. */
    version: number;
    /** A saved, unpublished draft exists on the server. */
    hasDraft: boolean;
    /** The draft when there is one, otherwise the live fields. */
    initialFields: Record<string, unknown>;
    publishedAt: string | null;
    publishedByName: string | null;
    services: FeatureOption[];
    portfolio: FeatureOption[];
    /** id to title, for the Preview panel. */
    titles: Record<string, string>;
};

export function PageEditor({
    slug,
    version,
    hasDraft,
    initialFields,
    publishedAt,
    publishedByName,
    services,
    portfolio,
    titles,
}: Props) {
    const router = useRouter();
    const [pending, startTransition] = useTransition();
    const baseline = useMemo(() => JSON.stringify(normalizeFields(slug, initialFields)), [slug, initialFields]);
    const [values, setValues] = useState<PageValues>(() => normalizeFields(slug, initialFields));
    const [showPreview, setShowPreview] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [notice, setNotice] = useState<string | null>(null);
    const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

    const dirty = JSON.stringify(values) !== baseline;
    const hasUnpublished = hasDraft || dirty;

    function fail(result: { error: string; fieldErrors?: Record<string, string> }) {
        setError(pageErrorMessage(result.error));
        setFieldErrors(result.fieldErrors ?? {});
    }

    function save() {
        setError(null);
        setNotice(null);
        setFieldErrors({});
        startTransition(async () => {
            const saved = await saveDraft(slug, values, version);
            if ("error" in saved) return fail(saved);
            setNotice("Draft saved. Visitors do not see it until you publish.");
            router.refresh();
        });
    }

    function publish() {
        setError(null);
        setNotice(null);
        setFieldErrors({});
        startTransition(async () => {
            if (dirty) {
                const saved = await saveDraft(slug, values, version);
                if ("error" in saved) return fail(saved);
            }
            const published = await publishPage(slug, version);
            if ("error" in published) {
                if (dirty) setNotice("Your changes were saved as a draft, but not published.");
                return fail(published);
            }
            setNotice("Published.");
            router.refresh();
        });
    }

    return (
        <div className="space-y-6 rounded-xl border border-border p-6">
            <p className="text-sm text-muted-foreground">
                {publishedAt
                    ? `Last published ${manilaDateTime.format(new Date(publishedAt))}${publishedByName ? ` by ${publishedByName}` : ""}`
                    : "Not published yet"}
                {" · "}
                {hasUnpublished ? "you have unpublished changes" : "no unpublished changes"}
            </p>

            {slug === "home" && (
                <HomeSection
                    values={values as HomeValues}
                    onChange={setValues}
                    errors={fieldErrors}
                    services={services}
                    portfolio={portfolio}
                />
            )}
            {slug === "about" && <AboutSection values={values as AboutValues} onChange={setValues} errors={fieldErrors} />}
            {slug === "contact" && (
                <ContactSection values={values as ContactValues} onChange={setValues} errors={fieldErrors} />
            )}

            {error && (
                <p role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
                    {error}
                </p>
            )}
            {notice && (
                <p role="status" className="rounded-md border border-border bg-muted/40 p-3 text-sm">
                    {notice}
                </p>
            )}

            <div className="flex flex-wrap items-center gap-3">
                <Button type="button" variant="outline" onClick={() => setShowPreview((on) => !on)}>
                    {showPreview ? "Hide preview" : "Preview"}
                </Button>
                <Button type="button" variant="outline" disabled={pending || !dirty} onClick={save}>
                    Save draft
                </Button>
                <Button type="button" disabled={pending || !hasUnpublished} onClick={publish}>
                    Publish
                </Button>
            </div>

            {showPreview && (
                <div className="space-y-3 rounded-lg border border-dashed border-border p-4">
                    <p className="text-sm font-medium">Preview of your current edits (not published)</p>
                    <PlainFieldsView slug={slug} fields={values} titles={titles} />
                </div>
            )}
        </div>
    );
}
