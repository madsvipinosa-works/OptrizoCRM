"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createPortfolio, publishPortfolio, updatePortfolio } from "@/features/cms/content/portfolio.actions";
import { DEFAULT_CLIENT_DISPLAY_NAME, LIMITS } from "@/features/cms/content/schemas";
import { ContentImageField } from "./ContentImageField";
import { FormSection, SaveBar, formFields, sheet } from "./cms-ui";
import { ContentStatusChip, contentErrorMessage } from "./ContentStatusButtons";
import { FormSelect } from "@/components/ui/form-select";

export type PortfolioFormValues = {
    id: string;
    title: string;
    serviceId: string | null;
    summary: string;
    images: string[];
    technologies: string[];
    liveUrl: string | null;
    clientName: string | null;
    clientDisplayName: string | null;
    clientConsent: boolean;
    sortOrder: number;
    status: "draft" | "published" | "hidden";
};

export type ServiceOption = { id: string; title: string; status: "draft" | "published" | "hidden" };

function Counter({ value, max }: { value: string; max: number }) {
    const over = value.length > max;
    return (
        <span className={`text-sm tabular-nums ${over ? "text-destructive" : "text-muted-foreground"}`}>
            {value.length} / {max}
        </span>
    );
}

export function PortfolioEditorForm({ project, services }: { project?: PortfolioFormValues; services: ServiceOption[] }) {
    const router = useRouter();
    const [pending, startTransition] = useTransition();
    const [title, setTitle] = useState(project?.title ?? "");
    const [serviceId, setServiceId] = useState(project?.serviceId ?? "");
    const [summary, setSummary] = useState(project?.summary ?? "");
    const [images, setImages] = useState<string[]>(project?.images ?? []);
    const [technologies, setTechnologies] = useState((project?.technologies ?? []).join(", "));
    const [liveUrl, setLiveUrl] = useState(project?.liveUrl ?? "");
    const [clientDisplayName, setClientDisplayName] = useState(project?.clientDisplayName ?? "");
    const [clientName, setClientName] = useState(project?.clientName ?? "");
    const [clientConsent, setClientConsent] = useState(project?.clientConsent ?? false);
    const [sortOrder, setSortOrder] = useState(String(project?.sortOrder ?? 0));
    const [error, setError] = useState<string | null>(null);
    const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

    const fieldError = (name: string) => {
        const key = Object.keys(fieldErrors).find((k) => k === name || k.startsWith(`${name}.`));
        return key ? fieldErrors[key] : undefined;
    };

    /** Mirrors the server's publish rules so the editor gets the reason before saving. */
    function publishBlocker(): string | null {
        if (!serviceId) return contentErrorMessage("SERVICE_REQUIRED");
        if (clientConsent && !clientName.trim()) return contentErrorMessage("CONSENT_REQUIRED");
        return null;
    }

    function save(thenPublish: boolean) {
        setError(null);
        setFieldErrors({});
        if (thenPublish) {
            const blocker = publishBlocker();
            if (blocker) {
                setError(blocker);
                return;
            }
        }
        startTransition(async () => {
            const payload = {
                title,
                serviceId: serviceId || null,
                summary,
                coverImage: images[0] ?? null,
                galleryImages: images.slice(1),
                technologies: technologies
                    .split(",")
                    .map((item) => item.trim())
                    .filter(Boolean),
                liveUrl: liveUrl.trim() || undefined,
                clientName: clientName.trim() || undefined,
                clientDisplayName: clientDisplayName.trim() || undefined,
                clientConsent,
                sortOrder: sortOrder.trim() === "" ? 0 : Number(sortOrder),
            };
            const saved = project ? await updatePortfolio(project.id, payload) : await createPortfolio(payload);
            if ("error" in saved) {
                setError(contentErrorMessage(saved.error));
                setFieldErrors(saved.fieldErrors ?? {});
                return;
            }
            if (thenPublish && saved.status === "draft") {
                const published = await publishPortfolio(saved.id);
                if ("error" in published) {
                    setError(`Saved as a draft, but not published. ${contentErrorMessage(published.error)}`);
                    if (!project) router.replace(`/dashboard/portfolio/${saved.id}`);
                    return;
                }
            }
            router.push("/dashboard/portfolio");
            router.refresh();
        });
    }

    const isDraftOrNew = !project || project.status === "draft";
    const err = (name: string) =>
        fieldError(name) ? <p role="alert" className="text-sm text-destructive">{fieldError(name)}</p> : null;

    // Mockup C6 content in the taste "framed sheet" look: titled sections, one sheet, a floating save bar.
    return (
        <form
            className="max-w-4xl"
            onSubmit={(event) => {
                event.preventDefault();
                save(false);
            }}
        >
            <div className={`${sheet} ${formFields}`}>
                <FormSection title="Project" description="A finished project. Nothing here links to the real project records.">
                    <div className="space-y-2">
                        <div className="flex items-baseline justify-between">
                            <Label htmlFor="portfolio-title">Project title</Label>
                            <Counter value={title} max={LIMITS.portfolio.title} />
                        </div>
                        <Input id="portfolio-title" value={title} onChange={(e) => setTitle(e.target.value)} />
                        {err("title")}
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="portfolio-service">Service</Label>
                        <FormSelect id="portfolio-service" value={serviceId} onChange={(e) => setServiceId(e.target.value)}>
                            <option value="">Pick a service</option>
                            {services.map((service) => (
                                <option key={service.id} value={service.id}>
                                    {service.status === "published" ? service.title : `${service.title} (${service.status})`}
                                </option>
                            ))}
                        </FormSelect>
                        {err("serviceId")}
                    </div>
                    <div className="space-y-2">
                        <div className="flex items-baseline justify-between">
                            <Label htmlFor="portfolio-summary">Summary</Label>
                            <Counter value={summary} max={LIMITS.portfolio.summary} />
                        </div>
                        <Textarea id="portfolio-summary" rows={3} value={summary} onChange={(e) => setSummary(e.target.value)} />
                        {err("summary")}
                    </div>
                </FormSection>

                <FormSection title="Client" description="Use a general name, like “A logistics company”, unless the client agreed to be named.">
                    <div className="space-y-2">
                        <Label htmlFor="portfolio-display-name">Client shown as</Label>
                        <Input id="portfolio-display-name" value={clientDisplayName} placeholder={DEFAULT_CLIENT_DISPLAY_NAME} onChange={(e) => setClientDisplayName(e.target.value)} />
                        {err("clientDisplayName")}
                    </div>
                    <div className="flex items-center gap-2.5">
                        <Checkbox id="portfolio-consent" checked={clientConsent} onCheckedChange={setClientConsent} />
                        <Label htmlFor="portfolio-consent" className="font-normal">The client agreed to be named on our website</Label>
                    </div>
                    {clientConsent && (
                        <div className="composer-enter space-y-2">
                            <Label htmlFor="portfolio-client-name">Real client name</Label>
                            <Input id="portfolio-client-name" value={clientName} onChange={(e) => setClientName(e.target.value)} />
                            <p className="text-sm text-muted-foreground">Shown to visitors because the client agreed. Leave empty to use the name above.</p>
                            {err("clientName")}
                        </div>
                    )}
                </FormSection>

                <FormSection title="Images" description={`Up to ${LIMITS.portfolio.images}. The first one is the cover.`}>
                    <ContentImageField
                        label="Images"
                        labelHidden
                        value={images}
                        onChange={setImages}
                        max={LIMITS.portfolio.images}
                        error={fieldError("galleryImages") ?? fieldError("coverImage")}
                    />
                </FormSection>

                <FormSection title="Details" description="Optional. Shown on the project's page.">
                    <div className="space-y-2">
                        <Label htmlFor="portfolio-live-url">Live link</Label>
                        <Input id="portfolio-live-url" type="url" placeholder="https://" value={liveUrl} onChange={(e) => setLiveUrl(e.target.value)} />
                        {err("liveUrl")}
                    </div>
                    <div className="grid gap-x-4 gap-y-5 sm:grid-cols-[minmax(0,1fr)_9rem]">
                        <div className="space-y-2">
                            <Label htmlFor="portfolio-technologies">Technologies</Label>
                            <Input id="portfolio-technologies" value={technologies} placeholder="Next.js, PostgreSQL" onChange={(e) => setTechnologies(e.target.value)} />
                            <p className="text-sm text-muted-foreground">Separate with commas.</p>
                            {err("technologies")}
                        </div>
                        <div className="space-y-2">
                            <div className="flex items-baseline justify-between">
                                <Label htmlFor="portfolio-order">Order</Label>
                                <span className="text-sm text-muted-foreground">Lower is first</span>
                            </div>
                            <Input id="portfolio-order" type="number" min={0} max={9999} className="tabular-nums" value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} />
                            {err("sortOrder")}
                        </div>
                    </div>
                </FormSection>
            </div>

            {error && <p role="alert" className="mt-4 rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</p>}

            <SaveBar status={project ? <ContentStatusChip status={project.status} /> : "New project · saved as a draft until you publish"}>
                <Button asChild variant="ghost" className="h-9 active:scale-[0.97]">
                    <Link href="/dashboard/portfolio">Cancel</Link>
                </Button>
                {isDraftOrNew ? (
                    <>
                        <Button type="submit" variant="outline" disabled={pending} className="h-9 bg-card active:scale-[0.97]">Save draft</Button>
                        <Button type="button" disabled={pending} onClick={() => save(true)} className="h-9 font-semibold active:scale-[0.97]">Publish</Button>
                    </>
                ) : (
                    <Button type="submit" disabled={pending} className="h-9 font-semibold active:scale-[0.97]">Save changes</Button>
                )}
            </SaveBar>
        </form>
    );
}
