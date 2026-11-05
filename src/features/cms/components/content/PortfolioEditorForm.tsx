"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createPortfolio, publishPortfolio, updatePortfolio } from "@/features/cms/content/portfolio.actions";
import { DEFAULT_CLIENT_DISPLAY_NAME, LIMITS } from "@/features/cms/content/schemas";
import { ContentImageField } from "./ContentImageField";
import { contentErrorMessage } from "./ContentStatusButtons";

export type PortfolioFormValues = {
    id: string;
    title: string;
    serviceId: string | null;
    summary: string;
    /** Legacy full text. It is sent back unchanged so saving never erases it. */
    content: string | null;
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
        <span className={over ? "text-xs text-destructive" : "text-xs text-muted-foreground"}>
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
                content: project?.content ?? undefined,
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

    return (
        <form
            className="space-y-6 rounded-xl border border-border p-6"
            onSubmit={(event) => {
                event.preventDefault();
                save(false);
            }}
        >
            {project && <Badge variant="outline" className="capitalize">{project.status}</Badge>}

            <div className="space-y-2">
                <div className="flex items-baseline justify-between">
                    <Label htmlFor="portfolio-title">Project title</Label>
                    <Counter value={title} max={LIMITS.portfolio.title} />
                </div>
                <Input id="portfolio-title" value={title} onChange={(e) => setTitle(e.target.value)} />
                {fieldError("title") && <p role="alert" className="text-xs text-destructive">{fieldError("title")}</p>}
            </div>

            <div className="space-y-2">
                <Label htmlFor="portfolio-service">Service</Label>
                <select
                    id="portfolio-service"
                    className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                    value={serviceId}
                    onChange={(e) => setServiceId(e.target.value)}
                >
                    <option value="">Pick a service</option>
                    {services.map((service) => (
                        <option key={service.id} value={service.id}>
                            {service.status === "published" ? service.title : `${service.title} (${service.status})`}
                        </option>
                    ))}
                </select>
                <p className="text-xs text-muted-foreground">Picked from the Services list. Required to publish.</p>
                {fieldError("serviceId") && (
                    <p role="alert" className="text-xs text-destructive">{fieldError("serviceId")}</p>
                )}
            </div>

            <fieldset className="space-y-3 rounded-lg border border-border p-4">
                <legend className="px-1 text-sm font-medium">Client</legend>
                <div className="space-y-2">
                    <Label htmlFor="portfolio-display-name">Client shown as</Label>
                    <Input
                        id="portfolio-display-name"
                        value={clientDisplayName}
                        placeholder={DEFAULT_CLIENT_DISPLAY_NAME}
                        onChange={(e) => setClientDisplayName(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">
                        {"Use a general name, e.g. “A logistics company”, if the client did not agree. Empty uses “"}
                        {DEFAULT_CLIENT_DISPLAY_NAME}
                        {"”."}
                    </p>
                    {fieldError("clientDisplayName") && (
                        <p role="alert" className="text-xs text-destructive">{fieldError("clientDisplayName")}</p>
                    )}
                </div>
                <div className="flex items-center gap-2">
                    <Checkbox id="portfolio-consent" checked={clientConsent} onCheckedChange={setClientConsent} />
                    <Label htmlFor="portfolio-consent">The client agreed to be named on our website</Label>
                </div>
                <div className="space-y-2">
                    <Label htmlFor="portfolio-client-name">Real client name (private)</Label>
                    <Input
                        id="portfolio-client-name"
                        value={clientName}
                        onChange={(e) => setClientName(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">
                        Visitors only see this when the box above is ticked. Otherwise they see the name shown above.
                    </p>
                    {fieldError("clientName") && (
                        <p role="alert" className="text-xs text-destructive">{fieldError("clientName")}</p>
                    )}
                </div>
            </fieldset>

            <div className="space-y-2">
                <div className="flex items-baseline justify-between">
                    <Label htmlFor="portfolio-summary">Summary</Label>
                    <Counter value={summary} max={LIMITS.portfolio.summary} />
                </div>
                <Textarea id="portfolio-summary" rows={4} value={summary} onChange={(e) => setSummary(e.target.value)} />
                {fieldError("summary") && <p role="alert" className="text-xs text-destructive">{fieldError("summary")}</p>}
                {fieldError("content") && (
                    <p role="alert" className="text-xs text-destructive">
                        {"The older full description of this project can't be saved as it is: "}
                        {fieldError("content")}
                    </p>
                )}
            </div>

            <ContentImageField
                label="Images"
                value={images}
                onChange={setImages}
                max={LIMITS.portfolio.images}
                error={fieldError("galleryImages") ?? fieldError("coverImage")}
            />

            <div className="space-y-2">
                <Label htmlFor="portfolio-live-url">Live link (optional)</Label>
                <Input
                    id="portfolio-live-url"
                    type="url"
                    placeholder="https://"
                    value={liveUrl}
                    onChange={(e) => setLiveUrl(e.target.value)}
                />
                {fieldError("liveUrl") && <p role="alert" className="text-xs text-destructive">{fieldError("liveUrl")}</p>}
            </div>

            <div className="space-y-2">
                <Label htmlFor="portfolio-technologies">Technologies</Label>
                <Input
                    id="portfolio-technologies"
                    value={technologies}
                    placeholder="Next.js, PostgreSQL"
                    onChange={(e) => setTechnologies(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">Separate with commas.</p>
                {fieldError("technologies") && (
                    <p role="alert" className="text-xs text-destructive">{fieldError("technologies")}</p>
                )}
            </div>

            <div className="space-y-2">
                <Label htmlFor="portfolio-order">Order on the website</Label>
                <Input
                    id="portfolio-order"
                    type="number"
                    min={0}
                    max={9999}
                    className="w-32"
                    value={sortOrder}
                    onChange={(e) => setSortOrder(e.target.value)}
                />
                {fieldError("sortOrder") && (
                    <p role="alert" className="text-xs text-destructive">{fieldError("sortOrder")}</p>
                )}
            </div>

            {error && (
                <p role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
                    {error}
                </p>
            )}

            <div className="flex flex-wrap items-center gap-3">
                {isDraftOrNew ? (
                    <>
                        <Button type="button" disabled={pending} onClick={() => save(true)}>
                            Publish
                        </Button>
                        <Button type="submit" variant="outline" disabled={pending}>
                            Save draft
                        </Button>
                    </>
                ) : (
                    <Button type="submit" disabled={pending}>
                        Save changes
                    </Button>
                )}
                <Button asChild variant="ghost">
                    <Link href="/dashboard/portfolio">Cancel</Link>
                </Button>
            </div>
        </form>
    );
}
