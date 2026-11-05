"use client";

import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { LIMITS, type PageSlugValue } from "@/features/cms/content/schemas";
import { ContentImageField } from "./ContentImageField";

export type TeamMemberValues = { name: string; jobTitle: string; photoUrl: string };
export type HomeValues = {
    heading: string;
    intro: string;
    mainImageUrl: string;
    featuredServiceIds: string[];
    featuredPortfolioIds: string[];
};
export type AboutValues = {
    heading: string;
    story: string;
    mission: string;
    vision: string;
    howWeWork: string;
    team: TeamMemberValues[];
};
export type ContactValues = {
    heading: string;
    intro: string;
    email: string;
    phone: string;
    address: string;
    officeHours: string;
};
export type PageValues = HomeValues | AboutValues | ContactValues;

/** An item the editor can feature. `published` is false for an item that was featured and is no longer published. */
export type FeatureOption = { id: string; title: string; published: boolean };

const str = (value: unknown): string => (typeof value === "string" ? value : "");
const strList = (value: unknown): string[] => (Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : []);

/** Fills every key so a page stored with missing fields still opens in the form. */
export function normalizeFields(slug: PageSlugValue, raw: Record<string, unknown> | null): PageValues {
    const data = raw ?? {};
    if (slug === "home") {
        return {
            heading: str(data.heading),
            intro: str(data.intro),
            mainImageUrl: str(data.mainImageUrl),
            featuredServiceIds: strList(data.featuredServiceIds),
            featuredPortfolioIds: strList(data.featuredPortfolioIds),
        };
    }
    if (slug === "about") {
        const team = Array.isArray(data.team) ? data.team : [];
        return {
            heading: str(data.heading),
            story: str(data.story),
            mission: str(data.mission),
            vision: str(data.vision),
            howWeWork: str(data.howWeWork),
            team: team.map((member) => {
                const m = (member ?? {}) as Record<string, unknown>;
                return { name: str(m.name), jobTitle: str(m.jobTitle), photoUrl: str(m.photoUrl) };
            }),
        };
    }
    return {
        heading: str(data.heading),
        intro: str(data.intro),
        email: str(data.email),
        phone: str(data.phone),
        address: str(data.address),
        officeHours: str(data.officeHours),
    };
}

type Errors = Record<string, string>;

function errorFor(errors: Errors, name: string): string | undefined {
    const key = Object.keys(errors).find((k) => k === name || k.startsWith(`${name}.`));
    return key ? errors[key] : undefined;
}

function Field({
    id,
    label,
    value,
    max,
    error,
    children,
}: {
    id: string;
    label: string;
    value?: string;
    max?: number;
    error?: string;
    children: ReactNode;
}) {
    return (
        <div className="space-y-2">
            <div className="flex items-baseline justify-between">
                <Label htmlFor={id}>{label}</Label>
                {max !== undefined && value !== undefined && (
                    <span className={value.length > max ? "text-xs text-destructive" : "text-xs text-muted-foreground"}>
                        {value.length} / {max}
                    </span>
                )}
            </div>
            {children}
            {error && (
                <p role="alert" className="text-xs text-destructive">
                    {error}
                </p>
            )}
        </div>
    );
}

// ---------------------------------------------------------------------------
// Home (C7)
// ---------------------------------------------------------------------------

function FeaturedPicker({
    legend,
    help,
    options,
    selected,
    onChange,
    error,
}: {
    legend: string;
    help: string;
    options: FeatureOption[];
    selected: string[];
    onChange: (ids: string[]) => void;
    error?: string;
}) {
    const full = selected.length >= LIMITS.home.featured;
    return (
        <fieldset className="space-y-2 rounded-lg border border-border p-4">
            <legend className="px-1 text-sm font-medium">
                {legend}
                <span className="ml-2 text-xs font-normal text-muted-foreground">
                    {selected.length} / {LIMITS.home.featured}
                </span>
            </legend>
            <p className="text-xs text-muted-foreground">{help}</p>
            {options.length === 0 && <p className="text-sm text-muted-foreground">Nothing published yet.</p>}
            {options.map((option) => {
                const checked = selected.includes(option.id);
                return (
                    <div key={option.id} className="flex items-center gap-2">
                        <Checkbox
                            id={`${legend}-${option.id}`}
                            checked={checked}
                            disabled={!checked && full}
                            onCheckedChange={(on) =>
                                onChange(on ? [...selected, option.id] : selected.filter((id) => id !== option.id))
                            }
                        />
                        <Label htmlFor={`${legend}-${option.id}`}>{option.title}</Label>
                        {!option.published && <Badge variant="destructive">no longer published</Badge>}
                    </div>
                );
            })}
            {error && (
                <p role="alert" className="text-xs text-destructive">
                    {error}
                </p>
            )}
        </fieldset>
    );
}

