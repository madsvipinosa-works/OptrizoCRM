import { getProjectProgress } from "@/actions/progress";

export async function ProjectProgressCard({ projectId }: { projectId: string }) {
  const { totalWeight, completedWeight, percentage } = await getProjectProgress(projectId);

  return (
    <div className="glass-card rounded-xl border border-border px-4 py-2.5 shadow-sm backdrop-blur-md flex items-center justify-between gap-4 flex-wrap sm:flex-nowrap">
      {/* Left: Title, Live DB Sync Badge & Points */}
      <div className="flex items-center gap-2.5 shrink-0">
        <div className="flex items-center gap-2">
          <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-foreground">
            Velocity & Weighted Progress
          </h4>
          <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-mono font-medium text-primary border border-primary/20">
            <span className="h-1.5 w-1.5 rounded-full bg-[#00D639] animate-pulse" />
            Live Sync
          </span>
        </div>
        <span className="text-xs text-muted-foreground font-mono hidden md:inline">
          • <strong className="text-foreground font-bold">{completedWeight}</strong> of{" "}
          <strong className="text-foreground font-bold">{totalWeight}</strong> pts
        </span>
      </div>

      {/* Middle: Gradient Progress Bar & Percentage */}
      <div className="flex-1 min-w-[200px] max-w-xl flex items-center gap-3">
        <div className="h-2 w-full overflow-hidden rounded-full bg-muted p-0.5 border border-border/50">
          <div
            className="h-full rounded-full bg-gradient-to-r from-emerald-500 via-primary to-[#00D639] transition-all duration-700 ease-out shadow-[0_0_10px_rgba(0,214,57,0.3)]"
            style={{ width: `${Math.min(100, Math.max(0, percentage))}%` }}
          />
        </div>
        <span className="text-sm font-extrabold font-mono text-foreground shrink-0 min-w-[42px] text-right">
          {percentage}%
        </span>
      </div>

      {/* Right: Technical Engine Tag */}
      <div className="hidden xl:flex items-center gap-2 shrink-0 text-[10px] text-muted-foreground font-mono uppercase tracking-wider">
        Trigger Engine // PG
      </div>
    </div>
  );
}
