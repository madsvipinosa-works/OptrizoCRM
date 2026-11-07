/**
 * The one place that decides how dates and times look and which timezone they use.
 * Staff screens, logs and notifications always use Manila time (APP_TZ). Client screens and emails
 * may pass the client's own timezone; they then show it with a label next to the Manila time.
 * Meetings are stored as exact moments, so only the display and the picked input change.
 */
export const APP_TZ = "Asia/Manila";

type DateInput = Date | string | number;

const cache = new Map<string, Intl.DateTimeFormat>();
function fmt(tz: string, kind: string, opts: Intl.DateTimeFormatOptions, locale = "en-US") {
  const key = `${tz}|${kind}`;
  let f = cache.get(key);
  if (!f) cache.set(key, (f = new Intl.DateTimeFormat(locale, { timeZone: tz, ...opts })));
  return f;
}

const toDate = (v: DateInput) => (v instanceof Date ? v : new Date(v));

/** True when the browser or server knows this IANA timezone name. */
export function isValidTimezone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/** "Nov 8, 2026" */
export const formatDate = (v: DateInput, tz = APP_TZ) =>
  fmt(tz, "d", { month: "short", day: "numeric", year: "numeric" }).format(toDate(v));
/** "10:00 AM" */
export const formatTime = (v: DateInput, tz = APP_TZ) =>
  fmt(tz, "t", { hour: "numeric", minute: "2-digit" }).format(toDate(v));
/** "Nov 8, 2026, 10:00 AM" */
export const formatDateTime = (v: DateInput, tz = APP_TZ) => `${formatDate(v, tz)}, ${formatTime(v, tz)}`;

/** Short zone name: "PHT" for Manila, otherwise what Intl gives ("GMT+4", "PDT"). */
export function tzLabel(v: DateInput, tz = APP_TZ): string {
  if (tz === APP_TZ) return "PHT";
  return fmt(tz, "z", { timeZoneName: "short" }).formatToParts(toDate(v)).find((p) => p.type === "timeZoneName")?.value ?? tz;
}

/**
 * For clients and emails. Manila (or no zone): "Nov 6, 2026, 10:00 AM (Manila time)".
 * Another zone: "Nov 6, 2026, 6:00 AM GMT+4 (Nov 6, 2026, 10:00 AM Manila time)", so both sides can check the same moment.
 */
export function formatWithZone(v: DateInput, tz?: string | null): string {
  if (!tz || tz === APP_TZ) return `${formatDateTime(v)} (Manila time)`;
  return `${formatDateTime(v, tz)} ${tzLabel(v, tz)} (${formatDateTime(v)} Manila time)`;
}

/** Today in a zone as "YYYY-MM-DD", the value an `<input type="date">` or DatePicker uses. */
export const todayYmd = (now: Date = new Date(), tz = APP_TZ) =>
  fmt(tz, "ymd", { year: "numeric", month: "2-digit", day: "2-digit" }, "en-CA").format(now);
/** The current time in a zone as "HH:mm". */
export const nowHm = (now: Date = new Date(), tz = APP_TZ) =>
  fmt(tz, "hm", { hour: "2-digit", minute: "2-digit", hourCycle: "h23" }, "en-GB").format(now);

function offsetMs(t: number, tz: string): number {
  const p = Object.fromEntries(
    fmt(tz, "parts", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" })
      .formatToParts(new Date(t))
      .map((x) => [x.type, Number(x.value)])
  );
  return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - Math.floor(t / 1000) * 1000;
}

/** Turns a picked "YYYY-MM-DD" and "HH:mm" in a zone into a real instant. */
export function zonedToDate(ymd: string, hm: string, tz = APP_TZ): Date {
  const wall = Date.parse(`${ymd}T${hm}:00Z`);
  if (Number.isNaN(wall)) return new Date(NaN);
  const guess = wall - offsetMs(wall, tz);
  return new Date(wall - offsetMs(guess, tz));
}

/** Manila has no daylight saving, so a fixed +08:00 offset is exact. */
export const manilaToDate = (ymd: string, hm = "00:00") => new Date(`${ymd}T${hm}:00+08:00`);

/** True when the picked date (and time, if given) in that zone is before now. */
export function isPastIn(ymd: string, hm: string | undefined, tz: string, now: Date = new Date()): boolean {
  return hm ? zonedToDate(ymd, hm, tz).getTime() < now.getTime() : ymd < todayYmd(now, tz);
}
export const isPastManila = (ymd: string, hm?: string, now: Date = new Date()) => isPastIn(ymd, hm, APP_TZ, now);

/** "Nov 2026" */
export const formatMonthYear = (v: DateInput, tz = APP_TZ) =>
  fmt(tz, "my", { month: "short", year: "numeric" }).format(toDate(v));

/** "HH:mm" to "10:00 AM", for time pickers that hold a plain string. */
export function formatHm(hm: string): string {
  return formatTime(manilaToDate("2000-01-01", hm));
}