export function HomeSection({
    values,
    onChange,
    errors,
    services,
    portfolio,
}: {
    values: HomeValues;
    onChange: (next: HomeValues) => void;
    errors: Errors;
    services: FeatureOption[];
    portfolio: FeatureOption[];
}) {
    return (
        <div className="space-y-6">
            <Field id="home-heading" label="Main heading" value={values.heading} max={LIMITS.home.heading} error={errorFor(errors, "heading")}>
                <Input id="home-heading" value={values.heading} onChange={(e) => onChange({ ...values, heading: e.target.value })} />
            </Field>
            <Field id="home-intro" label="Short intro" value={values.intro} max={LIMITS.home.intro} error={errorFor(errors, "intro")}>
                <Textarea id="home-intro" rows={3} value={values.intro} onChange={(e) => onChange({ ...values, intro: e.target.value })} />
            </Field>
            <ContentImageField
                label="Main image"
                max={1}
                value={values.mainImageUrl ? [values.mainImageUrl] : []}
                onChange={(urls) => onChange({ ...values, mainImageUrl: urls[0] ?? "" })}
                error={errorFor(errors, "mainImageUrl")}
            />
            <div className="space-y-1">
                <p className="text-sm font-medium">Button</p>
                <div className="flex items-center gap-3">
                    <Button type="button" variant="outline" disabled>
                        Request a service
                    </Button>
                    <span className="text-xs text-muted-foreground">Fixed. It always opens the inquiry form.</span>
                </div>
            </div>
            <FeaturedPicker
                legend="Featured services"
                help="Pick up to 3 from your published services."
                options={services}
                selected={values.featuredServiceIds}
                onChange={(ids) => onChange({ ...values, featuredServiceIds: ids })}
                error={errorFor(errors, "featuredServiceIds")}
            />
            <FeaturedPicker
                legend="Featured portfolio"
                help="Pick up to 3 from your published portfolio projects."
                options={portfolio}
                selected={values.featuredPortfolioIds}
                onChange={(ids) => onChange({ ...values, featuredPortfolioIds: ids })}
                error={errorFor(errors, "featuredPortfolioIds")}
            />
        </div>
    );
}

// ---------------------------------------------------------------------------
// About (C8)
// ---------------------------------------------------------------------------

