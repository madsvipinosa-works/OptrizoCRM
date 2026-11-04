import type { SprintStatus } from "@/features/sprints/sprint-status";

export type GanttMilestoneInput = {
  id: string;
  name: string;
  status: "Pending" | "In Progress" | "Completed" | string;
  startDate: string | null;
  endDate: string | null;
  order: number;
  doneTasks: number;
  totalTasks: number;
};

export type GanttSprintInput = {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  status: SprintStatus;
  doneTasks: number;
  totalTasks: number;
};

export type GanttKeyDateKind = "signing" | "testing_day" | "completion_sign_off";

export type GanttKeyDateInput = {
  kind: GanttKeyDateKind;
  label: string;
  date: string;
};

export type BuildGanttLayoutInput = {
  milestones: GanttMilestoneInput[];
  sprints: GanttSprintInput[];
  keyDates: GanttKeyDateInput[];
  today: string;
};

export type GanttRow = {
  id: string;
  kind: "milestone" | "sprint";
  label: string;
  status: string;
  startDate: string | null;
  endDate: string | null;
  hasDates: boolean;
  noDatesLabel: "No dates" | null;
  leftPercent: number;
  widthPercent: number;
  progressPercent: number;
  doneTasks: number;
  totalTasks: number;
  indented: boolean;
};

export type GanttKeyDateChip = {
  kind: GanttKeyDateKind;
  label: string;
  date: string;
  leftPercent: number;
};

export type GanttMonthMarker = {
  label: string;
  date: string;
  leftPercent: number;
};

export type GanttLayoutResult = {
  chartRange: {
    startDate: string;
    endDate: string;
    totalDays: number;
  } | null;
  rows: GanttRow[];
  todayPosition: {
    date: string;
    leftPercent: number | null;
    inRange: boolean;
  };
  keyDates: GanttKeyDateChip[];
  monthMarkers: GanttMonthMarker[];
};

const MS_PER_DAY = 86_400_000;
const PADDING_DAYS = 2;
const MIN_BAR_WIDTH_PERCENT = 2;

const SHORT_MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

function parseIsoDateToDayNumber(iso: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  const [y, m, d] = iso.split("-").map(Number);
  const utc = Date.UTC(y, m - 1, d);
  const dt = new Date(utc);
  if (
    dt.getUTCFullYear() !== y ||
    dt.getUTCMonth() !== m - 1 ||
    dt.getUTCDate() !== d
  ) {
    return null;
  }
  return Math.floor(utc / MS_PER_DAY);
}

