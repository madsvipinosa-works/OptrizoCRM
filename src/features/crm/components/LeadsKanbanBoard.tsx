"use client";

import type { KeyboardEvent, MouseEvent } from "react";
import { useLayoutEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
    Archive,
    CheckCircle2,
    Edit3,
    Loader2,
    MessagesSquare,
    MoreHorizontal,
    RefreshCw,
    Send,
    Sparkles,
    type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { archiveLead } from "@/features/crm/actions";
import { getDaysInStage, getLeadSubStatus } from "@/features/crm/utils/stageUtils";
import type { LeadItem } from "./LeadsDataTable";

interface LeadsKanbanBoardProps {
    leads: LeadItem[];
    assignableUsers: { id: string; name: string | null; image: string | null; jobTitle?: string | null; role?: string | null }[];
    isAdmin?: boolean;
    onSelectLead?: (lead: LeadItem) => void;
    onEditLead?: (lead: LeadItem) => void;
    onArchiveLead?: (leadId: string) => void;
}

/**
 * Board columns follow mockup step 2: five stages, each moved only by the
 * automations in workflow-spec §4. Closed lost is intentionally not a column;
 * lost leads are reached from the table view, where Sales can reopen them.
 * There is no drag-and-drop: the spec forbids manual stage changes.
 */
// Every column: the icon in its stage colour; title, count and cards stay neutral.
const COLUMNS: { status: string; title: string; icon: LucideIcon; ink: string }[] = [
    {
        status: "New Lead",
        title: "New lead",
        icon: Sparkles,
        ink: "text-stage-new",
    },
    {
        status: "Discovery & Qualifying",
        title: "Discovery",
        icon: MessagesSquare,
        ink: "text-stage-discovery",
    },
    {
        status: "Proposal Sent",
        title: "Proposal sent",
        icon: Send,
        ink: "text-stage-proposal",
    },
    {
        status: "In Negotiation",
        title: "Negotiation",
        icon: RefreshCw,
        ink: "text-stage-negotiation",
    },
    {
        status: "Closed Won",
        title: "Closed",
        icon: CheckCircle2,
        ink: "text-stage-closed",
    },
];

/**
 * Fits the board to the window so its sideways scrollbar is always on screen
 * (no need to scroll the page down to reach it). Columns scroll vertically
 * inside. Measured on mount and on resize only.
 */
function useFitToViewport<T extends HTMLElement>(minHeight = 320) {
    const ref = useRef<T>(null);
    const [height, setHeight] = useState<number | null>(null);
    useLayoutEffect(() => {
        const measure = () => {
            const el = ref.current;
            if (!el) return;
            const top = el.getBoundingClientRect().top + window.scrollY;
            // Leave room for the page's own bottom padding so the page itself does not scroll.
            const main = el.closest("main");
            const bottomGap = main ? parseFloat(getComputedStyle(main).paddingBottom) || 0 : 16;
            setHeight(Math.max(minHeight, Math.floor(window.innerHeight - top - bottomGap)));
        };
        measure();
        window.addEventListener("resize", measure);
        return () => window.removeEventListener("resize", measure);
    }, [minHeight]);
    return { ref, height };
}

const spring = { type: "spring" as const, stiffness: 300, damping: 26 };

export function LeadsKanbanBoard({ leads, isAdmin, onSelectLead, onEditLead, onArchiveLead }: LeadsKanbanBoardProps) {
    const { ref, height } = useFitToViewport<HTMLDivElement>();
    return (
        <div
            ref={ref}
            style={height ? { height } : undefined}
            className="board-scroll -mx-1 overflow-x-auto overflow-y-hidden px-1 pb-4"
        >
            <div className="grid h-full min-w-[1060px] grid-cols-5 gap-3">
                {COLUMNS.map((column) => (
                    <BoardColumn
                        key={column.status}
                        column={column}
                        leads={leads.filter((lead) => lead.status === column.status)}
                        isAdmin={isAdmin}
                        onSelectLead={onSelectLead}
                        onEditLead={onEditLead}
                        onArchiveLead={onArchiveLead}
                    />
                ))}
            </div>
        </div>
    );
}

function BoardColumn({
    column,
    leads,
    isAdmin,
    onSelectLead,
    onEditLead,
    onArchiveLead,
}: {
    column: (typeof COLUMNS)[number];
    leads: LeadItem[];
    isAdmin?: boolean;
    onSelectLead?: (lead: LeadItem) => void;
    onEditLead?: (lead: LeadItem) => void;
    onArchiveLead?: (leadId: string) => void;
}) {
    const headingId = `column-${column.status.replace(/\W+/g, "-").toLowerCase()}`;

    return (
        <section
            aria-labelledby={headingId}
            className="flex h-full min-h-0 min-w-0 flex-col rounded-xl bg-muted/50 p-2 ring-1 ring-inset ring-border/50 dark:bg-muted/30"
        >
            <header className="px-2 pb-3 pt-1.5">
                <div className="flex items-center gap-2">
                    <column.icon className={`size-4 shrink-0 ${column.ink}`} aria-hidden="true" />
                    <h3 id={headingId} className="text-base font-semibold tracking-tight text-foreground">
                        {column.title}
                    </h3>
                    <motion.span
                        key={leads.length}
                        initial={{ scale: 0.8, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ type: "spring", duration: 0.3, bounce: 0.2 }}
                        className={`ml-auto min-w-6 rounded-full px-1.5 py-0.5 text-center text-xs font-semibold tabular-nums text-foreground bg-foreground/[0.06]`}
                        aria-label={`${leads.length} ${leads.length === 1 ? "lead" : "leads"}`}
                    >
                        {leads.length}
                    </motion.span>
                </div>
            </header>

            <ul className="column-scroll -mx-1 flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto overscroll-contain px-1 pb-6">
                <AnimatePresence initial={false} mode="popLayout">
                    {leads.map((lead, index) => (
                        <PipelineCard
                            key={lead.id}
                            lead={lead}
                            index={index}
                            isAdmin={isAdmin}
                            onSelect={onSelectLead}
                            onEdit={onEditLead}
                            onArchive={onArchiveLead}
                        />
                    ))}
                </AnimatePresence>
            </ul>
        </section>
    );
}

// Chip text stays on --foreground for contrast; the dot carries the meaning.
const SUB_STATUS_STYLE: Record<string, { chip: string; dot: string }> = {
    "No contact yet": { chip: "bg-foreground/[0.06]", dot: "bg-muted-foreground" },
    "In progress": { chip: "bg-primary/12", dot: "bg-primary" },
    Sent: { chip: "bg-primary/12", dot: "bg-primary" },
    "Needs revision": { chip: "bg-warning/14", dot: "bg-warning" },
    Signed: { chip: "bg-success/14", dot: "bg-success" },
    Declined: { chip: "bg-destructive/10", dot: "bg-destructive" },
};

/** Sub-status chip shared by the board cards and the table's Status column. */
export function SubStatusChip({ status }: { status: string }) {
    const style = SUB_STATUS_STYLE[status] ?? SUB_STATUS_STYLE["No contact yet"];
    return (
        <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium leading-snug text-foreground ${style.chip}`}>
            <span className={`size-1.5 rounded-full ${style.dot}`} aria-hidden="true" />
            {status}
        </span>
    );
}

function formatPrice(amount: number | null | undefined, currency: string | null | undefined) {
    if (!amount) return null;
    try {
        return new Intl.NumberFormat("en-PH", {
            style: "currency",
            currency: currency || "PHP",
            maximumFractionDigits: 0,
        }).format(amount);
    } catch {
        return amount.toLocaleString();
    }
}

function initialsOf(name?: string | null) {
    return (name || "?")
        .split(" ")
        .map((word) => word[0])
        .join("")
        .slice(0, 2)
        .toUpperCase();
}

function PipelineCard({
    lead,
    index,
    isAdmin,
    onSelect,
    onEdit,
    onArchive,
}: {
    lead: LeadItem;
    index: number;
    isAdmin?: boolean;
    onSelect?: (lead: LeadItem) => void;
    onEdit?: (lead: LeadItem) => void;
    onArchive?: (leadId: string) => void;
}) {
    const reduceMotion = useReducedMotion();
    const [isArchiving, setIsArchiving] = useState(false);

    const title = lead.businessName || lead.contactName || lead.client?.name || "Unnamed lead";
    const service = lead.service?.title || lead.otherServiceText || lead.industry || null;
    const latestProposal = lead.proposals?.[0];
    const price = formatPrice(latestProposal?.totalPrice, latestProposal?.currency);
    // Before a proposal exists the card shows urgency (step 2); afterwards, the proposal price.
    const detail = price ?? lead.urgency ?? null;
    const subStatus = getLeadSubStatus(lead);
    const days = getDaysInStage(lead);
    const owner = lead.assignees?.[0];

    const open = () => onSelect?.(lead);
    const onKeyDown = (event: KeyboardEvent<HTMLLIElement>) => {
        if (event.target !== event.currentTarget) return;
        if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            open();
        }
    };

    const handleArchive = async (event: MouseEvent) => {
        event.stopPropagation();
        if (!confirm(`Archive "${title}"? It will be hidden from the pipeline.`)) return;
        setIsArchiving(true);
        try {
            const res = await archiveLead(lead.id);
            if (res.success) {
                toast.success(res.message || "Lead archived");
                onArchive?.(lead.id);
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
        <motion.li
            layout={!reduceMotion}
            initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 8, scale: 0.97, filter: "blur(4px)" }}
            animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -6, scale: 0.98, filter: "blur(3px)" }}
            transition={{ ...spring, delay: reduceMotion ? 0 : Math.min(index, 8) * 0.04 }}
            whileHover={reduceMotion ? undefined : { y: -2 }}
            whileTap={reduceMotion ? undefined : { scale: 0.98 }}
            role="button"
            tabIndex={0}
            aria-label={`Open ${title}`}
            onClick={open}
            onKeyDown={onKeyDown}
            className="group relative flex cursor-pointer flex-col gap-2 rounded-xl border border-border bg-card p-3 text-left outline-none transition-colors duration-150 ease-out hover:border-foreground/25 focus-visible:ring-2 focus-visible:ring-ring"
        >
            <div className="flex items-start gap-2">
                <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold leading-snug text-foreground [text-wrap:pretty] break-words">
                        {title}
                    </div>
                    {(service || detail) && (
                        <div className="mt-0.5 text-sm leading-snug text-muted-foreground">
                            {[service, detail].filter(Boolean).join(" · ")}
                        </div>
                    )}
                </div>

                {isAdmin && (
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button
                                size="icon"
                                variant="ghost"
                                onClick={(event) => event.stopPropagation()}
                                onKeyDown={(event) => event.stopPropagation()}
                                aria-label={`Actions for ${title}`}
                                className="-mr-1 -mt-1 size-7 shrink-0 text-muted-foreground opacity-70 hover:text-foreground group-hover:opacity-100 focus-visible:opacity-100"
                            >
                                <MoreHorizontal className="size-4" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-40" onClick={(event) => event.stopPropagation()}>
                            <DropdownMenuItem onClick={() => onEdit?.(lead)} className="gap-2">
                                <Edit3 className="size-3.5" /> Edit details
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={handleArchive} disabled={isArchiving} className="gap-2 text-destructive focus:text-destructive">
                                {isArchiving ? <Loader2 className="size-3.5 animate-spin" /> : <Archive className="size-3.5" />}
                                Archive
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                )}
            </div>

            <div>
                <SubStatusChip status={subStatus} />
            </div>

            {(owner || days > 0) && (
                <div className="flex items-center justify-between gap-2 pt-1">
                    {owner ? (
                        <span className="flex min-w-0 items-center gap-1.5" title={`Owner: ${owner.name || "Sales"}`}>
                            <span className="flex size-[22px] shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-semibold text-foreground">
                                {initialsOf(owner.name)}
                            </span>
                            <span className="truncate text-sm text-muted-foreground">{owner.name || "Sales"}</span>
                        </span>
                    ) : (
                        <span />
                    )}
                    {days > 0 && <span className="shrink-0 text-sm tabular-nums text-muted-foreground">{days}d in stage</span>}
                </div>
            )}
        </motion.li>
    );
}
