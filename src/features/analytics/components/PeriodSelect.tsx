"use client";

import { useRouter } from "next/navigation";

/** The period dropdown at the top right of Analytics. Changing it reloads the page with ?period=. */
export function PeriodSelect({ value, tab, options }: { value: number; tab: string; options: { value: number; label: string }[] }) {
    const router = useRouter();
    return (
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <span className="sr-only">Period</span>
            <select
                value={value}
                onChange={(e) => router.replace(`/dashboard/analytics?tab=${tab}&period=${e.target.value}`)}
                className="h-10 rounded-lg border border-border bg-card px-3 text-sm font-medium text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
                {options.map((o) => (
                    <option key={o.value} value={o.value}>
                        {o.label}
                    </option>
                ))}
            </select>
        </label>
    );
}
