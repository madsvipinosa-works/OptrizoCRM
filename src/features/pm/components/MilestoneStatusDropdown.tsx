"use client";

import { useState, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";
import { ChevronDown, Check } from "lucide-react";

interface MilestoneStatusDropdownProps {
  status: "Pending" | "In Progress" | "Client Approval" | "Completed";
  onStatusChange: (status: "Pending" | "In Progress" | "Client Approval" | "Completed") => void;
}

const STATUSES = [
  { value: "Pending", label: "Pending" },
  { value: "In Progress", label: "In Progress" },
  { value: "Client Approval", label: "Client Approval" },
  { value: "Completed", label: "Completed" },
] as const;

export function MilestoneStatusDropdown({ status, onStatusChange }: MilestoneStatusDropdownProps) {
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="relative inline-block" ref={dropdownRef}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold backdrop-blur-md shadow-sm transition-all focus:outline-none h-8",
          status === "Completed" ? "border-green-500/50 text-green-500 bg-green-500/10 hover:bg-green-500/20" :
          status === "Client Approval" ? "border-yellow-500/50 text-yellow-500 bg-yellow-500/10 hover:bg-yellow-500/20 animate-pulse" :
          status === "In Progress" ? "border-primary/50 text-primary bg-primary/10 hover:bg-primary/20" :
          "border-white/10 text-white bg-white/5 hover:bg-white/10"
        )}
      >
        <span>{status}</span>
        <ChevronDown className={cn("h-3 w-3 opacity-70 transition-transform", open ? "rotate-180" : "")} />
      </button>

      {/* Dropdown Menu */}
      {open && (
        <div
          className={cn(
            "absolute left-[calc(100%+0.5rem)] top-0 w-48 rounded-xl overflow-hidden z-[100]",
            "bg-zinc-950/95 backdrop-blur-xl text-zinc-200",
            "shadow-2xl border border-white/10",
            "animate-in fade-in zoom-in-95 slide-in-from-left-2 duration-200"
          )}
        >
          {STATUSES.map((s) => (
            <button
              type="button"
              key={s.value}
              onClick={() => {
                onStatusChange(s.value);
                setOpen(false);
              }}
              className={cn(
                "flex items-center gap-2 w-full px-3 py-2 text-sm text-left transition-all",
                status === s.value
                  ? "font-semibold text-primary bg-primary/10"
                  : "text-zinc-400 hover:bg-white/10 hover:text-zinc-100"
              )}
            >
              <span className="flex-1">{s.label}</span>
              {status === s.value && (
                <Check className="h-4 w-4 text-primary" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
