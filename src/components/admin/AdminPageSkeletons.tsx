import { Skeleton } from "@/components/ui/skeleton";

type HeaderProps = { action?: boolean; compact?: boolean };

function PageHeaderSkeleton({ action = false, compact = false }: HeaderProps) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="space-y-2">
        <Skeleton className={compact ? "h-8 w-56" : "h-9 w-72"} />
        <Skeleton className="h-4 w-80 max-w-full" />
      </div>
      {action && <Skeleton className="h-10 w-36" />}
    </div>
  );
}

export function AdminTableSkeleton({
  rows = 6,
  columns = 5,
  summaryCards = 0,
  action = false,
  header = true,
}: {
  rows?: number;
  columns?: number;
  summaryCards?: number;
  action?: boolean;
  header?: boolean;
}) {
  return (
    <div className="space-y-6">
      {header && <PageHeaderSkeleton action={action} />}
      {summaryCards > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: summaryCards }, (_, index) => (
            <div key={index} className="glass-card space-y-3 rounded-xl border border-border p-5">
              <Skeleton className="h-3 w-28" />
              <Skeleton className="h-8 w-20" />
              <Skeleton className="h-3 w-36 max-w-full" />
            </div>
          ))}
        </div>
      )}
      <div className="overflow-hidden rounded-xl border border-border glass-card">
        <div className="flex gap-4 border-b border-border bg-muted/40 px-5 py-4">
          {Array.from({ length: columns }, (_, index) => (
            <Skeleton key={index} className="h-4 flex-1" />
          ))}
        </div>
        <div className="divide-y divide-border">
          {Array.from({ length: rows }, (_, row) => (
            <div key={row} className="flex items-center gap-4 px-5 py-5">
              {Array.from({ length: columns }, (_, column) => (
                <Skeleton key={column} className={`h-4 ${column === 0 ? "w-32" : "flex-1"}`} />
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function AdminFormSkeleton({ sections = 1 }: { sections?: number }) {
  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <PageHeaderSkeleton compact />
      {Array.from({ length: sections }, (_, section) => (
        <section key={section} className="space-y-5 rounded-xl border border-border glass-card p-6">
          <Skeleton className="h-5 w-44" />
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            {Array.from({ length: section === 0 ? 4 : 3 }, (_, field) => (
              <div key={field} className={field === 0 && section > 0 ? "sm:col-span-2" : "space-y-2"}>
                <Skeleton className="h-4 w-28" />
                <Skeleton className={field === 0 && section > 0 ? "h-32 w-full" : "h-10 w-full"} />
              </div>
            ))}
          </div>
        </section>
      ))}
      <div className="flex justify-end gap-3">
        <Skeleton className="h-10 w-24" />
        <Skeleton className="h-10 w-32" />
      </div>
    </div>
  );
}

export function AdminBoardSkeleton({ columns = 4 }: { columns?: number }) {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton action />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: columns }, (_, column) => (
          <div key={column} className="min-h-72 space-y-3 rounded-xl border border-border bg-muted/20 p-3">
            <Skeleton className="h-5 w-32" />
            {Array.from({ length: 3 }, (_, card) => (
              <div key={card} className="space-y-3 rounded-lg border border-border glass-card p-4">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export function AdminCardsSkeleton({ count = 6, action = true }: { count?: number; action?: boolean }) {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton action={action} />
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: count }, (_, index) => (
          <div key={index} className="space-y-4 rounded-xl border border-border glass-card p-5">
            <div className="flex items-center gap-3">
              <Skeleton className="h-11 w-11 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-24" />
              </div>
            </div>
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-8 w-full" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function AdminCmsSkeleton() {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton action />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <div key={index} className="flex items-center justify-between rounded-xl border border-border glass-card p-5">
            <div className="space-y-2">
              <Skeleton className="h-3 w-28" />
              <Skeleton className="h-7 w-16" />
            </div>
            <Skeleton className="h-12 w-12 rounded-xl" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2 rounded-xl border border-border bg-muted/40 p-2 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => <Skeleton key={index} className="h-10 w-full" />)}
      </div>
      <AdminTableSkeleton rows={5} columns={4} header={false} />
    </div>
  );
}

export function AdminTeamSkeleton() {
  return (
    <div className="space-y-8">
      <PageHeaderSkeleton />
      <div className="flex justify-end">
        <Skeleton className="h-10 w-48" />
      </div>
      {[0, 1].map((section) => (
        <section key={section} className={section === 1 ? "space-y-4 border-t border-border pt-8" : "space-y-4"}>
          {section === 1 && (
            <div className="space-y-2">
              <Skeleton className="h-6 w-40" />
              <Skeleton className="h-4 w-72 max-w-full" />
            </div>
          )}
          <div className="space-y-3 rounded-xl border border-border glass-card p-5">
            <Skeleton className="h-5 w-36" />
            {Array.from({ length: section === 0 ? 4 : 5 }, (_, index) => (
              <div key={index} className="flex items-center gap-4 rounded-lg border border-border bg-muted/40 p-4">
                <Skeleton className="h-10 w-10 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-3 w-64 max-w-full" />
                </div>
                <Skeleton className="h-8 w-24" />
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

export function AdminAnalyticsSkeleton() {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <div key={index} className="space-y-3 rounded-xl border border-border glass-card p-5">
            <Skeleton className="h-3 w-28" />
            <Skeleton className="h-8 w-24" />
            <Skeleton className="h-3 w-36" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {Array.from({ length: 2 }, (_, index) => (
          <div key={index} className="space-y-4 rounded-xl border border-border glass-card p-6">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-72 w-full" />
          </div>
        ))}
      </div>
    </div>
  );
}
