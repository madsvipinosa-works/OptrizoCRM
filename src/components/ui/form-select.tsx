"use client"

import * as React from "react"

import { cn } from "@/lib/utils"
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select"

// Radix items cannot have an empty value, so "" travels as this and is turned back before anyone sees it.
const EMPTY = "__empty__"

// `group` is the label of the <optgroup> the option sits in, if any.
type Option = { value: string; label: React.ReactNode; disabled?: boolean; group?: string }

export function readOptions(children: React.ReactNode, group?: string): Option[] {
  const out: Option[] = []
  React.Children.forEach(children, (child) => {
    if (!React.isValidElement(child)) return
    const props = child.props as { value?: string | number; children?: React.ReactNode; disabled?: boolean; label?: string }
    if (child.type === React.Fragment) {
      out.push(...readOptions(props.children, group))
    } else if (child.type === "optgroup") {
      out.push(...readOptions(props.children, props.label))
    } else if (child.type === "option") {
      const label = props.children
      out.push({ value: String(props.value ?? (typeof label === "string" ? label : "")), label, disabled: props.disabled, group })
    }
  })
  return out
}

/** Runs of options that share an <optgroup> label stay together, in order. */
export function groupOptions(options: Option[]): { group: string | undefined; items: Option[] }[] {
  const out: { group: string | undefined; items: Option[] }[] = []
  for (const o of options) {
    const last = out[out.length - 1]
    if (last && last.group === o.group) last.items.push(o)
    else out.push({ group: o.group, items: [o] })
  }
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
          {groupOptions(options).map(({ group, items }) => {
            const rendered = items.map((o) => (
              <SelectItem key={o.value || EMPTY} value={o.value === "" ? EMPTY : o.value} disabled={o.disabled}>
                {o.label}
              </SelectItem>
            ))
            return group === undefined ? (
              <React.Fragment key="ungrouped">{rendered}</React.Fragment>
            ) : (
              <SelectGroup key={group}>
                <SelectLabel>{group}</SelectLabel>
                {rendered}
              </SelectGroup>
            )
          })}
        </SelectContent>
      </Select>
    </>
  )
}

export { FormSelect }
