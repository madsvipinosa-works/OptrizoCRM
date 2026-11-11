"use client"

import * as React from "react"

import { cn } from "@/lib/utils"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

type TimePickerProps = {
  value: string
  onChange: (value: string) => void
  /** Earliest pickable time, "HH:mm". Pass the current time when the picked date is today. */
  min?: string
  disabled?: boolean
  id?: string
  "aria-label"?: string
  className?: string
}

const pad = (n: number) => String(n).padStart(2, "0")
const HOURS = [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]
const MINUTES = Array.from({ length: 12 }, (_, i) => i * 5)
const to24 = (hour12: number, period: "AM" | "PM") => (hour12 % 12) + (period === "PM" ? 12 : 0)

/**
 * Hour, minute and AM/PM as three short choices (12 hours, 5-minute steps) instead of one long list of
 * every time of day. Value stays "HH:mm" (24-hour), so callers did not change.
 */
function TimePicker({ value, onChange, min, disabled, id, className, ...rest }: TimePickerProps) {
  const [h24, minute] = /^\d{2}:\d{2}$/.test(value) ? value.split(":").map(Number) : [null, 0]
  const period: "AM" | "PM" = h24 !== null && h24 >= 12 ? "PM" : "AM"
  const hour12 = h24 === null ? null : h24 % 12 || 12
  // A saved time that is not on a 5-minute step (for example 10:07) still shows and can be kept.
  const minutes = MINUTES.includes(minute) ? MINUTES : [...MINUTES, minute].sort((a, b) => a - b)

  const tooEarly = (h: number, m: number) => !!min && `${pad(h)}:${pad(m)}` < min
  const emit = (h12: number, m: number, p: "AM" | "PM") => onChange(`${pad(to24(h12, p))}:${pad(m)}`)
  const label = rest["aria-label"] ?? "Time"
  const trigger = "w-full min-w-0 gap-1 px-2.5 tabular-nums"

  return (
    <div role="group" aria-label={label} className={cn("flex w-full items-center gap-1.5", className)}>
      <Select value={hour12 === null ? "" : String(hour12)} onValueChange={(v) => emit(Number(v), minute, period)} disabled={disabled}>
        <SelectTrigger id={id} aria-label={`${label}: hour`} className={trigger}>
          <SelectValue placeholder="Hour" />
        </SelectTrigger>
        <SelectContent position="popper" sideOffset={4} className="max-h-64 min-w-20">
          {HOURS.map((h) => (
            <SelectItem key={h} value={String(h)} disabled={tooEarly(to24(h, period), 59)} className="tabular-nums">
              {h}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <span aria-hidden="true" className="text-muted-foreground">:</span>
      <Select value={hour12 === null ? "" : String(minute)} onValueChange={(v) => emit(hour12 ?? 12, Number(v), period)} disabled={disabled || hour12 === null}>
        <SelectTrigger aria-label={`${label}: minute`} className={trigger}>
          <SelectValue placeholder="Min" />
        </SelectTrigger>
        <SelectContent position="popper" sideOffset={4} className="max-h-64 min-w-20">
          {minutes.map((m) => (
            <SelectItem key={m} value={String(m)} disabled={h24 !== null && tooEarly(h24, m)} className="tabular-nums">
              {pad(m)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <div className="flex h-9 shrink-0 rounded-md border border-input p-0.5">
        {(["AM", "PM"] as const).map((p) => (
          <button
            key={p}
            type="button"
            aria-pressed={period === p}
            disabled={disabled || hour12 === null || tooEarly(to24(hour12, p), minute)}
            onClick={() => hour12 !== null && emit(hour12, minute, p)}
            className={cn(
              "rounded-[5px] px-2 text-sm font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
              period === p ? "bg-brand-soft text-brand-deep" : "text-muted-foreground hover:text-foreground"
            )}
          >
            {p}
          </button>
        ))}
      </div>
    </div>
  )
}

export { TimePicker }
