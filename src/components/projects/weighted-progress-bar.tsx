import { getProjectProgress } from "@/actions/progress";

export async function ProjectProgressCard({ projectId }: { projectId: string }) {
  const { totalWeight, completedWeight, percentage } = await getProjectProgress(projectId);

  return (
    <div className="glass-card rounded-xl border border-white/10 bg-zinc-950/70 px-4 py-2.5 shadow-md backdrop-blur-md flex items-center justify-between gap-4 flex-wrap sm:flex-nowrap">
      {/* Left: Title, Live DB Sync Badge & Points */}
      <div className="flex items-center gap-2.5 shrink-0">
        <div className="flex items-center gap-2">
          <h4 className="text-xs font-semibold tracking-tight text-zinc-100">
            Project Velocity & Weighted Progress
          </h4>
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-400 border border-emerald-500/20">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Autonomous DB Sync
          </span>
        </div>
        <span className="text-xs text-zinc-400 font-mono hidden md:inline">
          • <strong className="text-zinc-100 font-bold">{completedWeight}</strong> of{" "}
          <strong className="text-zinc-100 font-bold">{totalWeight}</strong> pts
        </span>
      </div>

      {/* Middle: Gradient Progress Bar & Percentage */}
      <div className="flex-1 min-w-[200px] max-w-xl flex items-center gap-3">
        <div className="h-2 w-full overflow-hidden rounded-full bg-white/10 p-0.5">
          <div
            className="h-full rounded-full bg-gradient-to-r from-indigo-500 via-purple-500 to-emerald-400 transition-all duration-700 ease-out shadow-sm"
            style={{ width: `${Math.min(100, Math.max(0, percentage))}%` }}
          />
        </div>
        <span className="text-sm font-extrabold font-mono text-zinc-100 shrink-0 min-w-[42px] text-right text-glow-sm">
          {percentage}%
        </span>
      </div>

      {/* Right: Technical Engine Tag */}
      <div className="hidden xl:flex items-center gap-2 shrink-0 text-[11px] text-zinc-500 font-mono">
        PostgreSQL Trigger Engine
      </div>
    </div>
  );
}
