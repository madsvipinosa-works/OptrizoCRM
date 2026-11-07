"use client";

import type { GanttLayoutResult, GanttRow } from "@/features/sprints/gantt-layout";

function formatShortDate(iso: string | null): string {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return "—";
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    month: "short",
    day: "numeric",
  }).format(dt);
}

function formatFullDate(iso: string | null): string {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return "—";
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(dt);
}

function buildRowTooltip(row: GanttRow): string {
  const datePart = row.hasDates
    ? `${formatFullDate(row.startDate)} – ${formatFullDate(row.endDate)}`
    : "No dates";
  const tasksPart =
    row.totalTasks > 0
      ? `${row.doneTasks} of ${row.totalTasks} tasks done (${row.progressPercent}%)`
      : "No tasks";
  return `${row.label} · ${row.status} · ${datePart} · ${tasksPart}`;
}

function isRowDone(row: GanttRow): boolean {
  const st = row.status.toLowerCase().trim();
  return st === "completed" || st === "done" || st === "ended";
}

function isRowActive(row: GanttRow): boolean {
  const st = row.status.toLowerCase().trim();
  return st === "in progress" || st === "active";
}

export function GanttTimeline({ layout }: { layout: GanttLayoutResult }) {
  const { chartRange, rows, todayPosition, keyDates, monthMarkers } = layout;

  return (
    <div className="space-y-3.5 w-full">
      {/* Legend matching mockup 066-23e */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs sm:text-sm text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span
            aria-hidden="true"
            className="w-3.5 h-2.5 rounded-[3px] bg-brand-deep inline-block"
          />
          <span>Done</span>
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span
            aria-hidden="true"
            className="w-5 h-2.5 rounded-[3px] inline-block overflow-hidden"
            style={{
              background: "linear-gradient(90deg, var(--brand-deep) 50%, var(--brand-soft) 50%)",
            }}
          />
          <span>In progress (dark part = tasks done)</span>
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span
            aria-hidden="true"
            className="w-3.5 h-2.5 rounded-[3px] bg-muted dark:bg-muted inline-block"
          />
          <span>Planned</span>
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span
            aria-hidden="true"
            className="w-2.5 h-2.5 bg-stage-negotiation rotate-45 inline-block"
          />
          <span>Key date</span>
        </span>
        <span className="ml-auto text-xs text-muted-foreground">
          Hover a bar or ◆ for details
        </span>
      </div>

      {/* Main Gantt Card */}
      <div className="rounded-xl border border-border bg-card p-3 sm:p-4 shadow-xs overflow-x-auto">
        {rows.length === 0 ? (
          <div className="py-12 text-center text-sm text-muted-foreground">
            No milestones or sprints found for this project.
          </div>
        ) : (
          <div className="min-w-[720px]">
            {/* Header Row: Left column label + Month scale */}
            <div className="grid grid-cols-[220px_1fr] border-b border-border pb-2">
              <div className="px-3 text-xs font-semibold text-muted-foreground flex items-center">
                Milestone / Sprint
              </div>
              <div className="relative h-7">
                {chartRange ? (
                  monthMarkers.map((m, idx) => (
                    <div
                      key={`${m.date}-${idx}`}
                      className="absolute top-0 bottom-0 border-l border-border/70 pl-1.5 text-xs font-semibold text-muted-foreground select-none"
                      style={{ left: `${m.leftPercent}%` }}
                    >
                      {m.label}
                    </div>
                  ))
                ) : (
                  <div className="text-xs text-muted-foreground flex items-center h-full px-2">
                    No timeline dates set
                  </div>
                )}
              </div>
            </div>

            {/* Body Rows + Vertical Grid & Today Line Overlay */}
            <div className="relative">
              {/* Vertical month lines & Red Today Line in the chart column */}
              {chartRange && (
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute top-0 bottom-0 left-[220px] right-0 z-10"
                >
                  {monthMarkers.map((m, idx) => (
                    <div
                      key={`line-${m.date}-${idx}`}
                      className="absolute top-0 bottom-0 border-l border-border/50"
                      style={{ left: `${m.leftPercent}%` }}
                    />
                  ))}

                  {todayPosition.inRange && todayPosition.leftPercent !== null && (
                    <div
                      data-testid="gantt-today-line"
                      className="absolute top-0 bottom-0 border-l-2 border-dashed border-destructive/30"
                      style={{ left: `${todayPosition.leftPercent}%` }}
                    >
                      <span className="absolute bottom-0.5 left-1.5 whitespace-nowrap text-xs font-semibold text-destructive bg-card/90 px-1 rounded">
                        Today · {formatShortDate(todayPosition.date)}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* Milestone & Sprint Rows */}
              {rows.map((row) => {
                const tooltip = buildRowTooltip(row);
                const done = isRowDone(row);
                const active = isRowActive(row);

                return (
                  <div
                    key={`${row.kind}-${row.id}`}
                    className="grid grid-cols-[220px_1fr] items-center border-t border-border/60 min-h-[40px]"
                  >
                    {/* Label Column */}
                    <div
                      className={`pr-3 py-2 truncate flex items-center gap-1.5 ${
 row.indented
 ? "pl-7 text-xs sm:text-sm text-muted-foreground font-medium"
                          : "pl-3 text-sm font-semibold text-foreground"
                      }`}
                      title={row.label}
                    >
                      {row.indented && (
                        <span
                          aria-hidden="true"
                          className="text-xs text-muted-foreground shrink-0"
                        >
                          ▸
                        </span>
                      )}
                      <span
                        className={
                          row.indented && active
                            ? "font-semibold text-foreground truncate"
                            : "truncate"
                        }
                      >
                        {row.label}
                      </span>
                    </div>

                    {/* Bar Column */}
                    <div className="relative h-9 flex items-center px-1">
                      {!row.hasDates ? (
                        <span
                          title={tooltip}
                          className="text-xs italic text-muted-foreground px-2 py-0.5 rounded bg-muted/50 border border-dashed border-border"
                        >
                          {row.noDatesLabel ?? "No dates"}
                        </span>
                      ) : (
                        <div
                          title={tooltip}
                          className={`absolute rounded-[6px] overflow-hidden transition-all ${
 row.kind === "sprint" ? "h-4" : "h-5"
                          } ${
                            done
                              ? "bg-brand-deep"
                              : active
                                ? "bg-[var(--brand-soft)]"
                                : "bg-muted dark:bg-muted"
                          }`}
                          style={{
                            left: `${row.leftPercent}%`,
                            width: `${row.widthPercent}%`,
                          }}
                        >
                          {/* Progress fill inside bar */}
                          {!done && row.progressPercent > 0 && (
                            <div
                              className="h-full bg-[var(--brand-deep)]"
                              style={{ width: `${row.progressPercent}%` }}
                            />
                          )}

                          {/* Task count summary on wider milestone bars */}
                          {row.kind === "milestone" && row.totalTasks > 0 && (
                            <div className="absolute inset-0 flex items-center justify-end pr-2 pointer-events-none">
                              <span
                                className={`text-xs font-semibold whitespace-nowrap ${
 done
 ? "text-white"
                                    : "text-foreground"
                                }`}
                              >
                                {row.doneTasks} of {row.totalTasks} tasks done
                              </span>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Sprint task ratio label beside sprint bar */}
                      {row.hasDates && row.kind === "sprint" && row.totalTasks > 0 && (
                        <span
                          className="absolute text-xs font-semibold text-foreground whitespace-nowrap pl-1.5 pointer-events-none"
                          style={{
                            left: `calc(${row.leftPercent + row.widthPercent}%)`,
                          }}
                        >
                          {row.doneTasks} of {row.totalTasks}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}

              {/* Key Dates Row */}
              <div className="grid grid-cols-[220px_1fr] items-center border-t border-border min-h-[42px]">
                <div className="pl-3 pr-3 py-2 text-sm font-semibold text-stage-negotiation dark:text-stage-negotiation whitespace-nowrap">
                  Key dates
                </div>
                <div className="relative h-9 flex items-center">
                  {keyDates.length === 0 ? (
                    <span className="text-xs text-muted-foreground px-2">
                      No key dates recorded yet
                    </span>
                  ) : (
                    keyDates.map((kd) => (
                      <div
                        key={`${kd.kind}-${kd.date}`}
                        title={`${kd.label} · ${formatFullDate(kd.date)}`}
                        className="absolute -translate-x-1/2 w-3.5 h-3.5 bg-stage-negotiation rotate-45 ring-4 ring-stage-negotiation/30 cursor-default z-20"
                        style={{ left: `${kd.leftPercent}%` }}
                      />
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* Key Dates Bottom Chips Bar (matching mockup 066-23e) */}
            {keyDates.length > 0 && (
              <div className="mt-4 pt-3 border-t border-border/60 flex flex-wrap items-center gap-2.5">
                {keyDates.map((kd) => (
                  <span
                    key={`chip-${kd.kind}-${kd.date}`}
                    title={`${kd.label} · ${formatFullDate(kd.date)}`}
                    className="inline-flex items-center gap-2 rounded-full bg-stage-negotiation/15 dark:bg-stage-negotiation/40 border border-stage-negotiation/30 dark:border-stage-negotiation/30 px-3 py-1 text-xs sm:text-sm text-foreground"
                  >
                    <span
                      aria-hidden="true"
                      className="w-2.5 h-2.5 bg-stage-negotiation rotate-45 inline-block shrink-0"
                    />
                    <strong className="font-semibold">{kd.label}</strong>
                    <span className="text-muted-foreground">
                      {formatShortDate(kd.date)}
                    </span>
                  </span>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

