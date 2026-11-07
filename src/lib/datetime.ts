/**
 * The one place that decides how dates and times look and which timezone they use.
 * Everything the client sees (screens, emails, notifications) goes through here,
 * so a meeting reads the same in the picker, the list, the email and the activity log.
 * Manila has no daylight saving, so a fixed +08:00 offset is exact.
 */
export const APP_TZ = "Asia/Manila";

type DateInput = Date | string | number;

const dateFmt = new Intl.DateTimeFormat("en-US", { timeZone: APP_TZ, month: "short", day: "numeric", year: "numeric" });
const timeFmt = new Intl.DateTimeFormat("en-US", { timeZone: APP_TZ, hour: "numeric", minute: "2-digit" });
const ymdFmt = new Intl.DateTimeFormat("en-CA", { timeZone: APP_TZ, year: "numeric", month: "2-digit", day: "2-digit" });
const hmFmt = new Intl.DateTimeFormat("en-GB", { timeZone: APP_TZ, hour: "2-digit", minute: "2-digit", hourCycle: "h23" });

const toDate = (v: DateInput) => (v instanceof Date ? v : new Date(v));

/** "Nov 8, 2026" */
export const formatDate = (v: DateInput) => dateFmt.format(toDate(v));
/** "10:00 AM" */
export const formatTime = (v: DateInput) => timeFmt.format(toDate(v));
/** "Nov 8, 2026, 10:00 AM" */
export const formatDateTime = (v: DateInput) => `${formatDate(v)}, ${formatTime(v)}`;

/** Today in Manila as "YYYY-MM-DD", the value an `<input type="date">` or DatePicker uses. */
export const todayYmd = (now: Date = new Date()) => ymdFmt.format(now);
/** The current Manila time as "HH:mm". */
export const nowHm = (now: Date = new Date()) => hmFmt.format(now);

/** Turns the picked "YYYY-MM-DD" and "HH:mm" into a real instant, always read as Manila time. */
export const manilaToDate = (ymd: string, hm = "00:00") => new Date(`${ymd}T${hm}:00+08:00`);

/** True when the picked Manila date (and time, if given) is before now. */
export function isPastManila(ymd: string, hm?: string, now: Date = new Date()): boolean {
  return hm ? manilaToDate(ymd, hm).getTime() < now.getTime() : ymd < todayYmd(now);
}

/** "HH:mm" to "10:00 AM", for time pickers that hold a plain string. */
export function formatHm(hm: string): string {
  return formatTime(manilaToDate("2000-01-01", hm));
}
