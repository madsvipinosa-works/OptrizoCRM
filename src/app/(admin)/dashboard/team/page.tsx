import { db } from "@/db";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { UserRoleSelect } from "@/features/cms/team/components/UserRoleSelect";
import { JobTitleEditor } from "@/features/cms/team/components/JobTitleEditor";
import { UserActiveToggle } from "@/features/cms/team/components/UserActiveToggle";
import { UserAboutToggle } from "@/features/cms/team/components/UserAboutToggle";
import { TeamToolbar } from "@/features/cms/team/components/TeamToolbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Shield, ShieldAlert, User } from "lucide-react";
import { users } from "@/db/schema";
import { inArray, ilike, or, and, eq } from "drizzle-orm";

export const dynamic = 'force-dynamic';

export default async function TeamPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
    const session = await auth();
    if (!session?.user) redirect("/");

    const params = await searchParams;
    const query = params.q || "";

    const searchFilter = query ? or(
        ilike(users.name, `%${query}%`),
        ilike(users.email, `%${query}%`)
    ) : undefined;

    const teamMembers = await db.query.users.findMany({
        where: and(
            inArray(users.role, ["admin", "editor"]),
            searchFilter
        ),
        orderBy: (users, { desc }) => [desc(users.role)],
    });

    const regularUsers = await db.query.users.findMany({
        where: and(
            inArray(users.role, ["user", "client"]),
            searchFilter
        ),
        limit: 50, // Limit to prevent massive lists
        orderBy: (users, { desc }) => [desc(users.email)],
    });

    return (
        <div className="space-y-8">
            <div>
                <h2 className="text-3xl font-bold tracking-tight text-glow">User Management</h2>
                <p className="text-muted-foreground">
                    Manage staff access and registered users/clients.
                </p>
            </div>

            <TeamToolbar />

            <UserList list={teamMembers} title="Staff Members" currentUserId={session.user?.id || ""} />

            <div className="pt-8 border-t border-white/10">
                <h3 className="text-xl font-bold mb-4">User Directory</h3>
                <p className="text-sm text-muted-foreground mb-6">Promote regular users to give them dashboard access.</p>
                <UserList list={regularUsers} title="Registered Users" currentUserId={session.user?.id || ""} />
            </div>
        </div>
    );
}

const getRoleIcon = (role: string) => {
    switch (role) {
        case "admin": return <ShieldAlert className="h-4 w-4 text-red-500" />;
        case "editor": return <Shield className="h-4 w-4 text-blue-500" />;
        default: return <User className="h-4 w-4 text-gray-500" />;
    }
};

interface UserListItem {
    id: string;
    name: string | null;
    email: string;
    image: string | null;
    jobTitle: string | null;
    isActive: boolean;
    showOnAboutPage: boolean;
    role: "user" | "admin" | "editor" | "client";
}

const UserList = ({ list, title, currentUserId }: { list: UserListItem[], title: string, currentUserId: string }) => (
    <Card className="glass-card border-white/10">
        <CardHeader>
            <CardTitle>{title} ({list.length})</CardTitle>
        </CardHeader>
        <CardContent>
            <div className="space-y-4">
                {list.length === 0 && <p className="text-muted-foreground text-sm italic">No users found.</p>}
                {list.map((user) => (
                    <div key={user.id} className="flex items-center justify-between p-4 bg-white/5 rounded-lg border border-white/5 hover:border-white/10 transition-colors">
                        <div className="flex items-center gap-4">
                            <Avatar>
                                <AvatarImage src={user.image || ""} />
                                <AvatarFallback>{user.name?.[0] || "U"}</AvatarFallback>
                            </Avatar>
                            <div>
                                <div className="font-medium flex items-center gap-2">
                                    {user.name}
                                    {user.id === currentUserId && <Badge variant="secondary" className="text-[10px] h-5">You</Badge>}
                                </div>
                                <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 mt-1">
                                    <span className="text-sm text-muted-foreground">{user.email}</span>
                                    <span className="hidden sm:block w-1 h-1 rounded-full bg-white/20" />
                                    <JobTitleEditor userId={user.id} currentTitle={user.jobTitle} isAdmin={true} />
                                    <span className="hidden sm:block w-1 h-1 rounded-full bg-white/20" />
                                    <UserActiveToggle userId={user.id} isActive={user.isActive} isAdmin={true} />
                                    {(user.role === "admin" || user.role === "editor") && (
                                        <>
                                            <span className="hidden sm:block w-1 h-1 rounded-full bg-white/20" />
                                            <UserAboutToggle userId={user.id} isPublic={user.showOnAboutPage} isAdmin={true} />
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center gap-4">
                            <div className="flex items-center gap-2 text-sm text-muted-foreground mr-4">
                                {getRoleIcon(user.role)}
                                <span className="capitalize hidden md:inline">{user.role}</span>
                            </div>

                            <UserRoleSelect
                                userId={user.id}
                                currentRole={user.role}
                                currentUserId={currentUserId}
                            />
                        </div>
                    </div>
                ))}
            </div>
        </CardContent>
    </Card>
);
