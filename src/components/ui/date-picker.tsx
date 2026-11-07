"use client"

import * as React from "react"
import { Calendar as CalendarIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { formatDate, manilaToDate } from "@/lib/datetime"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

// The picker works on plain "YYYY-MM-DD" strings, like `<input type="date">`,
// so callers keep their state as it was. Colors come from the theme tokens.
const toLocalDate = (ymd: string) => {
  const [y, m, d] = ymd.split("-").map(Number)
  return new Date(y, m - 1, d)
}
const toYmd = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`

type DatePickerProps = {
  value: string
  onChange: (value: string) => void
  /** Earliest pickable day, "YYYY-MM-DD". Use `todayYmd()` to block the past. */
  min?: string
  /** Latest pickable day, "YYYY-MM-DD". Use `todayYmd()` to block the future. */
  max?: string
  placeholder?: string
  disabled?: boolean
  required?: boolean
  id?: string
  "aria-label"?: string
  className?: string
}

function DatePicker({
  value,
  onChange,
  min,
  max,
  placeholder = "Pick a date",
  disabled,
  required,
  id,
  className,
  ...rest
}: DatePickerProps) {
  const [open, setOpen] = React.useState(false)
  const selected = value ? toLocalDate(value) : undefined

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          id={id}
          disabled={disabled}
          aria-label={rest["aria-label"]}
          aria-required={required || undefined}
          data-slot="date-picker"
          className={cn(
            "border-input dark:bg-input/30 focus-visible:border-ring focus-visible:ring-ring/50 flex h-9 w-full items-center justify-between gap-2 rounded-md border bg-transparent px-3 py-1 text-left text-sm shadow-xs transition-[color,box-shadow] outline-none focus-visible:ring-[3px] disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
            !value && "text-muted-foreground",
            className
          )}
        >
          <span className="truncate">{value ? formatDate(manilaToDate(value)) : placeholder}</span>
          <CalendarIcon className="text-muted-foreground size-4 shrink-0" aria-hidden="true" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={selected}
          defaultMonth={selected ?? (min ? toLocalDate(min) : undefined)}
          onSelect={(d) => {
            if (!d) return
            onChange(toYmd(d))
            setOpen(false)
          }}
          disabled={[
            ...(min ? [{ before: toLocalDate(min) }] : []),
            ...(max ? [{ after: toLocalDate(max) }] : []),
          ]}
          autoFocus
        />
      </PopoverContent>
    </Popover>
  )
}

export { DatePicker }
