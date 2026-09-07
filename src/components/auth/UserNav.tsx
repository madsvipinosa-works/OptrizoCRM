'use client';

import React, { useState, useRef } from 'react';
import Link from 'next/link';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { LayoutDashboard, Layers, ShieldAlert, LogOut, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface UserNavProps {
    user: {
        name?: string | null;
        email?: string | null;
        image?: string | null;
        role?: string | null;
    };
    isAdmin?: boolean;
    onSignOut: () => Promise<void>;
    isPending?: boolean;
}

export function UserNav({ user, isAdmin, onSignOut, isPending }: UserNavProps) {
    const [open, setOpen] = useState(false);
    const timeoutRef = useRef<NodeJS.Timeout | null>(null);

    const handleMouseEnter = () => {
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        setOpen(true);
    };

    const handleMouseLeave = () => {
        timeoutRef.current = setTimeout(() => {
            setOpen(false);
        }, 150);
    };

    const initials = user.name
        ? user.name
              .split(' ')
              .map((n) => n[0])
              .join('')
              .toUpperCase()
              .substring(0, 2)
        : user.email?.substring(0, 2).toUpperCase() || 'U';

    return (
        <div
            className="relative inline-block"
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
        >
            <DropdownMenu open={open} onOpenChange={setOpen} modal={false}>
                <DropdownMenuTrigger asChild>
                    <Button
                        variant="ghost"
                        className={cn(
                            'relative flex items-center gap-2.5 h-10 px-2.5 rounded-xl border transition-all duration-200 cursor-pointer select-none',
                            'border-black/10 bg-black/[0.03] hover:bg-black/[0.06] hover:border-black/20 text-foreground shadow-xs',
                            'dark:border-zinc-800 dark:bg-zinc-950/80 dark:hover:bg-zinc-900 dark:hover:border-zinc-700 dark:text-zinc-200 dark:shadow-none',
                            'focus-visible:ring-1 focus-visible:ring-ring dark:focus-visible:ring-zinc-700',
                            open && 'bg-black/[0.06] border-black/25 dark:bg-zinc-900 dark:border-zinc-700'
                        )}
                    >
                        <Avatar className="h-7 w-7 border border-black/10 ring-1 ring-black/5 dark:border-zinc-700/60 dark:ring-zinc-800">
                            {user.image && <AvatarImage src={user.image} alt={user.name || 'User'} className="object-cover" />}
                            <AvatarFallback className="text-[10px] font-bold bg-[#34E513] text-black dark:bg-indigo-600 dark:text-white">
                                {initials}
                            </AvatarFallback>
                        </Avatar>
                        <span className="text-xs font-semibold text-foreground dark:text-zinc-200 truncate max-w-[130px]">
                            {user.name || user.email || 'Account'}
                        </span>
                        <ChevronDown
                            className={cn(
                                'w-3.5 h-3.5 text-muted-foreground dark:text-zinc-400 shrink-0 transition-transform duration-200',
                                open && 'rotate-180'
                            )}
                        />
                    </Button>
                </DropdownMenuTrigger>

                <DropdownMenuContent
                    className={cn(
                        'w-56 p-1.5 rounded-xl shadow-2xl z-50 transition-colors duration-200',
                        'bg-popover/95 border border-border text-popover-foreground backdrop-blur-xl shadow-[0_10px_38px_-10px_rgba(22,23,24,0.12),0_10px_20px_-15px_rgba(22,23,24,0.08)]',
                        'dark:bg-zinc-950/95 dark:border-zinc-800 dark:text-zinc-200 dark:shadow-[0_20px_40px_rgba(0,0,0,0.6)]'
                    )}
                    align="end"
                    sideOffset={8}
                    onMouseEnter={handleMouseEnter}
                    onMouseLeave={handleMouseLeave}
                >
                    <DropdownMenuLabel className="font-normal px-2.5 py-2">
                        <div className="flex flex-col space-y-1">
                            <p className="text-xs font-bold leading-none text-foreground dark:text-zinc-100">{user.name || 'Client'}</p>
                            {user.email && (
                                <p className="text-[11px] leading-none text-muted-foreground dark:text-zinc-400 truncate">{user.email}</p>
                            )}
                        </div>
                    </DropdownMenuLabel>

                    <DropdownMenuSeparator className="bg-border/80 dark:bg-zinc-800/80 my-1" />

                    <DropdownMenuGroup>
                        <DropdownMenuItem
                            asChild
                            onClick={() => setOpen(false)}
                            className="focus:bg-black/[0.05] hover:bg-black/[0.05] text-foreground focus:text-foreground dark:focus:bg-zinc-900 dark:hover:bg-zinc-900 dark:text-zinc-200 dark:focus:text-white rounded-lg cursor-pointer text-xs py-2 px-2.5 font-medium transition-colors"
                        >
                            <Link href="/portal" className="flex items-center w-full">
                                <LayoutDashboard className="mr-2.5 h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                                <span>My Dashboard</span>
                            </Link>
                        </DropdownMenuItem>

                        <DropdownMenuItem
                            asChild
                            onClick={() => setOpen(false)}
                            className="focus:bg-black/[0.05] hover:bg-black/[0.05] text-foreground focus:text-foreground dark:focus:bg-zinc-900 dark:hover:bg-zinc-900 dark:text-zinc-200 dark:focus:text-white rounded-lg cursor-pointer text-xs py-2 px-2.5 font-medium transition-colors"
                        >
                            <Link href="/portal/services" className="flex items-center w-full">
                                <Layers className="mr-2.5 h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                                <span>Availed Services</span>
                            </Link>
                        </DropdownMenuItem>

                        {isAdmin && (
                            <DropdownMenuItem
                                asChild
                                onClick={() => setOpen(false)}
                                className="focus:bg-black/[0.05] hover:bg-black/[0.05] text-foreground focus:text-foreground dark:focus:bg-zinc-900 dark:hover:bg-zinc-900 dark:text-zinc-200 dark:focus:text-white rounded-lg cursor-pointer text-xs py-2 px-2.5 font-medium transition-colors"
                            >
                                <Link href="/dashboard" className="flex items-center w-full">
                                    <ShieldAlert className="mr-2.5 h-4 w-4 text-amber-600 dark:text-amber-400" />
                                    <span>Admin Panel</span>
                                </Link>
                            </DropdownMenuItem>
                        )}
                    </DropdownMenuGroup>

                    <DropdownMenuSeparator className="bg-border/80 dark:bg-zinc-800/80 my-1" />

                    <DropdownMenuItem
                        className="focus:bg-rose-500/10 focus:text-rose-600 hover:bg-rose-500/10 hover:text-rose-600 text-rose-600 dark:text-rose-400 dark:hover:text-rose-400 dark:focus:text-rose-400 dark:focus:bg-rose-500/15 rounded-lg cursor-pointer text-xs py-2 px-2.5 font-medium transition-colors"
                        onClick={() => {
                            setOpen(false);
                            onSignOut();
                        }}
                        disabled={isPending}
                    >
                        <LogOut className="mr-2.5 h-4 w-4 text-rose-600 dark:text-rose-400" />
                        <span>{isPending ? 'Logging out...' : 'Log out'}</span>
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
        </div>
    );
}
