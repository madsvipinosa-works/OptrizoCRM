"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import { ChevronDown, Search, Check } from "lucide-react";
import { cn } from "@/lib/utils";

export interface CountryInfo {
    code: string;
    name: string;
    dialCode: string;
    flag: string;
    maxDigits: number;
    placeholder: string;
}

export const ALL_COUNTRIES: CountryInfo[] = [
    { code: "PH", name: "Philippines", dialCode: "+63", flag: "🇵🇭", maxDigits: 10, placeholder: "(917) 555-1234" },
    { code: "US", name: "United States", dialCode: "+1", flag: "🇺🇸", maxDigits: 10, placeholder: "(555) 123-4567" },
    { code: "CA", name: "Canada", dialCode: "+1", flag: "🇨🇦", maxDigits: 10, placeholder: "(555) 123-4567" },
    { code: "GB", name: "United Kingdom", dialCode: "+44", flag: "🇬🇧", maxDigits: 10, placeholder: "7911 123456" },
    { code: "SG", name: "Singapore", dialCode: "+65", flag: "🇸🇬", maxDigits: 8, placeholder: "8123 4567" },
    { code: "AU", name: "Australia", dialCode: "+61", flag: "🇦🇺", maxDigits: 9, placeholder: "412 345 678" },
    { code: "JP", name: "Japan", dialCode: "+81", flag: "🇯🇵", maxDigits: 10, placeholder: "90 1234 5678" },
    { code: "AE", name: "United Arab Emirates", dialCode: "+971", flag: "🇦🇪", maxDigits: 9, placeholder: "50 123 4567" },
    { code: "HK", name: "Hong Kong", dialCode: "+852", flag: "🇭🇰", maxDigits: 8, placeholder: "9123 4567" },
    { code: "DE", name: "Germany", dialCode: "+49", flag: "🇩🇪", maxDigits: 11, placeholder: "151 12345678" },
    { code: "MY", name: "Malaysia", dialCode: "+60", flag: "🇲🇾", maxDigits: 10, placeholder: "12 345 6789" },
    { code: "NZ", name: "New Zealand", dialCode: "+64", flag: "🇳🇿", maxDigits: 9, placeholder: "21 123 4567" },
    { code: "IN", name: "India", dialCode: "+91", flag: "🇮🇳", maxDigits: 10, placeholder: "98765 43210" },
    { code: "KR", name: "South Korea", dialCode: "+82", flag: "🇰🇷", maxDigits: 10, placeholder: "10 1234 5678" },
    { code: "TW", name: "Taiwan", dialCode: "+886", flag: "🇹🇼", maxDigits: 9, placeholder: "912 345 678" },
    { code: "FR", name: "France", dialCode: "+33", flag: "🇫🇷", maxDigits: 9, placeholder: "6 12 34 56 78" },
    { code: "ES", name: "Spain", dialCode: "+34", flag: "🇪🇸", maxDigits: 9, placeholder: "612 34 56 78" },
    { code: "IT", name: "Italy", dialCode: "+39", flag: "🇮🇹", maxDigits: 10, placeholder: "312 345 6789" },
    { code: "ID", name: "Indonesia", dialCode: "+62", flag: "🇮🇩", maxDigits: 11, placeholder: "812 3456 7890" },
    { code: "VN", name: "Vietnam", dialCode: "+84", flag: "🇻🇳", maxDigits: 9, placeholder: "91 234 5678" },
    { code: "TH", name: "Thailand", dialCode: "+66", flag: "🇹🇭", maxDigits: 9, placeholder: "81 234 5678" },
];

export const OTHER_COUNTRY: CountryInfo = {
    code: "OTHER",
    name: "Other",
    dialCode: "+",
    flag: "🌐",
    maxDigits: 15,
    placeholder: "Auto-detects format (e.g. +44 7911...)",
};

export const COUNTRIES = ALL_COUNTRIES;

export const PRIMARY_COUNTRIES: CountryInfo[] = [
    ALL_COUNTRIES[0], // Philippines (+63)
    ALL_COUNTRIES[1], // United States (+1)
];

/**
 * Auto-detects country and national digits from an arbitrary phone string
 */
