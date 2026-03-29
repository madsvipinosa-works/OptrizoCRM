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
                <h1 className="text-3xl font-bold text-white tracking-tight">Welcome back, {session?.user?.name}!</h1>
                <p className="text-[#A3A3A3] text-[15px] mt-2">Here is what&apos;s happening with your content today.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Leads Card */}
                <div className="bg-[#121212] border border-[#262626] p-6 rounded-[1rem]">
                    <h3 className="text-[14px] font-semibold text-[#A3A3A3] uppercase tracking-wider">Total Leads</h3>
                    <p className="text-4xl font-bold tracking-tight mt-2 text-white">{Number(leadsCount.count)}</p>
                </div>

                {/* Projects Card */}
                <div className="bg-[#121212] border border-[#262626] p-6 rounded-[1rem]">
                    <h3 className="text-[14px] font-semibold text-[#A3A3A3] uppercase tracking-wider">Portfolio Items</h3>
                    <p className="text-4xl font-bold tracking-tight mt-2 text-white">{Number(projectsCount.count)}</p>
                </div>

                {/* Posts Card */}
                <div className="bg-[#121212] border border-[#262626] p-6 rounded-[1rem]">
                    <h3 className="text-[14px] font-semibold text-[#A3A3A3] uppercase tracking-wider">Blog Posts</h3>
                    <p className="text-4xl font-bold tracking-tight mt-2 text-white">{Number(postsCount.count)}</p>
                </div>
            </div>
        </div>
    );
}