export function AboutSection({
    values,
    onChange,
    errors,
}: {
    values: AboutValues;
    onChange: (next: AboutValues) => void;
    errors: Errors;
}) {
    const setTeam = (team: TeamMemberValues[]) => onChange({ ...values, team });
    const updateMember = (index: number, patch: Partial<TeamMemberValues>) =>
        setTeam(values.team.map((member, i) => (i === index ? { ...member, ...patch } : member)));
    const move = (index: number, by: -1 | 1) => {
        const target = index + by;
        if (target < 0 || target >= values.team.length) return;
        const next = [...values.team];
        [next[index], next[target]] = [next[target], next[index]];
        setTeam(next);
    };

    return (
        <div className="space-y-6">
            <Field id="about-heading" label="Page heading" value={values.heading} max={LIMITS.about.heading} error={errorFor(errors, "heading")}>
                <Input id="about-heading" value={values.heading} onChange={(e) => onChange({ ...values, heading: e.target.value })} />
            </Field>
            <Field id="about-story" label="Our story" value={values.story} max={LIMITS.about.story} error={errorFor(errors, "story")}>
                <Textarea id="about-story" rows={6} value={values.story} onChange={(e) => onChange({ ...values, story: e.target.value })} />
            </Field>
            <Field id="about-mission" label="Mission" value={values.mission} max={LIMITS.about.mission} error={errorFor(errors, "mission")}>
                <Textarea id="about-mission" rows={3} value={values.mission} onChange={(e) => onChange({ ...values, mission: e.target.value })} />
            </Field>
            <Field id="about-vision" label="Vision" value={values.vision} max={LIMITS.about.vision} error={errorFor(errors, "vision")}>
                <Textarea id="about-vision" rows={3} value={values.vision} onChange={(e) => onChange({ ...values, vision: e.target.value })} />
            </Field>
            <Field id="about-how" label="How we work (one line)" value={values.howWeWork} max={LIMITS.about.howWeWork} error={errorFor(errors, "howWeWork")}>
                <Input id="about-how" value={values.howWeWork} onChange={(e) => onChange({ ...values, howWeWork: e.target.value })} />
            </Field>

            <fieldset className="space-y-4 rounded-lg border border-border p-4">
                <legend className="px-1 text-sm font-medium">
                    Team members shown
                    <span className="ml-2 text-xs font-normal text-muted-foreground">
                        {values.team.length} / {LIMITS.about.team}
                    </span>
                </legend>
                <p className="text-xs text-muted-foreground">
                    Team members here are content, not accounts. Only people who agreed to be shown. Photo, name and job
                    title only.
                </p>
                {errorFor(errors, "team") && !Object.keys(errors).some((k) => k.startsWith("team.")) && (
                    <p role="alert" className="text-xs text-destructive">
                        {errorFor(errors, "team")}
                    </p>
                )}
                {values.team.map((member, index) => (
                    <div key={index} className="space-y-3 rounded-md border border-border p-3">
                        <div className="grid gap-3 sm:grid-cols-2">
                            <Field
                                id={`team-name-${index}`}
                                label="Name"
                                value={member.name}
                                max={LIMITS.about.name}
                                error={errors[`team.${index}.name`]}
                            >
                                <Input
                                    id={`team-name-${index}`}
                                    value={member.name}
                                    onChange={(e) => updateMember(index, { name: e.target.value })}
                                />
                            </Field>
                            <Field
                                id={`team-title-${index}`}
                                label="Job title"
                                value={member.jobTitle}
                                max={LIMITS.about.jobTitle}
                                error={errors[`team.${index}.jobTitle`]}
                            >
                                <Input
                                    id={`team-title-${index}`}
                                    value={member.jobTitle}
                                    onChange={(e) => updateMember(index, { jobTitle: e.target.value })}
                                />
                            </Field>
                        </div>
                        <ContentImageField
                            label="Photo (optional)"
                            max={1}
                            value={member.photoUrl ? [member.photoUrl] : []}
                            onChange={(urls) => updateMember(index, { photoUrl: urls[0] ?? "" })}
                            error={errors[`team.${index}.photoUrl`]}
                        />
                        <div className="flex flex-wrap gap-2">
                            <Button type="button" size="sm" variant="outline" disabled={index === 0} onClick={() => move(index, -1)}>
                                Move up
                            </Button>
                            <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                disabled={index === values.team.length - 1}
                                onClick={() => move(index, 1)}
                            >
                                Move down
                            </Button>
                            <Button type="button" size="sm" variant="ghost" onClick={() => setTeam(values.team.filter((_, i) => i !== index))}>
                                Remove
                            </Button>
                        </div>
                    </div>
                ))}
                <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={values.team.length >= LIMITS.about.team}
                    onClick={() => setTeam([...values.team, { name: "", jobTitle: "", photoUrl: "" }])}
                >
                    + Add member
                </Button>
            </fieldset>
        </div>
    );
}

// ---------------------------------------------------------------------------
// Contact (C9)
// ---------------------------------------------------------------------------