export function detectCountryFromPhone(input: string): { country: CountryInfo; nationalDigits: string } {
    if (!input || !input.trim()) {
        return { country: ALL_COUNTRIES[0], nationalDigits: "" };
    }

    const trimmed = input.trim();
    const cleanDigits = trimmed.replace(/\D/g, "");

    // 1. Sort countries by dial code length descending for most specific prefix match
    const sorted = [...ALL_COUNTRIES].sort((a, b) => b.dialCode.length - a.dialCode.length);
    const rawNoPlus = trimmed.startsWith("+") ? trimmed.slice(1).replace(/\D/g, "") : cleanDigits;

    for (const c of sorted) {
        const pureDial = c.dialCode.replace("+", "");
        if (rawNoPlus.startsWith(pureDial)) {
            const remainder = rawNoPlus.slice(pureDial.length);
            return {
                country: c,
                nationalDigits: remainder.slice(0, c.maxDigits),
            };
        }
    }

    // 2. Local 0917-style Philippine number
    if (cleanDigits.startsWith("0") && cleanDigits.length <= 11) {
        return {
            country: ALL_COUNTRIES[0],
            nationalDigits: cleanDigits.slice(1, 11),
        };
    }

    // 3. Fallback to OTHER with clamped digits
    return {
        country: OTHER_COUNTRY,
        nationalDigits: cleanDigits.slice(0, OTHER_COUNTRY.maxDigits),
    };
}

/**
 * Parses an arbitrary phone string into country and national number digits
 */
export function parsePhoneInput(rawPhone: string | null | undefined): {
    country: CountryInfo;
    nationalDigits: string;
} {
    if (!rawPhone || !rawPhone.trim()) {
        return { country: COUNTRIES[0], nationalDigits: "" };
    }

    return detectCountryFromPhone(rawPhone);
}

/**
 * Formats national digits according to common readable conventions
 */
export function formatNationalNumber(digits: string, country: CountryInfo): string {
    if (!digits) return "";

    if (country.code === "PH" || country.code === "US" || country.code === "CA") {
        if (digits.length <= 3) return `(${digits}`;
        if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
        return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 10)}`;
    }

    if (country.code === "SG" || country.code === "HK") {
        if (digits.length <= 4) return digits;
        return `${digits.slice(0, 4)} ${digits.slice(4, 8)}`;
    }

    if (country.code === "AU") {
        if (digits.length <= 3) return digits;
        if (digits.length <= 6) return `${digits.slice(0, 3)} ${digits.slice(3)}`;
        return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6, 9)}`;
    }

    if (country.code === "GB") {
        if (digits.length <= 4) return digits;
        return `${digits.slice(0, 4)} ${digits.slice(4, 10)}`;
    }

    // Generic chunked spacing
    return digits.replace(/(\d{3})(?=\d)/g, "$1 ").trim();
}

export interface CountryPhoneInputProps {
    value?: string;
    onChange?: (formattedPhone: string) => void;
    id?: string;
    name?: string;
    placeholder?: string;
    disabled?: boolean;
    required?: boolean;
    className?: string;
    defaultCountryCode?: string;
}

