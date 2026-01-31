import { db } from "@/db";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { UserRoleSelect } from "@/features/cms/team/components/UserRoleSelect";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Shield, ShieldAlert, User } from "lucide-react";

export const dynamic = 'force-dynamic';

export default async function TeamPage() {
    const session = await auth();
    if (!session?.user) redirect("/");

    const users = await db.query.users.findMany({
        orderBy: (users, { desc }) => [desc(users.role)], // Admin first
    });

    const getRoleIcon = (role: string) => {
        switch (role) {
            case "admin": return <ShieldAlert className="h-4 w-4 text-red-500" />;
            case "editor": return <Shield className="h-4 w-4 text-blue-500" />;
            default: return <User className="h-4 w-4 text-gray-500" />;
        }
    };

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-3xl font-bold tracking-tight text-glow">Team Management</h2>
                <p className="text-muted-foreground">
                    Manage user roles and access levels.
                </p>
            </div>

            <Card className="glass-card border-white/10">
                <CardHeader>
                    <CardTitle>Team Members ({users.length})</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="space-y-4">
                        {users.map((user) => (
                            <div key={user.id} className="flex items-center justify-between p-4 bg-white/5 rounded-lg border border-white/5">
                                <div className="flex items-center gap-4">
                                    <Avatar>
                                        <AvatarImage src={user.image || ""} />
                                        <AvatarFallback>{user.name?.[0] || "U"}</AvatarFallback>
                                    </Avatar>
                                    <div>
                                        <div className="font-medium flex items-center gap-2">
                                            {user.name}
                                            {user.id === session.user?.id && <Badge variant="secondary" className="text-[10px] h-5">You</Badge>}
                                        </div>
                                        <div className="text-sm text-muted-foreground">{user.email}</div>
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
                                        currentUserId={session.user?.id || ""}
                                    />
                                </div>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
