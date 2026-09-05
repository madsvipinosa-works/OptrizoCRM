"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export interface SwitchProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    checked?: boolean;
    onCheckedChange?: (checked: boolean) => void;
}

const Switch = React.forwardRef<HTMLButtonElement, SwitchProps>(
    ({ className, checked = false, onCheckedChange, disabled, onClick, ...props }, ref) => {
        const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
            if (disabled) return;
            onClick?.(e);
            onCheckedChange?.(!checked);
        };

        return (
            <button
                type="button"
                role="switch"
                aria-checked={checked}
                ref={ref}
                disabled={disabled}
                onClick={handleClick}
                className={cn(
                    "peer inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50",
                    checked ? "bg-primary" : "bg-zinc-700/60 hover:bg-zinc-600/60",
                    className
                )}
                {...props}
            >
                <span
                    className={cn(
                        "pointer-events-none block h-4 w-4 rounded-full bg-white shadow-lg ring-0 transition-transform duration-200",
                        checked ? "translate-x-4 bg-zinc-950" : "translate-x-0 bg-zinc-300"
                    )}
                />
            </button>
        );
    }
);
Switch.displayName = "Switch";

export { Switch };
