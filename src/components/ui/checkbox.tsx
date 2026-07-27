"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export interface CheckboxProps
    extends React.InputHTMLAttributes<HTMLInputElement> {
    onCheckedChange?: (checked: boolean) => void;
}

const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
    ({ className, checked, onCheckedChange, onChange, ...props }, ref) => {
        const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
            onChange?.(e);
            onCheckedChange?.(e.target.checked);
        };

        return (
            <input
                type="checkbox"
                ref={ref}
                checked={checked}
                onChange={handleChange}
                className={cn(
                    "h-4 w-4 shrink-0 rounded border border-white/20 bg-black/60 text-primary accent-emerald-400 focus:outline-none focus:ring-1 focus:ring-primary disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer",
                    className
                )}
                {...props}
            />
        );
    }
);
Checkbox.displayName = "Checkbox";

export { Checkbox };
