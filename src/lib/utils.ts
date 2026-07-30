import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function parseBudgetToEstimatedValue(budgetStr: string | null | undefined): number {
    if (!budgetStr) return 0;
    
    // Remove commas, spaces, and dollar signs for easier parsing
    const normalized = budgetStr.toLowerCase().replace(/[$,\s]/g, '');
    
    // Extract all numbers, accounting for 'k' or 'm' multipliers
    const regex = /(\d+)(k|m)?/g;
    const matches = [...normalized.matchAll(regex)];
    
    if (matches.length === 0) return 0;

    const values = matches.map(match => {
        let val = parseInt(match[1], 10);
        if (match[2] === 'k') val *= 1000;
        if (match[2] === 'm') val *= 1000000;
        return val;
    });

    if (values.length === 1) {
        return values[0];
    }

    if (values.length >= 2) {
        // Return the median of the first two values (e.g. 1k - 5k -> 3000)
        return Math.floor((values[0] + values[1]) / 2);
    }

    return 0;
}