export function ContactSection({
    values,
    onChange,
    errors,
}: {
    values: ContactValues;
    onChange: (next: ContactValues) => void;
    errors: Errors;
}) {
    return (
        <div className="space-y-6">
            <Field id="contact-heading" label="Page heading" value={values.heading} max={LIMITS.contact.heading} error={errorFor(errors, "heading")}>
                <Input id="contact-heading" value={values.heading} onChange={(e) => onChange({ ...values, heading: e.target.value })} />
            </Field>
            <Field id="contact-intro" label="Intro text" value={values.intro} max={LIMITS.contact.intro} error={errorFor(errors, "intro")}>
                <Textarea id="contact-intro" rows={3} value={values.intro} onChange={(e) => onChange({ ...values, intro: e.target.value })} />
            </Field>
            <div className="grid gap-6 sm:grid-cols-2">
                <Field id="contact-email" label="Email" error={errorFor(errors, "email")}>
                    <Input id="contact-email" type="email" value={values.email} onChange={(e) => onChange({ ...values, email: e.target.value })} />
                </Field>
                <Field id="contact-phone" label="Phone" value={values.phone} max={LIMITS.contact.phone} error={errorFor(errors, "phone")}>
                    <Input id="contact-phone" type="tel" value={values.phone} onChange={(e) => onChange({ ...values, phone: e.target.value })} />
                </Field>
            </div>
            <p className="-mt-3 text-xs text-muted-foreground">The email and phone also appear on the inquiry confirmation.</p>
            <Field id="contact-address" label="Office address" value={values.address} max={LIMITS.contact.address} error={errorFor(errors, "address")}>
                <Input id="contact-address" value={values.address} onChange={(e) => onChange({ ...values, address: e.target.value })} />
            </Field>
            <Field id="contact-hours" label="Office hours" value={values.officeHours} max={LIMITS.contact.officeHours} error={errorFor(errors, "officeHours")}>
                <Input id="contact-hours" value={values.officeHours} onChange={(e) => onChange({ ...values, officeHours: e.target.value })} />
            </Field>
        </div>
    );
}

// ---------------------------------------------------------------------------
// Read-only view (Preview panel and version viewer). Plain React text only.
// ---------------------------------------------------------------------------

function Row({ label, children }: { label: string; children: ReactNode }) {
    return (
        <div className="space-y-0.5">
            <p className="text-xs font-mono uppercase tracking-wider text-muted-foreground">{label}</p>
            <div className="whitespace-pre-line text-sm">{children || <span className="text-muted-foreground">(empty)</span>}</div>
        </div>
    );
}

export function PlainFieldsView({
    slug,
    fields,
    titles,
}: {
    slug: PageSlugValue;
    fields: Record<string, unknown> | PageValues | null;
    titles: Record<string, string>;
}) {
    const values = normalizeFields(slug, (fields ?? {}) as Record<string, unknown>);
    const titleList = (ids: string[]) => ids.map((id) => titles[id] ?? "(removed)").join(", ");

    if (slug === "home") {
        const v = values as HomeValues;
        return (
            <div className="space-y-3">
                <Row label="Main heading">{v.heading}</Row>
                <Row label="Short intro">{v.intro}</Row>
                <Row label="Main image">{v.mainImageUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={v.mainImageUrl} alt="" className="h-24 rounded-md border border-border object-cover" />
                )}</Row>
                <Row label="Button">Request a service</Row>
                <Row label="Featured services">{titleList(v.featuredServiceIds)}</Row>
                <Row label="Featured portfolio">{titleList(v.featuredPortfolioIds)}</Row>
            </div>
        );
    }
    if (slug === "about") {
        const v = values as AboutValues;
        return (
            <div className="space-y-3">
                <Row label="Page heading">{v.heading}</Row>
                <Row label="Our story">{v.story}</Row>
                <Row label="Mission">{v.mission}</Row>
                <Row label="Vision">{v.vision}</Row>
                <Row label="How we work">{v.howWeWork}</Row>
                <Row label="Team">
                    {v.team.map((member) => `${member.name}, ${member.jobTitle}`).join("\n")}
                </Row>
            </div>
        );
    }
    const v = values as ContactValues;
    return (
        <div className="space-y-3">
            <Row label="Page heading">{v.heading}</Row>
            <Row label="Intro text">{v.intro}</Row>
            <Row label="Email">{v.email}</Row>
            <Row label="Phone">{v.phone}</Row>
            <Row label="Office address">{v.address}</Row>
            <Row label="Office hours">{v.officeHours}</Row>
        </div>
    );
}
