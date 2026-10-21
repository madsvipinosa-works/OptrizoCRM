import { Skeleton } from "@/components/ui/skeleton";

export default function ProjectsLoading() {
  return (
    <div className="container mx-auto px-4 py-24 min-h-screen space-y-12 animate-in fade-in-50 duration-300">
      {/* Portfolio Header Skeleton */}
      <div className="max-w-2xl space-y-4">
        <Skeleton className="h-6 w-40 rounded-full bg-primary/10" />
        <Skeleton className="h-12 w-4/5 rounded-xl" />
        <Skeleton className="h-5 w-full rounded-md" />
      </div>

      {/* Projects Grid Skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div
            key={i}
            className="rounded-3xl border border-border/70 bg-card/40 overflow-hidden space-y-4 p-6"
          >
            <Skeleton className="h-56 w-full rounded-2xl" />
            <div className="flex items-center justify-between">
              <Skeleton className="h-5 w-24 rounded-full" />
              <Skeleton className="h-5 w-20 rounded-full" />
            </div>
            <Skeleton className="h-7 w-4/5 rounded-lg" />
            <Skeleton className="h-4 w-full rounded" />
            <Skeleton className="h-4 w-3/4 rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}
