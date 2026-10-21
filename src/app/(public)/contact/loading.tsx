import { Skeleton } from "@/components/ui/skeleton";

export default function ContactLoading() {
  return (
    <div className="container mx-auto px-4 py-24 min-h-screen animate-in fade-in-50 duration-300">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-16">
        {/* Left Column: Info Skeleton */}
        <div className="space-y-8">
          <div className="space-y-4">
            <Skeleton className="h-14 w-4/5 rounded-xl" />
            <Skeleton className="h-6 w-full max-w-md rounded" />
          </div>

          <div className="space-y-6 pt-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-start gap-4">
                <Skeleton className="h-12 w-12 rounded-lg shrink-0" />
                <div className="space-y-2 flex-1">
                  <Skeleton className="h-5 w-28 rounded" />
                  <Skeleton className="h-4 w-48 rounded" />
                </div>
              </div>
            ))}
          </div>

          {/* FAQ Accordion Skeleton */}
          <div className="pt-8 space-y-4">
            <Skeleton className="h-7 w-52 rounded" />
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-12 w-full rounded-lg" />
              ))}
            </div>
          </div>
        </div>

        {/* Right Column: Form Skeleton */}
        <div className="rounded-3xl border border-border/80 bg-card/60 p-8 space-y-6">
          <Skeleton className="h-8 w-44 rounded-lg" />
          <Skeleton className="h-4 w-64 rounded" />
          <div className="space-y-4 pt-4">
            <div className="space-y-2">
              <Skeleton className="h-4 w-16 rounded" />
              <Skeleton className="h-10 w-full rounded-md" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-4 w-16 rounded" />
              <Skeleton className="h-10 w-full rounded-md" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-4 w-20 rounded" />
              <Skeleton className="h-28 w-full rounded-md" />
            </div>
            <Skeleton className="h-11 w-full rounded-lg" />
          </div>
        </div>
      </div>
    </div>
  );
}