function dayNumberToIsoDate(dayNum: number): string {
  const dt = new Date(dayNum * MS_PER_DAY);
  const y = dt.getUTCFullYear();
  const m = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const d = String(dt.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function computeProgressPercent(doneTasks: number, totalTasks: number): number {
  if (totalTasks <= 0 || doneTasks <= 0) return 0;
  const raw = Math.round((doneTasks / totalTasks) * 100);
  return Math.min(100, Math.max(0, raw));
}

function isDevelopmentMilestoneName(name: string): boolean {
  const lower = name.toLowerCase().trim();
  return (
    lower === "development" ||
    lower === "full-stack development" ||
    lower.includes("development")
  );
}

function clampPercent(val: number): number {
  return Math.min(100, Math.max(0, Number(val.toFixed(4))));
}

function buildMonthMarkers(
  startDay: number,
  endDay: number,
  totalDays: number,
): GanttMonthMarker[] {
  const markers: GanttMonthMarker[] = [];
  const startDt = new Date(startDay * MS_PER_DAY);
  const endDt = new Date(endDay * MS_PER_DAY);

  let y = startDt.getUTCFullYear();
  let m = startDt.getUTCMonth();

  const endYear = endDt.getUTCFullYear();
  const endMonth = endDt.getUTCMonth();

  while (y < endYear || (y === endYear && m <= endMonth)) {
    const firstOfMonthDay = Math.floor(Date.UTC(y, m, 1) / MS_PER_DAY);
    const effectiveDay = Math.max(startDay, firstOfMonthDay);
    if (effectiveDay <= endDay) {
      const leftPercent = clampPercent(((effectiveDay - startDay) / totalDays) * 100);
      const iso = dayNumberToIsoDate(effectiveDay);
      markers.push({
        label: SHORT_MONTHS[m] ?? "",
        date: iso,
        leftPercent,
      });
    }
    m += 1;
    if (m > 11) {
      m = 0;
      y += 1;
    }
  }

  return markers;
}

/**
 * Pure Gantt layout builder.
 * Accepts plain milestone, sprint, and keyDate inputs along with caller-provided `today` (YYYY-MM-DD).
 */
export function buildGanttLayout(input: BuildGanttLayoutInput): GanttLayoutResult {
  const sortedMilestones = [...input.milestones].sort((a, b) => a.order - b.order);
  const sortedSprints = [...input.sprints].sort((a, b) =>
    a.startDate.localeCompare(b.startDate),
  );
  const validKeyDates = input.keyDates.filter(
    (kd) => Boolean(kd.date) && parseIsoDateToDayNumber(kd.date) !== null,
  );

  // Collect all valid day numbers across milestones, sprints, and key dates
  const dayNumbers: number[] = [];

  for (const m of sortedMilestones) {
    if (m.startDate && m.endDate) {
      const s = parseIsoDateToDayNumber(m.startDate);
      const e = parseIsoDateToDayNumber(m.endDate);
      if (s !== null && e !== null && e >= s) {
        dayNumbers.push(s, e);
      }
    }
  }

  for (const sp of sortedSprints) {
    const s = parseIsoDateToDayNumber(sp.startDate);
    const e = parseIsoDateToDayNumber(sp.endDate);
    if (s !== null && e !== null && e >= s) {
      dayNumbers.push(s, e);
    }
  }

  for (const kd of validKeyDates) {
    const d = parseIsoDateToDayNumber(kd.date);
    if (d !== null) {
      dayNumbers.push(d);
    }
  }

  const hasRange = dayNumbers.length > 0;
  let rangeStartDay = 0;
  let rangeEndDay = 0;
  let totalDays = 1;

  if (hasRange) {
    const minDay = Math.min(...dayNumbers);
    const maxDay = Math.max(...dayNumbers);
    rangeStartDay = minDay - PADDING_DAYS;
    rangeEndDay = maxDay + PADDING_DAYS;
    totalDays = Math.max(1, rangeEndDay - rangeStartDay + 1);
  }

  function computeBarPosition(
    startDate: string | null,
    endDate: string | null,
    minWidthPercent = MIN_BAR_WIDTH_PERCENT,
  ): { hasDates: boolean; leftPercent: number; widthPercent: number } {
    if (!hasRange || !startDate || !endDate) {
      return { hasDates: false, leftPercent: 0, widthPercent: 0 };
    }
    const s = parseIsoDateToDayNumber(startDate);
    const e = parseIsoDateToDayNumber(endDate);
    if (s === null || e === null || e < s) {
      return { hasDates: false, leftPercent: 0, widthPercent: 0 };
    }

    const durationDays = e - s + 1;
    const rawLeft = ((s - rangeStartDay) / totalDays) * 100;
    const rawWidth = (durationDays / totalDays) * 100;
    const widthPercent = clampPercent(Math.max(minWidthPercent, rawWidth));
    const maxLeft = Math.max(0, 100 - widthPercent);
    const leftPercent = clampPercent(Math.min(maxLeft, Math.max(0, rawLeft)));

    return { hasDates: true, leftPercent, widthPercent };
  }

  const rows: GanttRow[] = [];
  let sprintsInserted = false;

  for (const m of sortedMilestones) {
    const pos = computeBarPosition(m.startDate, m.endDate);
    const progressPercent = computeProgressPercent(m.doneTasks, m.totalTasks);

    rows.push({
      id: m.id,
      kind: "milestone",
      label: m.name,
      status: m.status,
      startDate: pos.hasDates ? m.startDate : null,
      endDate: pos.hasDates ? m.endDate : null,
      hasDates: pos.hasDates,
      noDatesLabel: pos.hasDates ? null : "No dates",
      leftPercent: pos.leftPercent,
      widthPercent: pos.widthPercent,
      progressPercent,
      doneTasks: m.doneTasks,
      totalTasks: m.totalTasks,
      indented: false,
    });

    if (!sprintsInserted && isDevelopmentMilestoneName(m.name)) {
      sprintsInserted = true;
      for (const sp of sortedSprints) {
        const spPos = computeBarPosition(sp.startDate, sp.endDate, MIN_BAR_WIDTH_PERCENT);
        const spProgress = computeProgressPercent(sp.doneTasks, sp.totalTasks);
        rows.push({
          id: sp.id,
          kind: "sprint",
          label: sp.name,
          status: sp.status,
          startDate: spPos.hasDates ? sp.startDate : null,
          endDate: spPos.hasDates ? sp.endDate : null,
          hasDates: spPos.hasDates,
          noDatesLabel: spPos.hasDates ? null : "No dates",
          leftPercent: spPos.leftPercent,
          widthPercent: spPos.widthPercent,
          progressPercent: spProgress,
          doneTasks: sp.doneTasks,
          totalTasks: sp.totalTasks,
          indented: true,
        });
      }
    }
  }

  // If there were sprints but no milestone matched "development", append them at the end so they are never lost
  if (!sprintsInserted && sortedSprints.length > 0) {
    for (const sp of sortedSprints) {
      const spPos = computeBarPosition(sp.startDate, sp.endDate, MIN_BAR_WIDTH_PERCENT);
      const spProgress = computeProgressPercent(sp.doneTasks, sp.totalTasks);
      rows.push({
        id: sp.id,
        kind: "sprint",
        label: sp.name,
        status: sp.status,
        startDate: spPos.hasDates ? sp.startDate : null,
        endDate: spPos.hasDates ? sp.endDate : null,
        hasDates: spPos.hasDates,
        noDatesLabel: spPos.hasDates ? null : "No dates",
        leftPercent: spPos.leftPercent,
        widthPercent: spPos.widthPercent,
        progressPercent: spProgress,
        doneTasks: sp.doneTasks,
        totalTasks: sp.totalTasks,
        indented: true,
      });
    }
  }

  // Today position
  const todayDay = parseIsoDateToDayNumber(input.today);
  let todayPosition: GanttLayoutResult["todayPosition"] = {
    date: input.today,
    leftPercent: null,
    inRange: false,
  };

  if (
    hasRange &&
    todayDay !== null &&
    todayDay >= rangeStartDay &&
    todayDay <= rangeEndDay
  ) {
    const leftPercent = clampPercent(((todayDay - rangeStartDay + 0.5) / totalDays) * 100);
    todayPosition = {
      date: input.today,
      leftPercent,
      inRange: true,
    };
  }

  // Key date chips
  const keyDateChips: GanttKeyDateChip[] = [];
  if (hasRange) {
    for (const kd of validKeyDates) {
      const d = parseIsoDateToDayNumber(kd.date);
      if (d !== null) {
        const leftPercent = clampPercent(((d - rangeStartDay + 0.5) / totalDays) * 100);
        keyDateChips.push({
          kind: kd.kind,
          label: kd.label,
          date: kd.date,
          leftPercent,
        });
      }
    }
  }

  const monthMarkers = hasRange
    ? buildMonthMarkers(rangeStartDay, rangeEndDay, totalDays)
    : [];

  return {
    chartRange: hasRange
      ? {
          startDate: dayNumberToIsoDate(rangeStartDay),
          endDate: dayNumberToIsoDate(rangeEndDay),
          totalDays,
        }
      : null,
    rows,
    todayPosition,
    keyDates: keyDateChips,
    monthMarkers,
  };
}

