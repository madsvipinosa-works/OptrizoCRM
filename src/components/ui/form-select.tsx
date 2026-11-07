"use client"

import * as React from "react"

import { cn } from "@/lib/utils"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

// Radix items cannot have an empty value, so "" travels as this and is turned back before anyone sees it.
const EMPTY = "__empty__"

type Option = { value: string; label: React.ReactNode; disabled?: boolean }

function readOptions(children: React.ReactNode): Option[] {
  const out: Option[] = []
  React.Children.forEach(children, (child) => {
    if (!React.isValidElement(child)) return
    const props = child.props as { value?: string | number; children?: React.ReactNode; disabled?: boolean }
    if (child.type === React.Fragment) {
      out.push(...readOptions(props.children))
    } else if (child.type === "option") {
      const label = props.children
      out.push({ value: String(props.value ?? (typeof label === "string" ? label : "")), label, disabled: props.disabled })
    }
  })
  return out
}

type FormSelectProps = {
  name?: string
  value?: string
  defaultValue?: string
  /** Same shape as a native select's handler: read `e.target.value`. */
  onChange?: (e: { target: { value: string; name?: string } }) => void
  required?: boolean
  disabled?: boolean
  id?: string
  className?: string
  variant?: "standard" | "plain"
  "aria-label"?: string
  children: React.ReactNode
}

/**
 * The themed dropdown for form fields. Takes `<option>` children and the props of a native `<select>`,
 * so a field moves over without rewriting. It still submits with its form through a hidden input.
 */
function FormSelect({ name, value, defaultValue, onChange, required, disabled, id, className, variant, children, ...rest }: FormSelectProps) {
  const options = readOptions(children)
  const [inner, setInner] = React.useState(defaultValue ?? "")
  const current = value ?? inner
  const emptyLabel = options.find((o) => o.value === "")?.label

  const pick = (next: string) => {
    const real = next === EMPTY ? "" : next
    if (value === undefined) setInner(real)
    onChange?.({ target: { value: real, name } })
  }

  return (
    <>
      {name ? <input type="hidden" name={name} value={current} required={required} /> : null}
      <Select value={current === "" ? EMPTY : current} onValueChange={pick} disabled={disabled}>
        <SelectTrigger id={id} aria-label={rest["aria-label"]} variant={variant} className={cn("w-full", className)}>
          <SelectValue placeholder={emptyLabel} />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.value || EMPTY} value={o.value === "" ? EMPTY : o.value} disabled={o.disabled}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </>
  )
}

export { FormSelect }
