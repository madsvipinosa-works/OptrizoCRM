"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { getAssignablePms } from "@/features/proposals/actions";
import type { PmWorkload } from "@/features/proposals/pm-assignment";

/** "auto" leaves the choice to the system (the recommended, least-loaded PM). */
export type PmChoice = "auto" | string;

const openWork = (n: number) => `${n} open ${n === 1 ? "item" : "items"}`;

/**
 * Lists active PMs with their open work, recommended first (steps 8 and 9).
 * Used by Sales when requesting a proposal and by the PM when passing one.
 */
export function PmPicker({
    value,
    onChange,
    legend,
    disabled,
}: {
    value: PmChoice;
    onChange: (value: PmChoice) => void;
    legend: string;
    disabled?: boolean;
}) {
    const [pms, setPms] = useState<PmWorkload[] | null>(null);

    useEffect(() => {
        let live = true;
        getAssignablePms()
            .then((rows) => live && setPms(rows))
            .catch(() => live && setPms([]));
        return () => {
            live = false;
        };
    }, []);

    if (pms === null) {
        return (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                Loading Project Managers…
            </p>
        );
    }
    if (pms.length === 0) {
        return <p className="text-sm text-muted-foreground">No other Project Manager is active right now.</p>;
    }

    const recommended = pms[0];
    const options = [
        { id: "auto", title: "Assign automatically", detail: `Recommended: ${recommended.name || "PM"} · ${openWork(recommended.load)}` },
        ...pms.map((pm) => ({ id: pm.id, title: pm.name || "Unnamed PM", detail: openWork(pm.load) })),
    ];

    return (
        <fieldset className="space-y-2" disabled={disabled}>
            <legend className="mb-1 text-sm font-medium text-foreground">{legend}</legend>
            {options.map((o) => (
                <label
                    key={o.id}
                    className={cn(
                        "flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2 text-sm transition-colors",
                        value === o.id ? "border-brand-deep/60 bg-muted/40" : "border-border hover:border-foreground/20"
                    )}
                >
                    <input
                        type="radio"
                        name={legend}
                        value={o.id}
                        checked={value === o.id}
                        onChange={() => onChange(o.id)}
                        className="size-4 accent-current"
                    />
                    <span className="flex-1">
                        <span className="block font-medium text-foreground">{o.title}</span>
                        <span className="block text-xs text-muted-foreground">{o.detail}</span>
                    </span>
                    {o.id === recommended.id && (
                        <span className="rounded-full bg-success/10 px-2 py-0.5 text-xs font-semibold text-foreground">Recommended</span>
                    )}
                </label>
            ))}
        </fieldset>
    );
}
