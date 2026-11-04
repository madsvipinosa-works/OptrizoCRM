export type SprintStatus = "planned" | "active" | "ended";

/**
 * Pure date-based sprint status derivation (spec §3).
 * All arguments are YYYY-MM-DD strings; lexical comparison matches calendar order.
 * Both boundary days (today === startDate and today === endDate) are "active".
 */
export function deriveSprintStatus(
  startDate: string,
  endDate: string,
  today: string = todayInManila(),
): SprintStatus {
  if (today < startDate) {
    return "planned";
  }
  if (today > endDate) {
    return "ended";
  }
  return "active";
}

/**
 * Returns the current calendar date in Asia/Manila as YYYY-MM-DD.
 */
export function todayInManila(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);

  const year = parts.find((p) => p.type === "year")?.value ?? "";
  const month = parts.find((p) => p.type === "month")?.value ?? "";
  const day = parts.find((p) => p.type === "day")?.value ?? "";

  return `${year}-${month}-${day}`;
}

