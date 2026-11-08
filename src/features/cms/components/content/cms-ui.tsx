import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

/*
 * Content editor look (taste: app screens, "framed sheet"; Optrizo font and palette kept).
 * The app ground is Optrizo's green-grey; work sits on one white sheet, 16px corners, a 1px edge, no shadow.
 * The green fill is kept for the one primary action per screen; everything else in the chrome is grey.
 */

export const sheet = "rounded-2xl border border-border bg-card";

/** 40px fields in forms (taste: 38-40px), one control height per context. */
export const formFields = "[&_[data-slot=input]]:h-10 [&_[data-slot=select-trigger]]:h-10";

export function CmsPageHeader({
    title,
    description,
    back,
    meta,
    actions,
}: {
    title: ReactNode;
    description?: ReactNode;
    back?: { href: string; label: string };
    meta?: ReactNode;
    actions?: ReactNode;
}) {
    return (
        <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
            <div className="min-w-0">
                {back && (
                    <Link
                        href={back.href}
                        className="group mb-2 inline-flex items-center gap-1 rounded-md text-sm text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
                    >
                        <ArrowLeft className="size-3.5 transition-transform duration-200 ease-out group-hover:-translate-x-0.5" aria-hidden="true" />
                        {back.label}
                    </Link>
                )}
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <h1 className="text-2xl font-semibold tracking-tight text-foreground [text-wrap:balance]">{title}</h1>
                    {meta}
                </div>
                {description && <p className="mt-1 max-w-[70ch] text-sm text-muted-foreground">{description}</p>}
            </div>
            {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
        </header>
    );
}

/** One titled block of a form: the title (and a rule, if any) above full-width fields. */
export function FormSection({ title, description, children }: { title: string; description?: ReactNode; children: ReactNode }) {
    return (
        <section className="space-y-4 border-t border-border px-5 py-6 first:border-t-0 sm:px-6">
            <div>
                <h2 className="text-base font-semibold text-foreground">{title}</h2>
                {description && <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>}
            </div>
            <div className="min-w-0 space-y-5">{children}</div>
        </section>
    );
}

/** Floats over the form while you scroll, so Save and Publish are always one click away. */
export function SaveBar({ status, children }: { status?: ReactNode; children: ReactNode }) {
    return (
        <div className="sticky bottom-4 z-20 mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3 shadow-[0_8px_24px_-12px_rgb(0_0_0/0.18)]">
            <div className="min-w-0 text-sm text-muted-foreground">{status}</div>
            <div className="flex flex-wrap items-center gap-2">{children}</div>
        </div>
    );
}
