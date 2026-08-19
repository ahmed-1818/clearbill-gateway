/**
 * Strict calendar dates — "YYYY-MM-DD", no time, no timezone.
 *
 * Financial deadlines (due_date, issue_date, billing_month) MUST NOT be stored
 * as raw `.toISOString()` timestamps: in PKT/IST (UTC+5/+5:30) a local midnight
 * serialises back one calendar day earlier, which silently triggers illegal
 * late-fee penalties. Every deadline crosses the wire as a calendar string and
 * is only ever compared through the helpers below (UTC-anchored).
 */

export type CalendarDate = string; // YYYY-MM-DD

const DAY_MS = 86_400_000;
const CALENDAR_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * LOCAL calendar formatting — the ONLY way a `Date` coming out of the UI may
 * become a "YYYY-MM-DD" string. `toISOString()` is forbidden here: at 00:00 PKT
 * (UTC+5) it renders the *previous* day, which fabricates a day of late fees.
 */
export function toLocalCalendarDate(value: Date | number = Date.now()): CalendarDate {
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

/** Formats a UTC-anchored epoch (produced by `parseCalendarDate`) back to a date. */
function fromUtcMs(ms: number): CalendarDate {
  if (Number.isNaN(ms)) return "";
  const d = new Date(ms);
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${d.getUTCFullYear()}-${mm}-${dd}`;
}

/** UTC-midnight epoch for a calendar date (or any date-like input). */
export function parseCalendarDate(value: string | number | Date): number {
  if (typeof value === "string" && CALENDAR_RE.test(value)) {
    return Date.parse(`${value}T00:00:00.000Z`);
  }
  const local = toCalendarDate(value);
  return local ? Date.parse(`${local}T00:00:00.000Z`) : NaN;
}

/** Normalises anything date-like into a strict "YYYY-MM-DD" calendar string. */
export function toCalendarDate(value: string | number | Date): CalendarDate {
  if (typeof value === "string" && CALENDAR_RE.test(value)) return value;
  if (typeof value === "string") {
    const ms = Date.parse(value);
    return Number.isNaN(ms) ? "" : toLocalCalendarDate(ms);
  }
  return toLocalCalendarDate(value);
}

/** Today in the operator's own timezone — never shifted by UTC conversion. */
export function calendarToday(): CalendarDate {
  return toLocalCalendarDate(Date.now());
}

export function addCalendarDays(value: string | number | Date, days: number): CalendarDate {
  return fromUtcMs(parseCalendarDate(value) + days * DAY_MS);
}


/** Whole calendar days from `from` → `to` (negative when `to` is earlier). */
export function calendarDaysBetween(
  from: string | number | Date,
  to: string | number | Date,
): number {
  return Math.round((parseCalendarDate(to) - parseCalendarDate(from)) / DAY_MS);
}

/** Days a deadline is past due as of `asOf` (never negative). */
export function daysOverdue(due: string | number | Date, asOf: string | number | Date = Date.now()) {
  return Math.max(0, calendarDaysBetween(due, asOf));
}

export const isCalendarDate = (v: unknown): v is CalendarDate =>
  typeof v === "string" && CALENDAR_RE.test(v);

/**
 * Strict ISO-8601 UTC timestamp ("…Z") for wire/audit fields.
 * Local browser offsets are stripped, so a value minted in PKT (UTC+5) never
 * reads back a calendar day earlier on a UTC backend.
 */
export function toUtcTimestamp(value: string | number | Date = Date.now()): string {
  const ms = value instanceof Date ? value.getTime() : typeof value === "number" ? value : Date.parse(value);
  return new Date(Number.isNaN(ms) ? Date.now() : ms).toISOString();
}
