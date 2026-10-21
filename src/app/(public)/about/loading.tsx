import { Skeleton } from "@/components/ui/skeleton";

export default function AboutLoading() {
  return (
    <div className="container mx-auto px-4 py-24 min-h-screen space-y-16 animate-in fade-in-50 duration-300">
      {/* About Hero Skeleton */}
      <div className="max-w-3xl space-y-4">
        <Skeleton className="h-6 w-36 rounded-full bg-primary/10" />
        <Skeleton className="h-14 w-4/5 rounded-xl" />
        <Skeleton className="h-5 w-full rounded-md" />
        <Skeleton className="h-5 w-2/3 rounded-md" />
      </div>

      {/* Stats Skeleton */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="p-6 rounded-2xl border border-border/70 bg-card/40 space-y-2">
            <Skeleton className="h-10 w-24 rounded-lg" />
            <Skeleton className="h-4 w-32 rounded" />
          </div>
        ))}
      </div>

      {/* Team / Content Skeleton */}
      <div className="space-y-6 pt-8">
        <Skeleton className="h-8 w-48 rounded-lg" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {[1, 2, 3].map((i) => (
            <div key={i} className="rounded-2xl border border-border/70 bg-card/40 p-6 space-y-4">
              <Skeleton className="h-48 w-full rounded-xl" />
              <Skeleton className="h-6 w-36 rounded" />
              <Skeleton className="h-4 w-28 rounded" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
