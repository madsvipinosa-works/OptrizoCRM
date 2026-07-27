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
                        className="relative flex items-center gap-2.5 h-10 px-2.5 rounded-xl border border-zinc-800 bg-zinc-950/80 hover:bg-zinc-900 hover:border-zinc-700 text-zinc-200 transition-all focus-visible:ring-1 focus-visible:ring-zinc-700"
                    >
                        <Avatar className="h-7 w-7 border border-zinc-700/60 ring-1 ring-zinc-800">
                            {user.image && <AvatarImage src={user.image} alt={user.name || 'User'} />}
                            <AvatarFallback className="text-[10px] font-bold bg-indigo-600 text-white">
                                {initials}
                            </AvatarFallback>
                        </Avatar>
                        <span className="text-xs font-semibold text-zinc-200 truncate max-w-[130px]">
                            {user.name || user.email || 'Account'}
                        </span>
                        <ChevronDown className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                    </Button>
                </DropdownMenuTrigger>

                <DropdownMenuContent
                    className="w-56 bg-zinc-950 border border-zinc-800 text-zinc-200 shadow-2xl p-1.5 rounded-xl z-50"
                    align="end"
                    sideOffset={8}
                    onMouseEnter={handleMouseEnter}
                    onMouseLeave={handleMouseLeave}
                >
                    <DropdownMenuLabel className="font-normal px-2 py-1.5">
                        <div className="flex flex-col space-y-1">
                            <p className="text-xs font-bold leading-none text-zinc-100">{user.name || 'Client'}</p>
                            {user.email && (
                                <p className="text-[11px] leading-none text-zinc-400 truncate">{user.email}</p>
                            )}
                        </div>
                    </DropdownMenuLabel>

                    <DropdownMenuSeparator className="bg-zinc-800/80 my-1" />

                    <DropdownMenuGroup>
                        <DropdownMenuItem
                            asChild
                            onClick={() => setOpen(false)}
                            className="focus:bg-zinc-900 focus:text-white rounded-lg cursor-pointer text-xs py-2 px-2.5 font-medium"
                        >
                            <Link href="/portal" className="flex items-center w-full">
                                <LayoutDashboard className="mr-2 h-4 w-4 text-indigo-400" />
                                <span>My Dashboard</span>
                            </Link>
                        </DropdownMenuItem>

                        <DropdownMenuItem
                            asChild
                            onClick={() => setOpen(false)}
                            className="focus:bg-zinc-900 focus:text-white rounded-lg cursor-pointer text-xs py-2 px-2.5 font-medium"
                        >
                            <Link href="/portal/services" className="flex items-center w-full">
                                <Layers className="mr-2 h-4 w-4 text-emerald-400" />
                                <span>Availed Services</span>
                            </Link>
                        </DropdownMenuItem>

                        {isAdmin && (
                            <DropdownMenuItem
                                asChild
                                onClick={() => setOpen(false)}
                                className="focus:bg-zinc-900 focus:text-white rounded-lg cursor-pointer text-xs py-2 px-2.5 font-medium"
                            >
                                <Link href="/dashboard" className="flex items-center w-full">
                                    <ShieldAlert className="mr-2 h-4 w-4 text-amber-400" />
                                    <span>Admin Panel</span>
                                </Link>
                            </DropdownMenuItem>
                        )}
                    </DropdownMenuGroup>

                    <DropdownMenuSeparator className="bg-zinc-800/80 my-1" />

                    <DropdownMenuItem
                        className="focus:bg-rose-500/10 focus:text-rose-400 text-rose-400 rounded-lg cursor-pointer text-xs py-2 px-2.5 font-medium"
                        onClick={() => {
                            setOpen(false);
                            onSignOut();
                        }}
                        disabled={isPending}
                    >
                        <LogOut className="mr-2 h-4 w-4 text-rose-400" />
                        <span>{isPending ? 'Logging out...' : 'Log out'}</span>
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
        </div>
    );
}
