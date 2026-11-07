"use client"

import * as React from "react"

import { cn } from "@/lib/utils"
import { formatHm } from "@/lib/datetime"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

const SLOTS = Array.from({ length: 96 }, (_, i) =>
  `${String(Math.floor(i / 4)).padStart(2, "0")}:${String((i % 4) * 15).padStart(2, "0")}`
)

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

/** 15-minute slots in a themed dropdown. Value is "HH:mm", shown as "10:00 AM". */
function TimePicker({ value, onChange, min, disabled, id, className, ...rest }: TimePickerProps) {
  return (
    <Select value={value} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger id={id} aria-label={rest["aria-label"]} className={cn("w-full", className)}>
        <SelectValue placeholder="Pick a time" />
      </SelectTrigger>
      <SelectContent className="max-h-64">
        {SLOTS.map((slot) => (
          <SelectItem key={slot} value={slot} disabled={!!min && slot < min}>
            {formatHm(slot)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

export { TimePicker }
