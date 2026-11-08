"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { SaveBar, formFields, sheet } from "./cms-ui";
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
        <div>
            <div className={`${sheet} ${formFields}`}>
                {slug === "home" && (
                    <HomeSection values={values as HomeValues} onChange={setValues} errors={fieldErrors} services={services} portfolio={portfolio} />
                )}
                {slug === "about" && <AboutSection values={values as AboutValues} onChange={setValues} errors={fieldErrors} />}
                {slug === "contact" && <ContactSection values={values as ContactValues} onChange={setValues} errors={fieldErrors} />}
            </div>

            {error && <p role="alert" className="mt-4 rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</p>}
            {notice && <p role="status" className="composer-enter mt-4 rounded-xl bg-brand-soft px-4 py-3 text-sm text-brand-deep">{notice}</p>}

            {showPreview && (
                <section aria-label="Preview of your edits" className={`${sheet} composer-enter mt-4 space-y-3 p-5 sm:p-6`}>
                    <h2 className="text-base font-semibold text-foreground">Preview of your edits</h2>
                    <p className="text-sm text-muted-foreground">Not published yet. This is the text visitors will see.</p>
                    <PlainFieldsView slug={slug} fields={values} titles={titles} />
                </section>
            )}

            {/* Mockup C7: status on the left, actions on the right; floats while you scroll the long pages. */}
            <SaveBar
                status={
                    <>
                        {publishedAt
                            ? `Last published ${manilaDateTime.format(new Date(publishedAt))}${publishedByName ? ` by ${publishedByName}` : ""}`
                            : "Not published yet"}
                        {" · "}
                        <span className={hasUnpublished ? "font-medium text-foreground" : undefined}>
                            {dirty ? "unsaved edits" : hasUnpublished ? "draft not published" : "no unpublished changes"}
                        </span>
                    </>
                }
            >
                <Button type="button" variant="ghost" className="h-9 active:scale-[0.97]" aria-expanded={showPreview} onClick={() => setShowPreview((on) => !on)}>
                    {showPreview ? "Hide preview" : "Preview"}
                </Button>
                <Button type="button" variant="outline" className="h-9 bg-card active:scale-[0.97]" disabled={pending || !dirty} onClick={save}>
                    Save draft
                </Button>
                <Button type="button" className="h-9 font-semibold active:scale-[0.97]" disabled={pending || !hasUnpublished} onClick={publish}>
                    Publish
                </Button>
            </SaveBar>
        </div>
    );
}