export function CountryPhoneInput({
    value = "",
    onChange,
    id,
    name,
    placeholder,
    disabled = false,
    required = false,
    className,
    defaultCountryCode = "PH",
}: CountryPhoneInputProps) {
    const defaultCountry = useMemo(() => {
        return ALL_COUNTRIES.find((c) => c.code === defaultCountryCode) || ALL_COUNTRIES[0];
    }, [defaultCountryCode]);

    const primaryCountries = useMemo(() => {
        const primary = [defaultCountry];
        // Add US if not already default, or CA if default is US
        const secondary = defaultCountry.code === "US" 
            ? ALL_COUNTRIES.find((c) => c.code === "CA")! 
            : ALL_COUNTRIES.find((c) => c.code === "US")!;
        if (secondary && !primary.some((p) => p.code === secondary.code)) {
            primary.push(secondary);
        }
        return primary;
    }, [defaultCountry]);

    const [selectedCountry, setSelectedCountry] = useState<CountryInfo>(defaultCountry);
    const [nationalDigits, setNationalDigits] = useState<string>("");
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [isOtherMode, setIsOtherMode] = useState(false);

    const containerRef = useRef<HTMLDivElement>(null);
    const searchInputRef = useRef<HTMLInputElement>(null);
    const phoneInputRef = useRef<HTMLInputElement>(null);

    // Synchronize with incoming value
    useEffect(() => {
        if (value) {
            const parsed = parsePhoneInput(value);
            setSelectedCountry(parsed.country);
            setNationalDigits(parsed.nationalDigits);
            setIsOtherMode(parsed.country.code === "OTHER");
        } else {
            setNationalDigits("");
        }
    }, [value]);

    // Close on outside click
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setIsDropdownOpen(false);
                setSearchQuery("");
            }
        };

        if (isDropdownOpen) {
            document.addEventListener("mousedown", handleClickOutside);
            setTimeout(() => {
                searchInputRef.current?.focus();
            }, 50);
        }

        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [isDropdownOpen]);

    // Close on Escape
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape" && isDropdownOpen) {
                setIsDropdownOpen(false);
                setSearchQuery("");
            }
        };
        document.addEventListener("keydown", handleKeyDown);
        return () => document.removeEventListener("keydown", handleKeyDown);
    }, [isDropdownOpen]);

    // Filtered countries list for Ticketmaster-style popover
    const filteredCountries = useMemo(() => {
        if (!searchQuery.trim()) {
            // Default: 2 primary countries + Other option (matching user screenshot)
            return [...primaryCountries, OTHER_COUNTRY];
        }
        const q = searchQuery.toLowerCase().trim().replace("+", "");
        const matches = ALL_COUNTRIES.filter((c) => {
            return (
                c.name.toLowerCase().includes(q) ||
                c.code.toLowerCase().includes(q) ||
                c.dialCode.replace("+", "").includes(q)
            );
        });
        return [...matches, OTHER_COUNTRY];
    }, [searchQuery, primaryCountries]);

    const handleSelectCountry = (country: CountryInfo) => {
        if (country.code === "OTHER") {
            setSelectedCountry(OTHER_COUNTRY);
            setIsOtherMode(true);
        } else {
            setSelectedCountry(country);
            setIsOtherMode(false);

            // Re-clamp digits to selected country limit
            const clamped = nationalDigits.slice(0, country.maxDigits);
            setNationalDigits(clamped);

            if (onChange) {
                if (clamped.length > 0) {
                    const formatted = `${country.dialCode} ${formatNationalNumber(clamped, country)}`;
                    onChange(formatted);
                } else {
                    onChange("");
                }
            }
        }

        setIsDropdownOpen(false);
        setSearchQuery("");
        phoneInputRef.current?.focus();
    };

    const handleDigitsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const raw = e.target.value;
        const digits = raw.replace(/\D/g, "");

        // If in Other mode (or typed number with potential international dial code), auto-detect
        if (isOtherMode) {
            if (!digits) {
                setNationalDigits("");
                setSelectedCountry(OTHER_COUNTRY);
                if (onChange) onChange("");
                return;
            }

            // Auto-detect country from digits entered
            const detected = detectCountryFromPhone(digits);
            if (detected.country.code !== "OTHER") {
                setSelectedCountry(detected.country);
                setNationalDigits(detected.nationalDigits);
                if (onChange) {
                    const formatted = `${detected.country.dialCode} ${formatNationalNumber(detected.nationalDigits, detected.country)}`;
                    onChange(formatted);
                }
            } else {
                setSelectedCountry(OTHER_COUNTRY);
                const clamped = digits.slice(0, OTHER_COUNTRY.maxDigits);
                setNationalDigits(clamped);
                if (onChange) {
                    const formatted = `+${clamped}`;
                    onChange(formatted);
                }
            }
            return;
        }

        // Locked country mode (PH, US, etc.)
        const clamped = digits.slice(0, selectedCountry.maxDigits);
        setNationalDigits(clamped);

        if (onChange) {
            if (clamped.length > 0) {
                const formatted = `${selectedCountry.dialCode} ${formatNationalNumber(clamped, selectedCountry)}`;
                onChange(formatted);
            } else {
                onChange("");
            }
        }
    };

    const formattedDisplay = isOtherMode && selectedCountry.code === "OTHER"
        ? (nationalDigits ? `+${nationalDigits.replace(/(\d{3})(?=\d)/g, "$1 ")}` : "")
        : formatNationalNumber(nationalDigits, selectedCountry);

    return (
        <div ref={containerRef} className="relative w-full">
            <div className={cn("flex items-center rounded-md border border-border bg-background focus-within:ring-2 focus-within:ring-primary focus-within:border-primary transition-all shadow-xs", className)}>
                {/* Trigger Button: Shows Flag, Dial Code, and Chevron */}
                <button
                    type="button"
                    onClick={() => !disabled && setIsDropdownOpen((prev) => !prev)}
                    disabled={disabled}
                    className="flex items-center gap-1.5 px-3 py-2 border-r border-border bg-muted/30 hover:bg-muted/50 rounded-l-md transition-colors shrink-0 cursor-pointer disabled:cursor-not-allowed select-none"
                    aria-label="Select Country Code"
                    aria-expanded={isDropdownOpen}
                >
                    <span className="text-base select-none" aria-hidden="true">
                        {selectedCountry.flag}
                    </span>
                    <span className="text-xs font-mono font-medium text-foreground">
                        {selectedCountry.dialCode}
                    </span>
                    <ChevronDown className={cn("h-3 w-3 text-muted-foreground transition-transform duration-200", isDropdownOpen && "rotate-180")} />
                </button>

                {/* National Number Input */}
                <div className="relative flex-1 flex items-center min-w-0">
                    <input
                        ref={phoneInputRef}
                        id={id}
                        name={name}
                        type="tel"
                        inputMode="numeric"
                        autoComplete="tel-national"
                        disabled={disabled}
                        required={required}
                        value={formattedDisplay}
                        onChange={handleDigitsChange}
                        placeholder={placeholder || (isOtherMode ? OTHER_COUNTRY.placeholder : selectedCountry.placeholder)}
                        maxLength={selectedCountry.maxDigits + 8}
                        className="w-full h-8 sm:h-9 bg-transparent px-3 text-xs sm:text-sm text-foreground placeholder:text-muted-foreground focus:outline-hidden disabled:opacity-50 disabled:cursor-not-allowed font-mono"
                    />
                    {nationalDigits.length > 0 && selectedCountry.code !== "OTHER" && (
                        <span className="text-[10px] font-mono text-muted-foreground/70 pr-2.5 shrink-0 select-none hidden sm:inline" title={`${nationalDigits.length} of ${selectedCountry.maxDigits} digits`}>
                            {nationalDigits.length}/{selectedCountry.maxDigits}
                        </span>
                    )}
                </div>
            </div>

            {/* Ticketmaster-style Popover Menu */}
            {isDropdownOpen && (
                <div className="absolute left-0 top-full mt-1.5 z-50 w-72 rounded-lg border border-border bg-popover text-popover-foreground shadow-xl overflow-hidden animate-in fade-in-50 zoom-in-95 duration-150">
                    {/* Top Search Input: 🔍 Dial code */}
                    <div className="p-2 border-b border-border/80 bg-muted/20">
                        <div className="relative flex items-center">
                            <Search className="absolute left-2.5 h-3.5 w-3.5 text-blue-500 pointer-events-none" />
                            <input
                                ref={searchInputRef}
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Dial code"
                                className="w-full pl-8 pr-3 py-1.5 text-xs bg-background rounded-md border border-border text-foreground placeholder:text-muted-foreground focus:outline-hidden focus:ring-1 focus:ring-blue-500 font-sans"
                            />
                        </div>
                    </div>

                    {/* Options List */}
                    <div className="max-h-60 overflow-y-auto p-1 space-y-0.5">
                        {filteredCountries.map((c) => {
                            const isSelected = selectedCountry.code === c.code;
                            return (
                                <div
                                    key={c.code}
                                    onClick={() => handleSelectCountry(c)}
                                    className={cn(
                                        "flex items-center justify-between px-3 py-2 rounded-md text-xs cursor-pointer transition-colors select-none",
                                        isSelected
                                            ? "bg-blue-600 text-white font-medium shadow-xs"
                                            : "text-foreground hover:bg-muted/70"
                                    )}
                                >
                                    <div className="flex items-center gap-2.5 min-w-0">
                                        <span className="text-base shrink-0">{c.flag}</span>
                                        <span className="truncate">{c.name}</span>
                                        <span className={cn("font-mono font-medium text-[11px] shrink-0", isSelected ? "text-blue-100" : "text-muted-foreground")}>
                                            {c.dialCode}
                                        </span>
                                    </div>
                                    {isSelected && <Check className="h-4 w-4 text-white shrink-0 ml-2" />}
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}
