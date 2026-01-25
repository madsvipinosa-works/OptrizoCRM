import { auth } from "@/auth";

export default async function DashboardPage() {
    const session = await auth();

    return (
        <div className="p-10">
            <h1 className="text-3xl font-bold">Welcome back, {session?.user?.name}!</h1>
            <p className="text-muted-foreground mt-2">You are logged in as: <span className="text-primary">{session?.user?.role}</span></p>

            <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="p-6 border border-white/10 rounded-lg bg-white/5">
                    <h3 className="tex-lg font-bold">Total Projects</h3>
                    <p className="text-4xl font-bold mt-2">0</p>
                </div>
            </div>
        </div>
    );
}
