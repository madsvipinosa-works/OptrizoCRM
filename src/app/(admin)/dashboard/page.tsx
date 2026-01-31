import { db } from "@/db";
import { leads, posts, projects } from "@/db/schema";
import { sql } from "drizzle-orm";
import { auth } from "@/auth";

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
    const session = await auth();

    // Fetch Counts in parallel
    const [leadsCount] = await db.select({ count: sql<number>`count(*)` }).from(leads);
    const [postsCount] = await db.select({ count: sql<number>`count(*)` }).from(posts);
    const [projectsCount] = await db.select({ count: sql<number>`count(*)` }).from(projects);

    return (
        <div className="p-10 space-y-8">
            <div>
                <h1 className="text-3xl font-bold">Welcome back, {session?.user?.name}!</h1>
                <p className="text-muted-foreground mt-2">Here is what&apos;s happening with your content today.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Leads Card */}
                <div className="p-6 border border-white/10 rounded-lg bg-white/5 hover:bg-white/10 transition-colors">
                    <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Total Leads</h3>
                    <p className="text-4xl font-bold mt-2 text-white">{Number(leadsCount.count)}</p>
                </div>

                {/* Projects Card */}
                <div className="p-6 border border-white/10 rounded-lg bg-white/5 hover:bg-white/10 transition-colors">
                    <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Portfolio Items</h3>
                    <p className="text-4xl font-bold mt-2 text-white">{Number(projectsCount.count)}</p>
                </div>

                {/* Posts Card */}
                <div className="p-6 border border-white/10 rounded-lg bg-white/5 hover:bg-white/10 transition-colors">
                    <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Blog Posts</h3>
                    <p className="text-4xl font-bold mt-2 text-white">{Number(postsCount.count)}</p>
                </div>
            </div>
        </div>
    );
}
