"use client";

import {
  MenuTrigger,
  Popover as AriaPopover,
  Menu as AriaMenu,
  MenuItem as AriaMenuItem,
  Section as AriaSection,
  Separator as AriaSeparator,
  type PopoverProps,
  type MenuProps,
  type MenuItemProps,
  type SectionProps,
  type SeparatorProps
} from 'react-aria-components';
import { cn } from "@/lib/utils";
import React from 'react';

export const Dropdown = {
  Root: MenuTrigger,
  
  Popover: ({ className, offset = 4, ...props }: PopoverProps) => (
    <AriaPopover
      offset={offset}
      className={cn(
        "z-50 min-w-[150px] overflow-hidden rounded-md border border-white/10 bg-black p-1 text-white shadow-lg outline-none data-[entering]:animate-in data-[exiting]:animate-out data-[entering]:fade-in-0 data-[exiting]:fade-out-0 data-[entering]:zoom-in-95 data-[exiting]:zoom-out-95",
        className
      )}
      {...props}
    />
  ),
  
  Menu: ({ className, ...props }: MenuProps<any>) => (
    <AriaMenu className={cn("outline-none p-1", className)} {...props} />
  ),
  
  Section: ({ className, ...props }: SectionProps<any>) => (
    <AriaSection className={cn("", className)} {...props} />
  ),
  
  Item: ({ className, ...props }: MenuItemProps) => (
    <AriaMenuItem 
      className={({ isFocused }) => cn(
        "relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
        isFocused ? "bg-white/10 text-white" : "text-gray-200",
        className instanceof Function ? className({ isFocused, ...props } as any) : className
      )} 
      {...props} 
    />
  ),
  
  Separator: ({ className, ...props }: SeparatorProps) => (
    <AriaSeparator className={cn("-mx-1 my-1 h-px bg-white/10", className)} {...props} />
  )
};
