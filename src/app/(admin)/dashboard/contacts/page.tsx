import { db } from "@/db";
import { users, leads } from "@/db/schema";
import { eq } from "drizzle-orm";
import { auth } from "@/auth";

export const dynamic = 'force-dynamic';

export default async function ContactsPage() {
    const session = await auth();
    if (!session?.user || (session.user.role !== "admin" && session.user.role !== "editor")) {
        return <div className="p-8 text-white">Unauthorized</div>;
    }

    const clients = await db.query.users.findMany({
        where: eq(users.role, "client"),
        orderBy: (users, { desc }) => [desc(users.id)]
    });

    const allLeads = await db.query.leads.findMany();

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-3xl font-bold tracking-tight text-glow">Contacts Directory</h2>
                <p className="text-muted-foreground">
                    Client profiles and interaction histories.
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {clients.map(client => {
                    const clientDeals = allLeads.filter(l => l.clientId === client.id);
                    return (
                        <div key={client.id} className="bg-[#050505] border border-[#262626] rounded-xl p-6 hover:border-white/20 transition-all">
                            <div className="flex items-center gap-4 mb-4">
                                {client.image ? (
                                    <img src={client.image} alt={client.name || "Client"} className="h-12 w-12 rounded-full object-cover" />
                                ) : (
                                    <div className="h-12 w-12 rounded-full bg-[#1A1A1A] flex items-center justify-center text-white font-bold">
                                        {client.name?.charAt(0) || client.email.charAt(0)}
                                    </div>
                                )}
                                <div>
                                    <h3 className="text-lg font-semibold text-white">{client.name || "Unnamed Contact"}</h3>
                                    <p className="text-sm text-zinc-400">{client.email}</p>
                                </div>
                            </div>
                            
                            <div className="space-y-2 mb-6">
                                {client.companyName && (
                                    <div className="text-sm">
                                        <span className="text-zinc-500">Company: </span>
                                        <span className="text-white">{client.companyName}</span>
                                    </div>
                                )}
                                {client.industry && (
                                    <div className="text-sm">
                                        <span className="text-zinc-500">Industry: </span>
                                        <span className="text-white">{client.industry}</span>
                                    </div>
                                )}
                                {client.linkedInUrl && (
                                    <div className="text-sm">
                                        <span className="text-zinc-500">LinkedIn: </span>
                                        <a href={client.linkedInUrl} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">Profile</a>
                                    </div>
                                )}
                            </div>

                            <div className="pt-4 border-t border-[#262626]">
                                <h4 className="text-sm font-medium text-white mb-2">Associated Deals ({clientDeals.length})</h4>
                                <div className="space-y-2">
                                    {clientDeals.slice(0, 3).map(deal => (
                                        <div key={deal.id} className="text-xs flex justify-between items-center bg-[#1A1A1A] p-2 rounded">
                                            <span className="truncate flex-1">{deal.businessName || "General Project"}</span>
                                            <span className="text-zinc-400 ml-2">{deal.status}</span>
                                        </div>
                                    ))}
                                    {clientDeals.length > 3 && (
                                        <div className="text-xs text-zinc-500 text-center pt-1">+ {clientDeals.length - 3} more</div>
                                    )}
                                </div>
                            </div>
                        </div>
                    );
                })}

                {clients.length === 0 && (
                    <div className="col-span-full py-12 text-center text-zinc-500 bg-[#050505] border border-[#262626] rounded-xl">
                        No clients found in the directory.
                    </div>
                )}
            </div>
        </div>
    );
}
