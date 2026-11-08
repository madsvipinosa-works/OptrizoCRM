import { Skeleton } from "@/components/ui/skeleton";

/** Same shape as the Work page: intro on the left, then two-column project cards. */
export default function ProjectsLoading() {
    return (
        <div className="mx-auto min-h-screen w-full max-w-6xl px-4 pb-24 pt-32 sm:px-6 lg:px-8">
            <div className="max-w-2xl space-y-4">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-12 w-4/5" />
                <Skeleton className="h-5 w-full" />
            </div>
            <div className="mt-16 grid gap-6 md:grid-cols-2">
                {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="overflow-hidden rounded-2xl border border-border bg-card">
                        <Skeleton className="aspect-[16/10] w-full rounded-none" />
                        <div className="space-y-2 p-5">
                            <Skeleton className="h-5 w-3/5" />
                            <Skeleton className="h-4 w-4/5" />
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
