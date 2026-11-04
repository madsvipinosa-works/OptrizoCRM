import { db } from "@/db";
import { requireRole } from "@/lib/authz";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { UserRoleSelect } from "@/features/cms/team/components/UserRoleSelect";
import { JobTitleEditor } from "@/features/cms/team/components/JobTitleEditor";
import { UserActiveToggle } from "@/features/cms/team/components/UserActiveToggle";
import { UserAboutToggle } from "@/features/cms/team/components/UserAboutToggle";
import { TeamToolbar } from "@/features/cms/team/components/TeamToolbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Shield, ShieldAlert, User, UserPlus } from "lucide-react";
import { users } from "@/db/schema";
import { inArray, ilike, or, and, eq } from "drizzle-orm";

export const dynamic = 'force-dynamic';

export default async function TeamPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
    const authz = await requireRole(["superadmin"]);
    if (!authz.ok) {
        redirect("/dashboard");
    }
    const session = authz.session;


    const params = await searchParams;
    const query = params.q || "";

    const searchFilter = query ? or(
        ilike(users.name, `%${query}%`),
        ilike(users.email, `%${query}%`)
    ) : undefined;

    const teamMembers = await db.query.users.findMany({
        where: and(
            inArray(users.role, ["superadmin", "sales", "manager", "developer", "content_editor"]),
            searchFilter
        ),
        orderBy: (users, { desc }) => [desc(users.role)],
    });

    const regularUsers = await db.query.users.findMany({
        where: and(
            inArray(users.role, ["client"]),
            searchFilter
        ),
        limit: 50, // Limit to prevent massive lists
        orderBy: (users, { desc }) => [desc(users.email)],
    });

    return (
        <div className="space-y-8">
            <div>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 w-full">
                    <div>
                        <h2 className="text-3xl font-bold tracking-tight text-glow">User Management</h2>
                    <p className="text-muted-foreground">Manage staff access and registered users/clients.</p>

    
                </div>
                <Link href="/dashboard/team/new">
                    <Button className="bg-[#0e6b7e] hover:bg-[#0e6b7e]/90 text-white font-semibold gap-1.5 shadow-sm">
                        <UserPlus className="w-4 h-4" />
                        Invite staff
                    </Button>
                </Link>
            </div>


            </div>

            <TeamToolbar />

            <UserList list={teamMembers} title="Staff Members" currentUserId={session.user?.id || ""} />

            <div className="pt-8 border-t border-border">
                <h3 className="text-xl font-bold mb-4">User Directory</h3>
                <p className="text-sm text-muted-foreground mb-6">Promote regular users to give them dashboard access.</p>
                <UserList list={regularUsers} title="Registered Users" currentUserId={session.user?.id || ""} />
            </div>
        </div>
    );
}

const getRoleIcon = (role: string) => {
    switch (role) {
        case "superadmin": return <ShieldAlert className="h-4 w-4 text-red-500" />;
        case "sales": return <Shield className="h-4 w-4 text-emerald-500" />;
        case "manager": return <Shield className="h-4 w-4 text-amber-500" />;
        case "developer": return <User className="h-4 w-4 text-purple-500" />;
        case "content_editor": return <User className="h-4 w-4 text-blue-500" />;
        default: return <User className="h-4 w-4 text-gray-500" />;
    }
};

interface UserListItem {
    id: string;
    name: string | null;
    email: string;
    image: string | null;
    jobTitle: string | null;
    status?: "active" | "locked" | "deactivated" | "invited";
    isActive: boolean;
    showOnAboutPage: boolean;
    role: "superadmin" | "sales" | "manager" | "developer" | "content_editor" | "client";
}

const UserList = ({ list, title, currentUserId }: { list: UserListItem[], title: string, currentUserId: string }) => (
    <Card className="glass-card border-border">
        <CardHeader>
            <CardTitle>{title} ({list.length})</CardTitle>
        </CardHeader>
        <CardContent>
            <div className="space-y-4">
                {list.length === 0 && <p className="text-muted-foreground text-sm italic">No users found.</p>}
                {list.map((user) => (
                    <div key={user.id} className="flex items-center justify-between p-4 bg-muted/40 rounded-lg border border-border hover:border-primary/40 transition-colors">
                        <div className="flex items-center gap-4">
                            <Avatar className="border border-border">
                                <AvatarImage src={user.image || ""} />
                                <AvatarFallback className="bg-primary/10 text-primary font-bold">{user.name?.[0] || "U"}</AvatarFallback>
                            </Avatar>
                            <div>
                                <div className="font-medium flex items-center gap-2 text-foreground">
                                    {user.name}
                                    {user.id === currentUserId && <Badge variant="secondary" className="text-[10px] h-5">You</Badge>}
                                </div>
                                <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 mt-1">
                                    <span className="text-sm text-muted-foreground">{user.email}</span>
                                    <span className="hidden sm:block w-1 h-1 rounded-full bg-border" />
                                    <JobTitleEditor userId={user.id} currentTitle={user.jobTitle} isAdmin={true} />
                                    <span className="hidden sm:block w-1 h-1 rounded-full bg-border" />
                                    <UserActiveToggle userId={user.id} status={user.status} isActive={user.isActive} isAdmin={true} userName={user.name || user.email} userRole={user.role} />
                                    {user.role !== "client" && (
                                        <>
                                            <span className="hidden sm:block w-1 h-1 rounded-full bg-border" />
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
