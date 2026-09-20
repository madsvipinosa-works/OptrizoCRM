"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Sun, Moon } from "lucide-react";
import { cn } from "@/lib/utils";

interface ThemeToggleProps {
    variant?: "icon" | "pill";
    className?: string;
}

export function ThemeToggle({ variant = "icon", className }: ThemeToggleProps) {
    const [isDark, setIsDark] = useState<boolean>(false);
    const [mounted, setMounted] = useState<boolean>(false);

    // Synchronize initial state from DOM / localStorage
    useEffect(() => {
        setMounted(true);
        const checkTheme = () => {
            if (typeof document === "undefined") return;
            try {
                const saved = localStorage.getItem("optrizo-theme");
                if (saved === "dark") {
                    setIsDark(true);
                    return;
                }
                if (saved === "light") {
                    setIsDark(false);
                    return;
                }
                setIsDark(document.documentElement.classList.contains("dark"));
            } catch {
                setIsDark(document.documentElement.classList.contains("dark"));
            }
        };

        checkTheme();

        const handleThemeChange = (e: Event) => {
            const customEvent = e as CustomEvent<{ isDark: boolean }>;
            if (customEvent.detail && typeof customEvent.detail.isDark === "boolean") {
                setIsDark(customEvent.detail.isDark);
            } else {
                checkTheme();
            }
        };

        window.addEventListener("optrizo-theme-change", handleThemeChange);
        window.addEventListener("storage", checkTheme);

        return () => {
            window.removeEventListener("optrizo-theme-change", handleThemeChange);
            window.removeEventListener("storage", checkTheme);
        };
    }, []);

    const toggleTheme = useCallback(() => {
        const nextDark = !isDark;
        setIsDark(nextDark);

        if (typeof document !== "undefined") {
            try {
                localStorage.setItem("optrizo-theme", nextDark ? "dark" : "light");
            } catch {
                // Ignore storage errors
            }

            if (nextDark) {
                document.documentElement.classList.add("dark");
                document.documentElement.classList.remove("light");
                document.body?.classList.add("dark");
                document.body?.classList.remove("light");
            } else {
                document.documentElement.classList.remove("dark");
                document.documentElement.classList.add("light");
                document.body?.classList.remove("dark");
                document.body?.classList.add("light");
            }

            // Dispatch global synchronization event so all other toggles update in real time
            window.dispatchEvent(
                new CustomEvent("optrizo-theme-change", { detail: { isDark: nextDark } })
            );
        }
    }, [isDark]);

    if (!mounted) {
        // Render neutral placeholder to prevent layout shift during SSR
        if (variant === "pill") {
            return (
                <div
                    className={cn(
                        "h-9 w-full rounded-xl border border-border bg-muted/20 opacity-0",
                        className
                    )}
                />
            );
        }
        return (
            <div
                className={cn(
                    "h-9 w-9 rounded-xl border border-border bg-muted/20 opacity-0",
                    className
                )}
            />
        );
    }

    if (variant === "pill") {
        return (
            <button
                type="button"
                onClick={toggleTheme}
                className={cn(
                    "flex items-center justify-between w-full px-3.5 py-2 rounded-xl border border-border bg-muted/30 text-[10px] font-mono tracking-widest uppercase transition-all duration-300 hover:bg-muted/60 text-foreground cursor-pointer shadow-xs",
                    className
                )}
                title="Toggle Noir // Alabaster Mode"
                aria-label="Toggle Noir // Alabaster Mode"
            >
                <span className="flex items-center gap-2 font-bold">
                    {isDark ? (
                        <Moon className="w-3.5 h-3.5 text-[#00D639]" />
                    ) : (
                        <Sun className="w-3.5 h-3.5 text-[#00B830]" />
                    )}
                    <span>{isDark ? "NOIR // 01" : "ALABASTER // 02"}</span>
                </span>
                <span className="text-[9px] font-mono text-muted-foreground uppercase">Theme</span>
            </button>
        );
    }

    return (
        <button
            type="button"
            onClick={toggleTheme}
            className={cn(
                "relative inline-flex items-center justify-center h-9 w-9 rounded-xl border border-border bg-muted/40 text-foreground hover:bg-muted/70 hover:border-primary/40 transition-all duration-300 cursor-pointer shadow-xs",
                className
            )}
            title={isDark ? "Switch to Alabaster Mode" : "Switch to Noir Mode"}
            aria-label={isDark ? "Switch to Alabaster Mode" : "Switch to Noir Mode"}
        >
            {isDark ? (
                <Moon className="w-4 h-4 text-[#00D639] transition-transform duration-300" />
            ) : (
                <Sun className="w-4 h-4 text-[#00B830] transition-transform duration-300" />
            )}
        </button>
    );
}
