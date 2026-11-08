"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createService, publishService, updateService } from "@/features/cms/content/services.actions";
import { LIMITS } from "@/features/cms/content/schemas";
import { Check } from "lucide-react";
import { ContentImageField } from "./ContentImageField";
import { FormSection, SaveBar, formFields, sheet } from "./cms-ui";
import { ContentStatusChip, contentErrorMessage } from "./ContentStatusButtons";

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

// Shown only near the limit, so a fresh form is not covered in "0 / 40".
function Counter({ value, max }: { value: string; max: number }) {
    if (value.length < max * 0.8) return null;
    return (
        <span className={`text-sm tabular-nums ${value.length > max ? "text-destructive" : "text-muted-foreground"}`}>
            {value.length} / {max}
        </span>
    );
}

/** Mockup C3: the form, and a live preview of the Services page card and the inquiry form's list. */
export function ServiceEditorForm({ service, inquiryList = [] }: { service?: ServiceFormValues; inquiryList?: string[] }) {
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
    const items = inclusions.split("\n").map((line) => line.trim()).filter(Boolean);
    const err = (name: string) =>
        fieldError(name) ? <p role="alert" className="text-sm text-destructive">{fieldError(name)}</p> : null;

    return (
        <form
            className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]"
            onSubmit={(event) => {
                event.preventDefault();
                save(false);
            }}
        >
            <div className="min-w-0">
                <div className={`${sheet} ${formFields}`}>
                    <FormSection title="Basics">
                        <div className="grid gap-x-4 gap-y-5 sm:grid-cols-[minmax(0,1fr)_9rem]">
                            <div className="space-y-2">
                                <div className="flex items-baseline justify-between">
                                    <Label htmlFor="service-title">Service name</Label>
                                    <Counter value={title} max={LIMITS.service.title} />
                                </div>
                                <Input id="service-title" value={title} onChange={(e) => setTitle(e.target.value)} />
                                {err("title")}
                            </div>
                            <div className="space-y-2">
                                <div className="flex items-baseline justify-between">
                                    <Label htmlFor="service-order">Order</Label>
                                </div>
                                <Input id="service-order" type="number" min={0} max={9999} className="tabular-nums" value={order} onChange={(e) => setOrder(e.target.value)} />
                                {err("order")}
                            </div>
                        </div>
                        <div className="space-y-2">
                            <div className="flex items-baseline justify-between">
                                <Label htmlFor="service-description">Short description</Label>
                                <Counter value={description} max={LIMITS.service.description} />
                            </div>
                            <Input id="service-description" value={description} onChange={(e) => setDescription(e.target.value)} />
                            {err("description")}
                        </div>
                    </FormSection>

                    <FormSection title="What's included" description={`One item per line, up to ${LIMITS.service.inclusionItems}.`}>
                        <div className="space-y-2">
                            <Label htmlFor="service-inclusions" className="sr-only">{"What's included"}</Label>
                            <Textarea id="service-inclusions" rows={5} value={inclusions} onChange={(e) => setInclusions(e.target.value)} placeholder={"Domain registration or transfer\nHosting setup and SSL"} />
                            {err("inclusions")}
                        </div>
                    </FormSection>

                    <FormSection title="Image">
                        <ContentImageField label="Image" labelHidden value={images} onChange={setImages} max={1} error={fieldError("image")} />
                    </FormSection>

                    <FormSection title="Where it shows" description="No price field: prices are agreed per project in the proposal.">
                        <div className="space-y-3">
                            <div className="flex items-center gap-2.5">
                                <Checkbox id="service-show-services" checked={showOnServicesPage} onCheckedChange={setShowOnServicesPage} />
                                <Label htmlFor="service-show-services" className="font-normal">Show on the Services page</Label>
                            </div>
                            <div className="flex items-center gap-2.5">
                                <Checkbox id="service-show-inquiry" checked={showInInquiry} onCheckedChange={setShowInInquiry} />
                                <Label htmlFor="service-show-inquiry" className="font-normal">Show in the inquiry form</Label>
                            </div>
                        </div>
                    </FormSection>
                </div>

                {error && <p role="alert" className="mt-4 rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</p>}

                <SaveBar
                    status={
                        service ? (
                            <span className="flex items-center gap-2">
                                <ContentStatusChip status={service.status} />
                                {service.isPreset && <span>Preset service</span>}
                            </span>
                        ) : (
                            "New service · saved as a draft until you publish"
                        )
                    }
                >
                    <Button asChild variant="ghost" className="h-9 active:scale-[0.97]">
                        <Link href="/dashboard/services">Cancel</Link>
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
            </div>

            {/* Taste §8.2 "show what the setting produces": the card and the inquiry list, live. */}
            <aside aria-label="Live preview" className="space-y-5 lg:sticky lg:top-6">
                <section className="space-y-2">
                    <h2 className="text-sm text-muted-foreground">Preview</h2>
                    <div className={`${sheet} overflow-hidden`}>
                        <div className="relative aspect-[16/9] bg-muted">
                            {images[0] && (
                                // eslint-disable-next-line @next/next/no-img-element -- uploaded content image, not optimised here
                                <img src={images[0]} alt="" className="absolute inset-0 size-full object-cover" />
                            )}
                        </div>
                        <div className="p-4">
                            <p className="text-lg font-semibold tracking-tight text-foreground">{title.trim() || "Service name"}</p>
                            <p className="mt-0.5 text-sm text-muted-foreground">{description.trim() || "Short description"}</p>
                            {items.length > 0 && (
                                <ul className="mt-3 space-y-1 text-sm text-foreground">
                                    {items.map((item, idx) => (
                                        <li key={`${item}-${idx}`} className="flex gap-2">
                                            <Check className="mt-0.5 size-4 shrink-0 text-brand-deep" aria-hidden="true" />
                                            {item}
                                        </li>
                                    ))}
                                </ul>
                            )}
                            <span aria-hidden="true" className="mt-4 inline-flex h-9 items-center rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground">
                                Request this service
                            </span>
                        </div>
                    </div>
                    {!showOnServicesPage && <p className="text-sm text-muted-foreground">Hidden from the Services page.</p>}
                </section>

                <p className="text-sm text-muted-foreground">
                    {showInInquiry ? (
                        <>
                            Shows in the inquiry form as <span className="font-medium text-foreground">&ldquo;{title.trim() || "Service name"}&rdquo;</span>
                            {inquiryList.length > 0 && `, after ${inquiryList.length} other service${inquiryList.length === 1 ? "" : "s"}`}.
                        </>
                    ) : (
                        "Not in the inquiry form."
                    )}
                </p>
            </aside>
        </form>
    );
}
