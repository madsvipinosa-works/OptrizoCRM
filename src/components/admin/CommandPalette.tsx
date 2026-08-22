"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Command } from "cmdk";
import {
    BarChart3,
    Mail,
    Users,
    KanbanSquare,
    Monitor,
    Settings,
    ShieldAlert,
    Search,
    FileText,
    Briefcase,
    HelpCircle,
    Sparkles,
} from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

interface CommandPaletteProps {
    open: boolean;
    setOpen: (open: boolean) => void;
    userRole?: string;
}

export function CommandPalette({ open, setOpen, userRole = "client" }: CommandPaletteProps) {
    const router = useRouter();
    const hasRole = (roles: string[]) => roles.includes(userRole);

    React.useEffect(() => {
        const down = (e: KeyboardEvent) => {
            if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                setOpen(!open);
            }
        };

        document.addEventListener("keydown", down);
        return () => document.removeEventListener("keydown", down);
    }, [open, setOpen]);

    const runCommand = (command: () => void) => {
        setOpen(false);
        command();
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogContent className="p-0 overflow-hidden max-w-xl bg-[#09090b] border-white/10 text-white shadow-2xl rounded-2xl">
                <DialogTitle className="sr-only">Quick Search Command Palette</DialogTitle>
                <Command className="w-full bg-transparent [&_[cmdk-group-heading]]:px-4 [&_[cmdk-group-heading]]:py-2 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:font-bold [&_[cmdk-group-heading]]:tracking-widest [&_[cmdk-group-heading]]:text-[#A3A3A3] [&_[cmdk-group-heading]]:uppercase">
                    <div className="flex items-center border-b border-white/10 px-4 py-3">
                        <Search className="mr-3 h-5 w-5 text-primary shrink-0" />
                        <Command.Input
                            placeholder="Type a command or search route..."
                            className="w-full bg-transparent text-sm text-white placeholder-white/40 focus:outline-none"
                        />
                        <kbd className="hidden sm:inline-flex items-center gap-1 rounded border border-white/20 bg-white/5 px-2 py-0.5 text-[10px] font-mono text-white/60">
                            ESC
                        </kbd>
                    </div>

                    <Command.List className="max-h-[330px] overflow-y-auto p-2 space-y-1">
                        <Command.Empty className="py-6 text-center text-sm text-white/50">
                            No matching commands found.
                        </Command.Empty>

                        {/* CRM & Growth */}
                        {hasRole(["superadmin", "sales"]) && (
                            <Command.Group heading="CRM & Pipeline">
                                <Command.Item
                                    onSelect={() => runCommand(() => router.push("/dashboard/analytics"))}
                                    className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-white/80 hover:text-white hover:bg-white/10 cursor-pointer transition-colors"
                                >
                                    <BarChart3 className="h-4 w-4 text-primary" />
                                    <span>Analytics Dashboard</span>
                                </Command.Item>
                                <Command.Item
                                    onSelect={() => runCommand(() => router.push("/dashboard/inquiries"))}
                                    className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-white/80 hover:text-white hover:bg-white/10 cursor-pointer transition-colors"
                                >
                                    <Mail className="h-4 w-4 text-sky-400" />
                                    <span>Inquiries Hub</span>
                                </Command.Item>
                                <Command.Item
                                    onSelect={() => runCommand(() => router.push("/dashboard/contacts"))}
                                    className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-white/80 hover:text-white hover:bg-white/10 cursor-pointer transition-colors"
                                >
                                    <Users className="h-4 w-4 text-emerald-400" />
                                    <span>Client Contacts</span>
                                </Command.Item>
                                <Command.Item
                                    onSelect={() => runCommand(() => router.push("/dashboard/leads"))}
                                    className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-white/80 hover:text-white hover:bg-white/10 cursor-pointer transition-colors"
                                >
                                    <KanbanSquare className="h-4 w-4 text-amber-400" />
                                    <span>Sales Pipeline</span>
                                </Command.Item>
                                <Command.Item
                                    onSelect={() => runCommand(() => router.push("/dashboard/proposals"))}
                                    className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-white/80 hover:text-white hover:bg-white/10 cursor-pointer transition-colors"
                                >
                                    <FileText className="h-4 w-4 text-indigo-400" />
                                    <span>Proposals &amp; SOWs</span>
                                </Command.Item>
                            </Command.Group>
                        )}

                        {/* Operations */}
                        {(hasRole(["superadmin", "manager", "developer"]) || hasRole(["superadmin", "content_editor"])) && (
                            <Command.Group heading="Operations & CMS">
                                {hasRole(["superadmin", "manager", "developer"]) && (
                                    <Command.Item
                                        onSelect={() => runCommand(() => router.push("/dashboard/pm"))}
                                        className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-white/80 hover:text-white hover:bg-white/10 cursor-pointer transition-colors"
                                    >
                                        <KanbanSquare className="h-4 w-4 text-primary" />
                                        <span>Active Delivery Board</span>
                                    </Command.Item>
                                )}
                                {hasRole(["superadmin", "content_editor"]) && (
                                    <Command.Item
                                        onSelect={() => runCommand(() => router.push("/dashboard/cms"))}
                                        className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-white/80 hover:text-white hover:bg-white/10 cursor-pointer transition-colors"
                                    >
                                        <Monitor className="h-4 w-4 text-indigo-400" />
                                        <span>Unified Content Manager</span>
                                    </Command.Item>
                                )}
                            </Command.Group>
                        )}

                        {/* System */}
                        {hasRole(["superadmin"]) && (
                            <Command.Group heading="System Administration">
                                <Command.Item
                                    onSelect={() => runCommand(() => router.push("/dashboard/team"))}
                                    className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-white/80 hover:text-white hover:bg-white/10 cursor-pointer transition-colors"
                                >
                                    <Users className="h-4 w-4 text-purple-400" />
                                    <span>Team & Staff</span>
                                </Command.Item>
                                <Command.Item
                                    onSelect={() => runCommand(() => router.push("/dashboard/settings"))}
                                    className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-white/80 hover:text-white hover:bg-white/10 cursor-pointer transition-colors"
                                >
                                    <Settings className="h-4 w-4 text-[#A3A3A3]" />
                                    <span>System Settings</span>
                                </Command.Item>
                                <Command.Item
                                    onSelect={() => runCommand(() => router.push("/dashboard/audit"))}
                                    className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-white/80 hover:text-white hover:bg-white/10 cursor-pointer transition-colors"
                                >
                                    <ShieldAlert className="h-4 w-4 text-red-400" />
                                    <span>Audit Logs</span>
                                </Command.Item>
                            </Command.Group>
                        )}
                    </Command.List>

                    <div className="flex items-center justify-between border-t border-white/10 px-4 py-2.5 text-xs text-white/50 bg-white/[0.02]">
                        <span className="flex items-center gap-1.5">
                            <Sparkles className="h-3.5 w-3.5 text-primary" /> Optrizo Command Palette
                        </span>
                        <span>Use ↑↓ to navigate, Enter to select</span>
                    </div>
                </Command>
            </DialogContent>
        </Dialog>
    );
}
