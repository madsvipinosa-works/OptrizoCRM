import { Skeleton } from "@/components/ui/skeleton";

export default function PublicLoading() {
  return (
    <div className="container mx-auto px-4 py-24 min-h-[80vh] space-y-12 animate-in fade-in-50 duration-300">
      {/* Header Skeleton */}
      <div className="space-y-4 max-w-2xl">
        <Skeleton className="h-6 w-36 rounded-full bg-primary/10" />
        <Skeleton className="h-12 w-3/4 rounded-xl" />
        <Skeleton className="h-5 w-full rounded-md" />
        <Skeleton className="h-5 w-2/3 rounded-md" />
      </div>

      {/* Grid of Content Cards Skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 pt-4">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div
            key={i}
            className="rounded-2xl border border-border/60 bg-card/40 p-6 space-y-4 overflow-hidden relative"
          >
            <div className="flex items-center justify-between">
              <Skeleton className="h-5 w-24 rounded-full" />
              <Skeleton className="h-5 w-16 rounded-full" />
            </div>
            <Skeleton className="h-44 w-full rounded-xl" />
            <Skeleton className="h-7 w-4/5 rounded-lg" />
            <div className="space-y-2">
              <Skeleton className="h-4 w-full rounded-md" />
              <Skeleton className="h-4 w-5/6 rounded-md" />
            </div>
            <div className="pt-4 border-t border-border/40 flex justify-between items-center">
              <Skeleton className="h-4 w-20 rounded" />
              <Skeleton className="h-8 w-8 rounded-full" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
