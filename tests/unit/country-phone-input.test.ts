import { describe, it, expect } from "vitest";
import { parsePhoneInput, formatNationalNumber, COUNTRIES } from "@/components/ui/country-phone-input";

describe("CountryPhoneInput Logic", () => {
    it("defaults to Philippines (+63) with empty digits for null/empty input", () => {
        const result = parsePhoneInput("");
        expect(result.country.code).toBe("PH");
        expect(result.country.dialCode).toBe("+63");
        expect(result.nationalDigits).toBe("");
    });

    it("correctly parses standard Philippine phone with +63 prefix", () => {
        const result = parsePhoneInput("+63 (917) 555-1234");
        expect(result.country.code).toBe("PH");
        expect(result.nationalDigits).toBe("9175551234");
    });

    it("correctly converts local 0917-style Philippine number to national digits", () => {
        const result = parsePhoneInput("09171234567");
        expect(result.country.code).toBe("PH");
        expect(result.nationalDigits).toBe("9171234567");
    });

    it("correctly parses US phone number with +1 prefix", () => {
        const result = parsePhoneInput("+1 (555) 123-4567");
        expect(result.country.code).toBe("US");
        expect(result.nationalDigits).toBe("5551234567");
    });

    it("correctly parses Singapore phone number with +65 prefix", () => {
        const result = parsePhoneInput("+65 8123 4567");
        expect(result.country.code).toBe("SG");
        expect(result.nationalDigits).toBe("81234567");
    });

    it("enforces national digits clamp to country maxDigits", () => {
        // Philippines has max 10 digits
        const phCountry = COUNTRIES.find((c) => c.code === "PH")!;
        const overflow = "91755512349999999";
        const result = parsePhoneInput(`+63 ${overflow}`);
        expect(result.nationalDigits).toBe("9175551234");
        expect(result.nationalDigits.length).toBe(phCountry.maxDigits);
    });

    it("formats national digits correctly for Philippines/US", () => {
        const phCountry = COUNTRIES.find((c) => c.code === "PH")!;
        expect(formatNationalNumber("917", phCountry)).toBe("(917");
        expect(formatNationalNumber("917555", phCountry)).toBe("(917) 555");
        expect(formatNationalNumber("9175551234", phCountry)).toBe("(917) 555-1234");
    });

    it("auto-detects UK (+44) and Singapore (+65) from raw phone string", () => {
        const uk = parsePhoneInput("+44 7911 123456");
        expect(uk.country.code).toBe("GB");
        expect(uk.nationalDigits).toBe("7911123456");

        const sg = parsePhoneInput("+65 8123 4567");
        expect(sg.country.code).toBe("SG");
        expect(sg.nationalDigits).toBe("81234567");
    });

    it("falls back to OTHER country for unrecognized international dial codes with up to 15 digits", () => {
        const other = parsePhoneInput("+999 1234567890");
        expect(other.country.code).toBe("OTHER");
        expect(other.country.dialCode).toBe("+");
        expect(other.nationalDigits).toBe("9991234567890");
    });
});
