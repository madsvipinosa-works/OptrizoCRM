"use client";

import { useState, type ReactNode } from "react";
import { ArrowLeft, ArrowRight, Plus } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { LIMITS, type PageSlugValue } from "@/features/cms/content/schemas";
import { ContentImageField } from "./ContentImageField";
import { FormSection } from "./cms-ui";

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
                {max !== undefined && value !== undefined && value.length >= max * 0.8 && (
                    <span className={value.length > max ? "text-sm text-destructive" : "text-sm text-muted-foreground"}>
                        {value.length} / {max}
                    </span>
                )}
            </div>
            {children}
            {error && (
                <p role="alert" className="text-sm text-destructive">
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
        // Mockup C7: options wrap inline, the hint sits underneath.
        <fieldset className="space-y-2">
            <legend className="mb-2 flex w-full items-baseline justify-between text-sm font-medium text-foreground">
                {legend}
                <span className="text-sm font-normal tabular-nums text-muted-foreground">
                    {selected.length} / {LIMITS.home.featured}
                </span>
            </legend>
            {options.length === 0 && <p className="text-sm text-muted-foreground">Nothing published yet.</p>}
            <div className="grid gap-x-6 gap-y-2.5 sm:grid-cols-2 xl:grid-cols-3">
            {options.map((option) => {
                const checked = selected.includes(option.id);
                return (
                    <div key={option.id} className="flex items-start gap-2.5">
                        <Checkbox
                            id={`${legend}-${option.id}`}
                            className="mt-1"
                            checked={checked}
                            disabled={!checked && full}
                            onCheckedChange={(on) =>
                                onChange(on ? [...selected, option.id] : selected.filter((id) => id !== option.id))
                            }
                        />
                        <div className="min-w-0">
                            <Label htmlFor={`${legend}-${option.id}`} className="font-normal leading-snug">{option.title}</Label>
                            {!option.published && (
                                <p className="mt-0.5 text-sm text-destructive">Hidden from the website. Untick it to publish this page.</p>
                            )}
                        </div>
                    </div>
                );
            })}
            </div>
            {help && <p className="text-sm text-muted-foreground">{help}</p>}
            {error && (
                <p role="alert" className="text-sm text-destructive">
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
        <>
            <FormSection title="Hero">
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
            <p className="text-sm text-muted-foreground">
                The main button always says &ldquo;Request a service&rdquo; and opens the inquiry form. It cannot be changed, so every visitor has a way in.
            </p>
            </FormSection>
            <FormSection title="Featured" description="Up to 3 of each. Only published items are listed.">
            <FeaturedPicker
                legend="Featured services"
                help=""
                options={services}
                selected={values.featuredServiceIds}
                onChange={(ids) => onChange({ ...values, featuredServiceIds: ids })}
                error={errorFor(errors, "featuredServiceIds")}
            />
            <FeaturedPicker
                legend="Featured portfolio"
                help=""
                options={portfolio}
                selected={values.featuredPortfolioIds}
                onChange={(ids) => onChange({ ...values, featuredPortfolioIds: ids })}
                error={errorFor(errors, "featuredPortfolioIds")}
            />
            </FormSection>
        </>
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

    return (
        <>
            <FormSection title="Story">
            <Field id="about-heading" label="Page heading" value={values.heading} max={LIMITS.about.heading} error={errorFor(errors, "heading")}>
                <Input id="about-heading" value={values.heading} onChange={(e) => onChange({ ...values, heading: e.target.value })} />
            </Field>
            <Field id="about-story" label="Our story" value={values.story} max={LIMITS.about.story} error={errorFor(errors, "story")}>
                <Textarea id="about-story" rows={6} value={values.story} onChange={(e) => onChange({ ...values, story: e.target.value })} />
            </Field>
            </FormSection>
            <FormSection title="Mission and vision">
            {/* Mockup C8: Mission and Vision side by side. */}
            <div className="grid gap-5 sm:grid-cols-2">
                <Field id="about-mission" label="Mission" value={values.mission} max={LIMITS.about.mission} error={errorFor(errors, "mission")}>
                    <Textarea id="about-mission" rows={5} value={values.mission} onChange={(e) => onChange({ ...values, mission: e.target.value })} />
                </Field>
                <Field id="about-vision" label="Vision" value={values.vision} max={LIMITS.about.vision} error={errorFor(errors, "vision")}>
                    <Textarea id="about-vision" rows={5} value={values.vision} onChange={(e) => onChange({ ...values, vision: e.target.value })} />
                </Field>
            </div>
            </FormSection>
            <FormSection title="How we work" description="Shown as steps on the page. Keep it short.">
            <Field id="about-how" label="Steps" value={values.howWeWork} max={LIMITS.about.howWeWork} error={errorFor(errors, "howWeWork")}>
                <Input id="about-how" value={values.howWeWork} placeholder="Discovery → Proposal → Design → Development → Testing → Handover" onChange={(e) => onChange({ ...values, howWeWork: e.target.value })} />
            </Field>

            </FormSection>
            <FormSection title="Team" description="Only people who agreed to be shown.">
                <TeamMembers team={values.team} onChange={setTeam} errors={errors} />
            </FormSection>
        </>
    );
}

function initials(name: string) {
    return name.trim().split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase() || "?";
}

function MemberPhoto({ member, size = "size-11" }: { member: TeamMemberValues; size?: string }) {
    return member.photoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- uploaded content image
        <img src={member.photoUrl} alt="" className={`${size} shrink-0 rounded-full object-cover`} />
    ) : (
        <span aria-hidden="true" className={`${size} grid shrink-0 place-items-center rounded-full bg-brand-soft text-sm font-semibold text-brand-deep`}>
            {initials(member.name)}
        </span>
    );
}

/**
 * Mockup C8: compact cards (photo, name, job title, Edit / Remove) and an Add member tile.
 * Editing happens in a small dialog, so the page stays short. Arrows change the order shown on the website.
 */
function TeamMembers({ team, onChange, errors }: { team: TeamMemberValues[]; onChange: (team: TeamMemberValues[]) => void; errors: Errors }) {
    // index of the member being edited; team.length means "new member"
    const [editing, setEditing] = useState<number | null>(null);
    const [draft, setDraft] = useState<TeamMemberValues>({ name: "", jobTitle: "", photoUrl: "" });
    const [triedSave, setTriedSave] = useState(false);
    const full = team.length >= LIMITS.about.team;
    const listError = errorFor(errors, "team") && !Object.keys(errors).some((k) => k.startsWith("team.")) ? errorFor(errors, "team") : undefined;

    const open = (index: number) => {
        setDraft(index < team.length ? { ...team[index] } : { name: "", jobTitle: "", photoUrl: "" });
        setTriedSave(false);
        setEditing(index);
    };
    const move = (index: number, by: -1 | 1) => {
        const target = index + by;
        if (target < 0 || target >= team.length) return;
        const next = [...team];
        [next[index], next[target]] = [next[target], next[index]];
        onChange(next);
    };
    const nameError = !draft.name.trim() ? "Add a name." : draft.name.length > LIMITS.about.name ? `Keep it under ${LIMITS.about.name} characters.` : undefined;
    const titleError = !draft.jobTitle.trim() ? "Add a job title." : draft.jobTitle.length > LIMITS.about.jobTitle ? `Keep it under ${LIMITS.about.jobTitle} characters.` : undefined;
    const saveDraft = () => {
        setTriedSave(true);
        if (nameError || titleError || editing === null) return;
        const clean = { name: draft.name.trim(), jobTitle: draft.jobTitle.trim(), photoUrl: draft.photoUrl };
        onChange(editing < team.length ? team.map((m, i) => (i === editing ? clean : m)) : [...team, clean]);
        setEditing(null);
    };

    return (
        <section aria-labelledby="team-heading" className="space-y-2">
            <h3 id="team-heading" className="text-sm text-muted-foreground">
                <span className="tabular-nums">{team.length}</span> of {LIMITS.about.team} shown
            </h3>

            <ul className="grid gap-3 sm:grid-cols-2">
                {team.map((member, index) => {
                    const hasError = Object.keys(errors).some((k) => k.startsWith(`team.${index}.`));
                    return (
                        <li
                            key={`${member.name}-${index}`}
                            className={`composer-enter flex flex-col gap-3 rounded-xl border bg-card p-3 ${hasError ? "border-destructive" : "border-border"}`}
                        >
                            <div className="flex min-w-0 items-center gap-3">
                                <MemberPhoto member={member} />
                                <div className="min-w-0">
                                    <p className="truncate text-sm font-semibold text-foreground">{member.name || "No name yet"}</p>
                                    <p className="truncate text-sm text-muted-foreground">{member.jobTitle || "No job title yet"}</p>
                                </div>
                            </div>
                            {hasError && <p role="alert" className="text-sm text-destructive">Fix this member before publishing.</p>}
                            <div className="flex items-center gap-2">
                                <Button type="button" size="sm" variant="outline" className="h-8 bg-card active:scale-[0.97]" onClick={() => open(index)}>
                                    Edit<span className="sr-only"> {member.name}</span>
                                </Button>
                                <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    className="h-8 bg-card text-destructive hover:bg-destructive/10 hover:text-destructive active:scale-[0.97]"
                                    onClick={() => onChange(team.filter((_, i) => i !== index))}
                                >
                                    Remove<span className="sr-only"> {member.name}</span>
                                </Button>
                                <div className="ml-auto flex">
                                    <Button type="button" size="icon" variant="ghost" className="size-8 text-muted-foreground" disabled={index === 0} onClick={() => move(index, -1)} aria-label={`Show ${member.name || "this member"} earlier`}>
                                        <ArrowLeft className="size-4" aria-hidden="true" />
                                    </Button>
                                    <Button type="button" size="icon" variant="ghost" className="size-8 text-muted-foreground" disabled={index === team.length - 1} onClick={() => move(index, 1)} aria-label={`Show ${member.name || "this member"} later`}>
                                        <ArrowRight className="size-4" aria-hidden="true" />
                                    </Button>
                                </div>
                            </div>
                        </li>
                    );
                })}
                {!full && (
                    <li>
                        <button
                            type="button"
                            onClick={() => open(team.length)}
                            className="flex h-full min-h-[7.5rem] w-full items-center justify-center gap-1.5 rounded-xl bg-muted/50 text-sm font-medium text-muted-foreground outline-none transition-colors duration-150 ease-out hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.99]"
                        >
                            <Plus className="size-4" aria-hidden="true" /> Add member
                        </button>
                    </li>
                )}
            </ul>
            {listError && <p role="alert" className="text-sm text-destructive">{listError}</p>}
            {full && <p className="text-sm text-muted-foreground">The page shows up to {LIMITS.about.team}. Remove one to add another.</p>}

            <Dialog open={editing !== null} onOpenChange={(o) => !o && setEditing(null)}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle className="text-lg font-semibold tracking-tight">
                            {editing !== null && editing < team.length ? "Edit team member" : "Add team member"}
                        </DialogTitle>
                        <DialogDescription className="text-sm text-muted-foreground">Shown on the About page after you publish.</DialogDescription>
                    </DialogHeader>
                    <form
                        className="space-y-4"
                        onSubmit={(e) => {
                            e.preventDefault();
                            saveDraft();
                        }}
                    >
                        <div className="flex items-center gap-3">
                            <MemberPhoto member={draft} size="size-14" />
                            <div className="min-w-0 flex-1">
                                <ContentImageField
                                    label="Photo (optional)"
                                    max={1}
                                    value={draft.photoUrl ? [draft.photoUrl] : []}
                                    onChange={(urls) => setDraft((d) => ({ ...d, photoUrl: urls[0] ?? "" }))}
                                    hidePreview
                                />
                            </div>
                        </div>
                        <Field id="member-name" label="Name" value={draft.name} max={LIMITS.about.name} error={triedSave ? nameError : undefined}>
                            <Input id="member-name" autoFocus value={draft.name} onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))} />
                        </Field>
                        <Field id="member-title" label="Job title" value={draft.jobTitle} max={LIMITS.about.jobTitle} error={triedSave ? titleError : undefined}>
                            <Input id="member-title" value={draft.jobTitle} placeholder="e.g. Project Manager" onChange={(e) => setDraft((d) => ({ ...d, jobTitle: e.target.value }))} />
                        </Field>
                        <DialogFooter className="gap-2 pt-1">
                            <Button type="button" variant="outline" className="h-9 active:scale-[0.97]" onClick={() => setEditing(null)}>
                                Cancel
                            </Button>
                            <Button type="submit" className="h-9 font-semibold active:scale-[0.97]">
                                {editing !== null && editing < team.length ? "Save member" : "Add member"}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </section>
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
        <>
            <FormSection title="Page">
            <Field id="contact-heading" label="Page heading" value={values.heading} max={LIMITS.contact.heading} error={errorFor(errors, "heading")}>
                <Input id="contact-heading" value={values.heading} onChange={(e) => onChange({ ...values, heading: e.target.value })} />
            </Field>
            <Field id="contact-intro" label="Intro text" value={values.intro} max={LIMITS.contact.intro} error={errorFor(errors, "intro")}>
                <Textarea id="contact-intro" rows={3} value={values.intro} onChange={(e) => onChange({ ...values, intro: e.target.value })} />
            </Field>
            </FormSection>
            <FormSection title="Contact details" description="The email and phone also appear on the inquiry confirmation.">
            <div className="grid gap-5 sm:grid-cols-2">
                <Field id="contact-email" label="Email" error={errorFor(errors, "email")}>
                    <Input id="contact-email" type="email" value={values.email} onChange={(e) => onChange({ ...values, email: e.target.value })} />
                </Field>
                <Field id="contact-phone" label="Phone" value={values.phone} max={LIMITS.contact.phone} error={errorFor(errors, "phone")}>
                    <Input id="contact-phone" type="tel" value={values.phone} onChange={(e) => onChange({ ...values, phone: e.target.value })} />
                </Field>
            </div>
            <Field id="contact-address" label="Office address" value={values.address} max={LIMITS.contact.address} error={errorFor(errors, "address")}>
                <Input id="contact-address" value={values.address} onChange={(e) => onChange({ ...values, address: e.target.value })} />
            </Field>
            <Field id="contact-hours" label="Office hours" value={values.officeHours} max={LIMITS.contact.officeHours} error={errorFor(errors, "officeHours")}>
                <Input id="contact-hours" value={values.officeHours} onChange={(e) => onChange({ ...values, officeHours: e.target.value })} />
            </Field>
            </FormSection>
        </>
    );
}

// ---------------------------------------------------------------------------
// Read-only view (Preview panel and version viewer). Plain React text only.
// ---------------------------------------------------------------------------

function Row({ label, children }: { label: string; children: ReactNode }) {
    return (
        <div className="space-y-0.5">
            <p className="text-sm text-muted-foreground">{label}</p>
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
                    <img src={v.mainImageUrl} alt="" className="h-24 rounded-lg object-cover" />
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
