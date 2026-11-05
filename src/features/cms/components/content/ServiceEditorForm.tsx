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
import { createService, publishService, updateService } from "@/features/cms/content/services.actions";
import { LIMITS } from "@/features/cms/content/schemas";
import { ContentImageField } from "./ContentImageField";
import { contentErrorMessage } from "./ContentStatusButtons";

export type ServiceFormValues = {
    id: string;
    title: string;
    description: string;
    inclusions: string[];
    image: string | null;
    showOnServicesPage: boolean;
    showInInquiry: boolean;
    order: number | null;
    status: "draft" | "published" | "hidden";
    isPreset: boolean;
};

function Counter({ value, max }: { value: string; max: number }) {
    const over = value.length > max;
    return (
        <span className={over ? "text-xs text-destructive" : "text-xs text-muted-foreground"}>
            {value.length} / {max}
        </span>
    );
}

export function ServiceEditorForm({ service }: { service?: ServiceFormValues }) {
    const router = useRouter();
    const [pending, startTransition] = useTransition();
    const [title, setTitle] = useState(service?.title ?? "");
    const [description, setDescription] = useState(service?.description ?? "");
    const [inclusions, setInclusions] = useState((service?.inclusions ?? []).join("\n"));
    const [images, setImages] = useState<string[]>(service?.image ? [service.image] : []);
    const [showOnServicesPage, setShowOnServicesPage] = useState(service?.showOnServicesPage ?? true);
    const [showInInquiry, setShowInInquiry] = useState(service?.showInInquiry ?? true);
    const [order, setOrder] = useState(service?.order != null ? String(service.order) : "");
    const [error, setError] = useState<string | null>(null);
    const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

    const fieldError = (name: string) => {
        const key = Object.keys(fieldErrors).find((k) => k === name || k.startsWith(`${name}.`));
        return key ? fieldErrors[key] : undefined;
    };

    function save(thenPublish: boolean) {
        setError(null);
        setFieldErrors({});
        startTransition(async () => {
            const payload = {
                title,
                description,
                inclusions,
                image: images[0] ?? null,
                showOnServicesPage,
                showInInquiry,
                ...(order.trim() !== "" ? { order: Number(order) } : {}),
            };
            const saved = service ? await updateService(service.id, payload) : await createService(payload);
            if ("error" in saved) {
                setError(contentErrorMessage(saved.error));
                setFieldErrors(saved.fieldErrors ?? {});
                return;
            }
            if (thenPublish && saved.status === "draft") {
                const published = await publishService(saved.id);
                if ("error" in published) {
                    setError(`Saved as a draft, but not published. ${contentErrorMessage(published.error)}`);
                    if (!service) router.replace(`/dashboard/services/${saved.id}`);
                    return;
                }
            }
            router.push("/dashboard/services");
            router.refresh();
        });
    }

    const isDraftOrNew = !service || service.status === "draft";

    return (
        <form
            className="space-y-6 rounded-xl border border-border p-6"
            onSubmit={(event) => {
                event.preventDefault();
                save(false);
            }}
        >
            {service && (
                <div className="flex items-center gap-2">
                    <Badge variant="outline" className="capitalize">{service.status}</Badge>
                    {service.isPreset && <Badge variant="secondary">Preset</Badge>}
                </div>
            )}

            <div className="space-y-2">
                <div className="flex items-baseline justify-between">
                    <Label htmlFor="service-title">Service name</Label>
                    <Counter value={title} max={LIMITS.service.title} />
                </div>
                <Input id="service-title" value={title} onChange={(e) => setTitle(e.target.value)} />
                {fieldError("title") && <p role="alert" className="text-xs text-destructive">{fieldError("title")}</p>}
            </div>

            <div className="space-y-2">
                <Label htmlFor="service-order">Order on the website</Label>
                <Input
                    id="service-order"
                    type="number"
                    min={0}
                    max={9999}
                    className="w-32"
                    value={order}
                    onChange={(e) => setOrder(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">Lower numbers come first. Leave empty to keep the current place.</p>
                {fieldError("order") && <p role="alert" className="text-xs text-destructive">{fieldError("order")}</p>}
            </div>

            <div className="space-y-2">
                <div className="flex items-baseline justify-between">
                    <Label htmlFor="service-description">Short description</Label>
                    <Counter value={description} max={LIMITS.service.description} />
                </div>
                <Input id="service-description" value={description} onChange={(e) => setDescription(e.target.value)} />
                <p className="text-xs text-muted-foreground">Shown on the service card and in the inquiry form.</p>
                {fieldError("description") && (
                    <p role="alert" className="text-xs text-destructive">{fieldError("description")}</p>
                )}
            </div>

            <div className="space-y-2">
                <Label htmlFor="service-inclusions">{"What's included"}</Label>
                <Textarea
                    id="service-inclusions"
                    rows={5}
                    value={inclusions}
                    onChange={(e) => setInclusions(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                    One item per line, up to {LIMITS.service.inclusionItems} items. Plain text only.
                </p>
                {fieldError("inclusions") && (
                    <p role="alert" className="text-xs text-destructive">{fieldError("inclusions")}</p>
                )}
            </div>

            <ContentImageField label="Image" value={images} onChange={setImages} max={1} error={fieldError("image")} />

            <div className="space-y-3">
                <div className="flex items-center gap-2">
                    <Checkbox
                        id="service-show-services"
                        checked={showOnServicesPage}
                        onCheckedChange={setShowOnServicesPage}
                    />
                    <Label htmlFor="service-show-services">Show on the Services page</Label>
                </div>
                <div className="flex items-center gap-2">
                    <Checkbox id="service-show-inquiry" checked={showInInquiry} onCheckedChange={setShowInInquiry} />
                    <Label htmlFor="service-show-inquiry">Show in the inquiry form</Label>
                </div>
                <p className="text-xs text-muted-foreground">
                    No price field: prices are agreed per project in the proposal.
                </p>
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
                    <Link href="/dashboard/services">Cancel</Link>
                </Button>
            </div>
        </form>
    );
}
