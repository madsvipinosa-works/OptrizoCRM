"use client";

import React from "react";
import { NumberTicker } from "@/components/ui/number-ticker";

interface AnimatedStatCardProps {
  label: string;
  value: string;
  delay?: number;
}

export function AnimatedStatCard({ label, value, delay = 0 }: AnimatedStatCardProps) {
  // Extract prefix, number (with decimals), and suffix safely
  const match = value.match(/^([^0-9.]*)(\d+(?:\.\d+)?)(.*)$/);
  
  if (!match) {
    return (
      <div className="flex flex-col items-center justify-center p-4">
        <span className="text-4xl sm:text-5xl lg:text-6xl font-mono font-extrabold text-primary tracking-tight text-glow-sm">
          {value}
        </span>
        <span className="text-xs sm:text-sm font-mono tracking-widest uppercase text-muted-foreground font-semibold mt-3">
          {label}
        </span>
      </div>
    );
  }

  const prefix = match[1] || "";
  const num = parseFloat(match[2]);
  const suffix = match[3] || "";
  const decimalPlaces = match[2].includes(".") ? match[2].split(".")[1].length : 0;

  return (
    <div className="flex flex-col items-center justify-center p-4">
      <div className="text-4xl sm:text-5xl lg:text-6xl font-mono font-extrabold text-primary tracking-tight text-glow-sm flex items-center">
        {prefix && <span>{prefix}</span>}
        <NumberTicker 
          value={num} 
          decimalPlaces={decimalPlaces} 
          delay={delay} 
          className="text-primary font-mono text-glow-sm" 
        />
        {suffix && <span>{suffix}</span>}
      </div>
      <span className="text-xs sm:text-sm font-mono tracking-widest uppercase text-muted-foreground font-semibold mt-3">
        {label}
      </span>
    </div>
  );
}

export default AnimatedStatCard;
