import type { ReactNode } from "react";
import { ArrowDown, ArrowUp } from "lucide-react";
import { cn } from "@/lib/utils";

/** Small building blocks shared by the Super Admin dashboard and analytics. Server-safe. */

export function Panel({
    title,
    aside,
    children,
    className,
}: {
    title: string;
    aside?: ReactNode;
    children: ReactNode;
    className?: string;
}) {
    return (
        <section className={cn("rounded-xl border border-border bg-card p-5", className)}>
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                <h2 className="text-lg font-semibold tracking-tight text-foreground">{title}</h2>
                {aside && <p className="text-sm text-muted-foreground">{aside}</p>}
            </div>
            <div className="mt-4">{children}</div>
        </section>
    );
}

export function Stat({
    label,
    value,
    note,
    tone = "ink",
    delta,
}: {
    label: string;
    value: ReactNode;
    note?: ReactNode;
    tone?: "ink" | "brand" | "warn";
    /** Positive is good unless `invert`. Shown with an arrow, not colour alone. */
    delta?: { text: string; direction: "up" | "down" | "flat"; good?: boolean };
}) {
    return (
        <div className="rounded-xl border border-border bg-card px-5 py-4">
            <p className="text-sm text-muted-foreground">{label}</p>
            <p
                className={cn(
                    "mt-1 text-3xl font-semibold tabular-nums tracking-tight",
                    tone === "brand" && "text-brand-deep",
                    tone === "warn" && "text-destructive",
                    tone === "ink" && "text-foreground"
                )}
            >
                {value}
            </p>
            {delta && (
                <p className={cn("mt-1 flex items-center gap-1 text-sm font-medium", delta.good === false ? "text-destructive" : delta.good ? "text-brand-deep" : "text-muted-foreground")}>
                    {delta.direction === "up" && <ArrowUp className="size-3.5" strokeWidth={2} aria-hidden="true" />}
                    {delta.direction === "down" && <ArrowDown className="size-3.5" strokeWidth={2} aria-hidden="true" />}
                    {delta.text}
                </p>
            )}
            {note && <p className="mt-1 text-sm text-muted-foreground">{note}</p>}
        </div>
    );
}

/** A figure with a label: "Milestones finished on time   18 of 22  82%". */
export function MetricRow({ label, value, extra, extraTone }: { label: string; value: ReactNode; extra?: ReactNode; extraTone?: "good" | "bad" }) {
    return (
        <div className="flex items-baseline justify-between gap-4 border-b border-border py-2.5 last:border-b-0 first:pt-0 last:pb-0">
            <dt className="text-sm text-foreground">{label}</dt>
            <dd className="shrink-0 text-sm tabular-nums">
                <span className="font-semibold text-foreground">{value}</span>
                {extra && (
                    <span className={cn("ml-2 font-medium", extraTone === "bad" ? "text-destructive" : extraTone === "good" ? "text-brand-deep" : "text-muted-foreground")}>
                        {extra}
                    </span>
                )}
            </dd>
        </div>
    );
}

/** A thin bar with a number: used for funnels, waiting time and accounts by role. */
export function BarRow({
    label,
    value,
    max,
    display,
    tone = "brand",
}: {
    label: string;
    value: number;
    max: number;
    display: ReactNode;
    tone?: "brand" | "bad";
}) {
    const width = max > 0 ? Math.max(value > 0 ? 4 : 0, Math.round((value / max) * 100)) : 0;
    return (
        <div className="grid grid-cols-[minmax(0,9rem)_1fr_auto] items-center gap-3 py-1.5 text-sm">
            <span className="truncate text-foreground">{label}</span>
            <span className="h-2 overflow-hidden rounded-full bg-muted" aria-hidden="true">
                <span className={cn("block h-full rounded-full", tone === "bad" ? "bg-destructive" : "bg-brand-deep")} style={{ width: `${width}%` }} />
            </span>
            <span className="min-w-12 text-right tabular-nums text-muted-foreground">{display}</span>
        </div>
    );
}

/** Column chart. Each bar is labelled with its value; the current month is lighter because it is not finished. */
export function ColumnChart({
    items,
    tone = "deep",
    label,
}: {
    items: { label: string; value: number; display: string; partial?: boolean }[];
    tone?: "deep" | "brand";
    label: string;
}) {
    const max = Math.max(1, ...items.map((i) => i.value));
    return (
        <ul aria-label={label} className="flex h-52 items-end gap-2 sm:gap-3">
            {items.map((item) => (
                <li key={item.label} className="flex h-full min-w-0 flex-1 flex-col justify-end text-center">
                    <span className="mb-1 text-sm font-medium tabular-nums text-foreground">{item.display}</span>
                    <span
                        aria-hidden="true"
                        className={cn("w-full rounded-t-md", tone === "brand" ? "bg-primary" : "bg-brand-deep", item.partial && "opacity-45")}
                        style={{ height: `${Math.max(item.value > 0 ? 3 : 0, Math.round((item.value / max) * 78))}%` }}
                    />
                    <span className="mt-2 truncate text-xs text-muted-foreground">{item.label}</span>
                    <span className="sr-only">
                        {item.label}: {item.display}
                    </span>
                </li>
            ))}
        </ul>
    );
}

export const peso = (n: number) => `₱${n.toLocaleString("en-PH")}`;
export const pesoCompact = (n: number) =>
    n >= 1_000_000 ? `₱${(n / 1_000_000).toFixed(2).replace(/\.?0+$/, "")}M` : n >= 1000 ? `₱${Math.round(n / 1000)}k` : `₱${n}`;
export const thousands = (n: number) => (n >= 1000 ? `${Math.round(n / 1000)}k` : String(n));
