"use client";

/**
 * Lead detail page (mockup step 3, 04-sales/023). Same layout as the mockup:
 * a header (client · stage, business name, service · urgency, back link),
 * the three discovery steps, then two equal cards side by side:
 * "Inquiry details" and "Next step" (actions, activity, proposal request).
 * Later steps reuse the same right card: lost (18j) and won (20a).
 */

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { format } from "date-fns";
import { toast } from "sonner";
import {
    Archive,
    ArrowLeft,
    CalendarPlus,
    ExternalLink,
    Loader2,
    Mail,
    MessageSquare,
    PhoneCall,
    RotateCcw,
    StickyNote,
    UserPlus,
    Users,
    X,
    type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { todayYmd } from "@/lib/datetime";
import { Textarea } from "@/components/ui/textarea";
import { DiscoveryTracker, DiscoverySteps } from "@/features/crm/components/DiscoveryTracker";
import { DiscoveryFormModal } from "@/features/crm/components/DiscoveryFormModal";
import { ReopenLeadModal } from "@/features/crm/components/ReopenLeadModal";
import { ScheduleDiscoveryMeetingModal } from "@/features/meetings/components/ScheduleDiscoveryMeetingModal";
import type { DiscoveryFormData } from "@/features/crm/actions/discovery-form";
import { archiveLead, claimLead, getDiscoveryTrackerData, getProjectForLead, logLeadActivity } from "@/features/crm/actions";
import type { LeadItem } from "./LeadsDataTable";

interface LeadDetailViewProps {
    lead: LeadItem;
}

// Stage names as the mockups write them.
const STAGE_LABEL: Record<string, string> = {
    "New Lead": "New lead",
    "Discovery & Qualifying": "Discovery",
    "Proposal Sent": "Proposal sent",
    "In Negotiation": "Negotiation",
    "Closed Won": "Closed",
    "Closed Lost": "Closed lost",
};

type ActivityType = "Call" | "Meeting" | "Email" | "Note";

const ACTIVITY_TYPES: { type: ActivityType; icon: LucideIcon }[] = [
    { type: "Call", icon: PhoneCall },
    { type: "Meeting", icon: Users },
    { type: "Email", icon: Mail },
    { type: "Note", icon: StickyNote },
];

// One color per interaction type, from the theme tokens.
// Dots use the pipeline's own colours (no orange): meetings teal like Discovery, emails blue like New lead.
const ACTIVITY_DOT: Record<string, string> = {
    Call: "bg-brand-deep",
    Meeting: "bg-stage-discovery",
    Email: "bg-stage-new",
    Note: "bg-muted-foreground",
};

// Same stage colours as the pipeline board.
const STAGE_CHIP: Record<string, string> = {
    "New Lead": "bg-stage-new/15 text-foreground",
    "Discovery & Qualifying": "bg-stage-discovery/15 text-foreground",
    "Proposal Sent": "bg-stage-proposal/15 text-foreground",
    "In Negotiation": "bg-stage-negotiation/15 text-foreground",
    "Closed Won": "bg-brand-soft text-brand-deep",
    "Closed Lost": "bg-destructive/10 text-destructive",
};

type TrackerData = {
    hasMeetingScheduled: boolean;
    hasMeetingDone: boolean;
    doneMeetingNotes?: string | null;
    doneMeetingDate?: Date | string | null;
    doneMeetingFormat?: string | null;
    isFormSubmitted: boolean;
    isProposalRequested: boolean;
    proposalRequestedAt?: Date | string | null;
    discoveryForm?: DiscoveryFormData | null;
    clientType?: string;
};

type ActivityLog = {
    id: string;
    activityType?: string | null;
    content: string;
    createdAt: string | Date;
    author?: { name?: string | null } | null;
};

const cardClass = "flex flex-col rounded-xl border border-border bg-card p-6";

export function LeadDetailView({ lead }: LeadDetailViewProps) {
    const router = useRouter();

    const [activity, setActivity] = useState<ActivityLog[]>((lead.activityLogs as ActivityLog[]) || []);
    const [syncedLogs, setSyncedLogs] = useState(lead.activityLogs);
    if (lead.activityLogs !== syncedLogs) {
        setSyncedLogs(lead.activityLogs);
        setActivity((lead.activityLogs as ActivityLog[]) || []);
    }

    const [tracker, setTracker] = useState<TrackerData | null>(null);
    const [linkedProject, setLinkedProject] = useState<{ id: string | null; title: string } | null>(null);

    // ?log=1 (from the contact profile's "Log interaction") opens the composer on arrival.
    const searchParams = useSearchParams();
    const [isComposerOpen, setIsComposerOpen] = useState(() => searchParams.get("log") === "1");
    const [activityType, setActivityType] = useState<ActivityType>("Call");
    const [activityContent, setActivityContent] = useState("");
    const [followUpDate, setFollowUpDate] = useState("");
    const [isLogging, setIsLogging] = useState(false);
    const [isClaiming, setIsClaiming] = useState(false);
    const [isArchiving, setIsArchiving] = useState(false);

    const [isScheduleOpen, setIsScheduleOpen] = useState(false);
    const [isDiscoveryFormOpen, setIsDiscoveryFormOpen] = useState(false);
    const [isReopenOpen, setIsReopenOpen] = useState(false);
    const composerRef = useRef<HTMLTextAreaElement>(null);

    const loadTracker = () => {
        getDiscoveryTrackerData(lead.id)
            .then(setTracker)
            .catch((err) => console.error(err));
    };

    useEffect(() => {
        let alive = true;
        getDiscoveryTrackerData(lead.id)
            .then((data) => alive && setTracker(data))
            .catch((err) => console.error(err));
        if (lead.status === "Closed Won") {
            getProjectForLead(lead.id).then((p) => alive && setLinkedProject(p));
        }
        return () => {
            alive = false;
        };
    }, [lead.id, lead.status]);

    // Move focus into the composer once it has mounted.
    useEffect(() => {
        if (isComposerOpen) composerRef.current?.focus();
    }, [isComposerOpen]);

    const title = lead.businessName || lead.contactName || lead.client?.name || "Unnamed lead";
    const clientName = lead.contactName || lead.client?.name || null;
    const contactEmail = lead.contactEmail || lead.client?.email || null;
    const service = lead.service?.title || lead.otherServiceText || null;
    const stageLabel = STAGE_LABEL[lead.status] ?? lead.status;
    const isClosed = lead.status === "Closed Won" || lead.status === "Closed Lost";
    const isEarlyStage = lead.status === "New Lead" || lead.status === "Discovery & Qualifying";
    const isUnclaimed = !lead.assignees || lead.assignees.length === 0;
    const sentFrom = lead.source && !/web/i.test(lead.source) ? lead.source : "the website";

    const details: { label: string; value: React.ReactNode }[] = [
        { label: "Service", value: service },
        { label: "Industry", value: lead.industry },
        { label: "Role in the company", value: lead.roleInCompany },
        { label: "Urgency", value: lead.urgency },
        { label: "Client name", value: clientName },
        { label: "Preferred contact", value: lead.contactPreference },
        {
            label: "Phone",
            value: lead.contactPhone ? (
                <a href={`tel:${lead.contactPhone}`} className="tabular-nums underline-offset-4 hover:underline">
                    {lead.contactPhone}
                </a>
            ) : null,
        },
        {
            label: "Email",
            value: contactEmail ? (
                <a href={`mailto:${contactEmail}`} className="break-all underline-offset-4 hover:underline">
                    {contactEmail}
                </a>
            ) : null,
        },
    ];

    const handleClaim = async () => {
        setIsClaiming(true);
        try {
            const res = await claimLead({ leadId: lead.id });
            if (res.ok) {
                toast.success("Lead claimed");
                router.refresh();
            } else {
                toast.error(res.message || "Could not claim this lead");
            }
        } catch (err) {
            console.error(err);
            toast.error("Could not claim this lead");
        } finally {
            setIsClaiming(false);
        }
    };

    const handleLog = async () => {
        const content = activityContent.trim();
        if (!content) return;
        setIsLogging(true);
        try {
            const res = await logLeadActivity({
                leadId: lead.id,
                activityType,
                content,
                nextFollowUpDate: followUpDate || null,
            });
            if (res.success) {
                toast.success(`${activityType} logged`);
                setActivity((prev) => [
                    { id: crypto.randomUUID(), activityType, content, createdAt: new Date().toISOString(), author: { name: "You" } },
                    ...prev,
                ]);
                setActivityContent("");
                setFollowUpDate("");
                setIsComposerOpen(false);
                router.refresh();
            } else {
                toast.error(res.message || "Could not log this interaction");
            }
        } catch (err) {
            console.error(err);
            toast.error("Could not log this interaction");
        } finally {
            setIsLogging(false);
        }
    };

    const handleArchive = async () => {
        if (!confirm(`Archive "${title}"? It will be hidden from the pipeline.`)) return;
        setIsArchiving(true);
        try {
            const res = await archiveLead(lead.id);
            if (res.success) {
                toast.success(res.message || "Lead archived");
                router.push("/dashboard/leads");
            } else {
                toast.error(res.message || "Could not archive this lead");
            }
        } catch (err) {
            console.error(err);
            toast.error("Could not archive this lead");
        } finally {
            setIsArchiving(false);
        }
    };

    return (
        <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-5 pb-12">
            {/* Header: business, its stage, then who the client is (mockup step 3). Same row pattern as every list page. */}
            <header className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
                <div className="min-w-[min(100%,22rem)] flex-1">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                        <h1 className="text-2xl font-semibold tracking-tight text-foreground [text-wrap:balance]">{title}</h1>
                        <span className={`inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ${STAGE_CHIP[lead.status] ?? "bg-muted text-muted-foreground"}`}>
                            <span className="sr-only">Stage: </span>
                            {stageLabel}
                        </span>
                    </div>
                    <p className="mt-1.5 text-base text-muted-foreground">
                        <span className="font-medium text-foreground">{clientName || "Client name not given"}</span>
                        {[service, lead.urgency].filter(Boolean).map((part) => (
                            <span key={part}> · {part}</span>
                        ))}
                    </p>
                </div>
                <div className="flex shrink-0 items-center gap-3 pt-1">
                    {isUnclaimed && !isClosed && (
                        <Button size="sm" onClick={handleClaim} disabled={isClaiming} className="h-9 gap-1.5 font-semibold active:scale-[0.97]">
                            {isClaiming ? <Loader2 className="size-4 animate-spin" /> : <UserPlus className="size-4" />}
                            Claim lead
                        </Button>
                    )}
                    <Link
                        href="/dashboard/leads"
                        className="group inline-flex items-center gap-1 rounded-md text-sm text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
                    >
                        <ArrowLeft className="size-3.5 transition-transform duration-200 ease-out group-hover:-translate-x-0.5" aria-hidden="true" />
                        Back to pipeline
                    </Link>
                </div>
            </header>

            {!isClosed && (
                <DiscoverySteps
                    hasMeetingScheduled={tracker?.hasMeetingScheduled ?? false}
                    hasMeetingDone={tracker?.hasMeetingDone ?? false}
                    isFormSubmitted={tracker?.isFormSubmitted ?? false}
                />
            )}

            {/* Two equal cards, side by side from tablet width up */}
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2 md:items-stretch">
                {/* LEFT: Inquiry details */}
                <section aria-labelledby="inquiry-heading" className={cardClass}>
                    <h2 id="inquiry-heading" className="text-lg font-semibold tracking-tight text-foreground">Inquiry details</h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                        Sent from {sentFrom}, {format(new Date(lead.createdAt), "MMM d")}
                    </p>
                    <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-4">
                        {details.map((item) => (
                            <div key={item.label} className="min-w-0">
                                <dt className="text-sm text-muted-foreground">{item.label}</dt>
                                <dd className="mt-0.5 break-words text-base text-foreground">
                                    {item.value || <span className="text-muted-foreground">Not given</span>}
                                </dd>
                            </div>
                        ))}
                        <div className="col-span-2">
                            <dt className="text-sm text-muted-foreground">Project details</dt>
                            <dd className="mt-0.5 max-w-[65ch] whitespace-pre-wrap text-base leading-relaxed text-foreground">
                                {lead.details || lead.goals || <span className="text-muted-foreground">Not given</span>}
                            </dd>
                        </div>
                    </dl>
                </section>

                {/* RIGHT: Next step */}
                <section aria-labelledby="next-step-heading" className={`${cardClass} min-h-[520px]`}>
                    <h2 id="next-step-heading" className="text-lg font-semibold tracking-tight text-foreground">
                        {lead.status === "Closed Lost" ? "Why it was lost" : lead.status === "Closed Won" ? "Handed to delivery" : "Next step"}
                    </h2>

                    {/* Actions */}
                    {!isClosed && (
                        <div className={`mt-3 grid gap-2 ${isEarlyStage ? "grid-cols-2" : "grid-cols-1"}`}>
                            <Button
                                onClick={() => setIsComposerOpen(true)}
                                className="h-10 gap-1.5 font-semibold active:scale-[0.97]"
                            >
                                <MessageSquare className="size-4" aria-hidden="true" />
                                Log an interaction
                            </Button>
                            {isEarlyStage && (
                                <Button
                                    variant="outline"
                                    onClick={() => setIsScheduleOpen(true)}
                                    className="h-10 gap-1.5 bg-card active:scale-[0.97]"
                                >
                                    <CalendarPlus className="size-4" aria-hidden="true" />
                                    Schedule meeting
                                </Button>
                            )}
                        </div>
                    )}

                    {lead.status === "Closed Lost" && (
                        <>
                            <dl className="mt-3 space-y-3">
                                <div>
                                    <dt className="text-sm text-muted-foreground">Reason given</dt>
                                    <dd className="text-base capitalize text-foreground">{lead.lossReason?.replace(/_/g, " ") || "Not given"}</dd>
                                </div>
                                {lead.lossNotes && (
                                    <div>
                                        <dt className="text-sm text-muted-foreground">Comment</dt>
                                        <dd className="whitespace-pre-wrap text-base text-foreground">{lead.lossNotes}</dd>
                                    </div>
                                )}
                            </dl>
                            <div className="mt-4 flex flex-wrap gap-2">
                                <Button onClick={() => setIsReopenOpen(true)} className="h-10 gap-1.5 font-semibold active:scale-[0.97]">
                                    <RotateCcw className="size-4" aria-hidden="true" />
                                    Reopen lead
                                </Button>
                                <Button variant="outline" onClick={handleArchive} disabled={isArchiving} className="h-10 gap-1.5 active:scale-[0.97]">
                                    {isArchiving ? <Loader2 className="size-4 animate-spin" /> : <Archive className="size-4" aria-hidden="true" />}
                                    Archive
                                </Button>
                            </div>
                        </>
                    )}

                    {lead.status === "Closed Won" && (
                        <div className="mt-3 flex flex-wrap items-center gap-2">
                            <p className="w-full text-base text-foreground">
                                {linkedProject ? `Project: ${linkedProject.title}` : "The project is created when the proposal is signed."}
                            </p>
                            {linkedProject?.id && (
                                <Button asChild className="h-10 gap-1.5">
                                    <Link href={`/dashboard/pm/${linkedProject.id}`}>
                                        Open project <ExternalLink className="size-3.5" aria-hidden="true" />
                                    </Link>
                                </Button>
                            )}
                            <Button variant="outline" onClick={handleArchive} disabled={isArchiving} className="h-10 gap-1.5">
                                <Archive className="size-4" aria-hidden="true" /> Archive
                            </Button>
                        </div>
                    )}

                    {/* Inline composer: opens in place under the buttons */}
                    {isComposerOpen && !isClosed && (
                        <div className="composer-enter mt-3 space-y-3 rounded-xl bg-muted/50 p-3 ring-1 ring-inset ring-border/70">
                            <div className="flex items-center justify-between gap-2">
                                <div role="radiogroup" aria-label="Interaction type" className="inline-flex flex-wrap items-center rounded-lg bg-muted p-1 ring-1 ring-inset ring-border/60">
                                    {ACTIVITY_TYPES.map(({ type, icon: Icon }) => {
                                        const active = activityType === type;
                                        return (
                                            <button
                                                key={type}
                                                type="button"
                                                role="radio"
                                                aria-checked={active}
                                                onClick={() => setActivityType(type)}
                                                className={`flex h-8 items-center gap-1.5 rounded-md px-2.5 text-sm font-medium outline-none transition-[background-color,color,box-shadow,transform] duration-150 ease-out active:scale-[0.97] focus-visible:ring-2 focus-visible:ring-ring ${
                                                    active ? "bg-card text-foreground ring-1 ring-border/70" : "text-muted-foreground hover:text-foreground"
                                                }`}
                                            >
                                                <Icon className="size-3.5" aria-hidden="true" />
                                                {type}
                                            </button>
                                        );
                                    })}
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setIsComposerOpen(false)}
                                    aria-label="Close"
                                    className="grid size-8 shrink-0 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                                >
                                    <X className="size-4" />
                                </button>
                            </div>
                            <Textarea
                                ref={composerRef}
                                aria-label={`${activityType} notes`}
                                placeholder={`What happened on this ${activityType.toLowerCase()}?`}
                                value={activityContent}
                                onChange={(e) => setActivityContent(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                                        e.preventDefault();
                                        handleLog();
                                    }
                                    if (e.key === "Escape") setIsComposerOpen(false);
                                }}
                                rows={3}
                                className="min-h-[84px] resize-none bg-card text-sm"
                            />
                            <div className="flex flex-wrap items-center justify-between gap-2">
                                <label className="flex items-center gap-2 text-sm text-muted-foreground">
                                    Follow up
                                    <DatePicker value={followUpDate} onChange={setFollowUpDate} min={todayYmd()} className="h-8 w-[170px] bg-card text-sm" />
                                </label>
                                <Button onClick={handleLog} disabled={isLogging || !activityContent.trim()} className="h-9 px-4 font-semibold active:scale-[0.97]">
                                    {isLogging ? <Loader2 className="size-4 animate-spin" /> : `Log ${activityType.toLowerCase()}`}
                                </Button>
                            </div>
                        </div>
                    )}

                    {/* Activity */}
                    <h3 className="mt-5 text-sm text-muted-foreground">Activity</h3>
                    {activity.length > 0 ? (
                        <ol className="mt-3 space-y-3.5">
                            {activity.slice(0, 8).map((log) => (
                                <li key={log.id} className="flex gap-3">
                                    <span
                                        aria-hidden="true"
                                        className={`mt-[7px] size-2 shrink-0 rounded-full ${ACTIVITY_DOT[log.activityType ?? ""] ?? "bg-brand-deep"}`}
                                    />
                                    <div className="min-w-0">
                                        <p className="break-words text-base text-foreground">{log.content}</p>
                                        <p className="text-sm text-muted-foreground">
                                            {format(new Date(log.createdAt), "MMM d")}
                                            {" · "}
                                            {log.author?.name
                                                ? `${(log.activityType || "update").toLowerCase()} by ${log.author.name}`
                                                : "automatic"}
                                        </p>
                                    </div>
                                </li>
                            ))}
                        </ol>
                    ) : (
                        <p className="mt-2 text-sm text-muted-foreground">Nothing yet. Logged interactions appear here.</p>
                    )}

                    {/* Proposal request, pinned to the bottom of the card (steps 5–8) */}
                    {!isClosed && (
                        <div className="mt-auto pt-6">
                            <DiscoveryTracker
                                leadId={lead.id}
                                hideSteps
                                hasMeetingScheduled={tracker?.hasMeetingScheduled ?? false}
                                hasMeetingDone={tracker?.hasMeetingDone ?? false}
                                doneMeetingNotes={tracker?.doneMeetingNotes}
                                doneMeetingDate={tracker?.doneMeetingDate}
                                doneMeetingFormat={tracker?.doneMeetingFormat}
                                isFormSubmitted={tracker?.isFormSubmitted ?? false}
                                discoveryForm={tracker?.discoveryForm}
                                isProposalRequested={tracker?.isProposalRequested ?? false}
                                proposalRequestedAt={tracker?.proposalRequestedAt}
                                onOpenDiscoveryForm={() => setIsDiscoveryFormOpen(true)}
                                onRefresh={loadTracker}
                            />
                        </div>
                    )}
                </section>
            </div>

            <ScheduleDiscoveryMeetingModal
                isOpen={isScheduleOpen}
                onClose={() => {
                    setIsScheduleOpen(false);
                    loadTracker();
                    router.refresh();
                }}
                leadId={lead.id}
                businessName={title}
                clientName={clientName}
            />

            <DiscoveryFormModal
                isOpen={isDiscoveryFormOpen}
                onClose={() => setIsDiscoveryFormOpen(false)}
                leadId={lead.id}
                businessName={title}
                initialData={tracker?.discoveryForm}
                isLocked={tracker?.isProposalRequested}
                onSuccess={loadTracker}
            />

            <ReopenLeadModal
                isOpen={isReopenOpen}
                onClose={() => setIsReopenOpen(false)}
                leadId={lead.id}
                businessName={title}
                onSuccess={() => {
                    loadTracker();
                    router.refresh();
                }}
            />
        </div>
    );
}
