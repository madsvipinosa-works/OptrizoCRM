import { Skeleton } from "@/components/ui/skeleton";

export default function ClientPortalLoading() {
  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      <div>
        <Skeleton className="h-10 w-64 mb-2" />
        <Skeleton className="h-4 w-96" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
           {[...Array(2)].map((_, i) => (
             <div key={i} className="glass-card border border-border rounded-xl overflow-hidden">
                <div className="p-6 border-b border-border/40">
                   <div className="flex justify-between items-start mb-4">
                      <Skeleton className="h-8 w-1/3" />
                      <Skeleton className="h-6 w-24 rounded-full" />
                   </div>
                   <Skeleton className="h-4 w-2/3 mb-4" />
                   <div className="flex gap-4">
                      <Skeleton className="h-8 w-24 rounded-md" />
                      <Skeleton className="h-8 w-24 rounded-md" />
                   </div>
                </div>
                <div className="p-6 bg-muted/20">
                   <Skeleton className="h-32 w-full rounded-md" />
                </div>
             </div>
           ))}
        </div>
        
        <div className="space-y-6">
           <div className="glass-card border border-border rounded-xl p-6">
              <Skeleton className="h-6 w-32 mb-4" />
              <div className="space-y-4">
                 {[...Array(3)].map((_, i) => (
                    <div key={i} className="flex gap-3">
                       <Skeleton className="h-8 w-8 rounded-full flex-shrink-0" />
                       <div className="space-y-2 flex-1">
                          <Skeleton className="h-4 w-full" />
                          <Skeleton className="h-3 w-2/3" />
                       </div>
                    </div>
                 ))}
              </div>
           </div>
        </div>
      </div>
    </div>
  );
}
