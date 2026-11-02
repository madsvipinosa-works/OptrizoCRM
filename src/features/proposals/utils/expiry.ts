/**
 * Checks whether a proposal is expired based on its validUntil date.
 * Expiry is evaluated at the end of the day (23:59:59.999) in the Asia/Manila (UTC+8) timezone.
 * If validUntil is missing or invalid, the proposal does not expire (returns false).
 */
export function isProposalExpired(
    validUntil?: Date | string | null,
    now: Date = new Date()
): boolean {
    if (!validUntil) return false;

    const targetDate = typeof validUntil === "string" ? new Date(validUntil) : validUntil;
    if (isNaN(targetDate.getTime())) return false;

    // Get the year, month, date in Asia/Manila timezone
    const formatter = new Intl.DateTimeFormat("en-US", {
        timeZone: "Asia/Manila",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    });

    const targetParts = formatter.formatToParts(targetDate);
    const targetYear = parseInt(targetParts.find((p) => p.type === "year")!.value, 10);
    const targetMonth = parseInt(targetParts.find((p) => p.type === "month")!.value, 10);
    const targetDay = parseInt(targetParts.find((p) => p.type === "day")!.value, 10);

    // End of day in Asia/Manila (UTC+8) is 23:59:59.999 Manila time.
    // UTC time = Manila time - 8 hours.
    // 23:59:59.999 - 8h = 15:59:59.999 UTC.
    const endOfDayUtcMillis = Date.UTC(targetYear, targetMonth - 1, targetDay, 15, 59, 59, 999);

    return now.getTime() > endOfDayUtcMillis;
}
