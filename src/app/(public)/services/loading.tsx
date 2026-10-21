import { Skeleton } from "@/components/ui/skeleton";

export default function ServicesLoading() {
  return (
    <div className="relative min-h-screen bg-background text-foreground overflow-hidden font-sans">
      <div className="container relative z-10 mx-auto px-4 pt-32 pb-24 space-y-16 animate-in fade-in-50 duration-300">
        {/* Header Hero Skeleton */}
        <div className="max-w-3xl mx-auto text-center space-y-4">
          <div className="flex justify-center">
            <Skeleton className="h-7 w-48 rounded-full bg-primary/10" />
          </div>
          <Skeleton className="h-14 w-4/5 mx-auto rounded-xl" />
          <Skeleton className="h-6 w-full max-w-xl mx-auto rounded-md" />
        </div>

        {/* Services Cards List Skeleton */}
        <div className="max-w-5xl mx-auto space-y-8">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="rounded-3xl border border-border/70 bg-card/50 p-8 space-y-6"
            >
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-2">
                  <Skeleton className="h-5 w-32 rounded-full" />
                  <Skeleton className="h-8 w-64 rounded-lg" />
                </div>
                <Skeleton className="h-10 w-36 rounded-full" />
              </div>
              <Skeleton className="h-4 w-full rounded" />
              <Skeleton className="h-4 w-3/4 rounded" />
              <div className="flex gap-2 pt-2">
                <Skeleton className="h-6 w-20 rounded-full" />
                <Skeleton className="h-6 w-24 rounded-full" />
                <Skeleton className="h-6 w-28 rounded-full" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
