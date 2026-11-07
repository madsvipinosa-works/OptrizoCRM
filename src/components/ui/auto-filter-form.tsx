"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

/**
 * A filter bar that applies itself: dropdowns apply on change, search applies 300ms after typing stops.
 * Filters live in the URL (?q=&status=), so pages keep reading them on the server. No Filter button needed.
 */
export function AutoFilterForm({ children, className }: { children: ReactNode; className?: string }) {
    const router = useRouter();
    const pathname = usePathname();
    const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
    const formRef = useRef<HTMLFormElement>(null);
    const query = useSearchParams().toString();

    // A "Clear" link drops every filter from the URL; empty the fields too, since they keep their own values.
    useEffect(() => {
        if (query !== "" || !formRef.current) return;
        for (const el of Array.from(formRef.current.elements)) {
            if ((el instanceof HTMLInputElement && el.type !== "hidden") || el instanceof HTMLSelectElement) el.value = "";
        }
    }, [query]);

    const apply = (form: HTMLFormElement) => {
        const params = new URLSearchParams();
        new FormData(form).forEach((value, key) => {
            if (typeof value === "string" && value.trim() !== "") params.set(key, value.trim());
        });
        const query = params.toString();
        router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    };

    return (
        <form
            ref={formRef}
            role="search"
            className={className}
            onSubmit={(e) => {
                e.preventDefault();
                clearTimeout(timer.current);
                apply(e.currentTarget);
            }}
            onChange={(e) => {
                const form = e.currentTarget;
                clearTimeout(timer.current);
                // Typing waits for a pause; a dropdown or checkbox applies at once.
                const typing = e.target instanceof HTMLInputElement && (e.target.type === "search" || e.target.type === "text");
                timer.current = setTimeout(() => apply(form), typing ? 300 : 0);
            }}
        >
            {children}
        </form>
    );
}
