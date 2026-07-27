'use client';

import React from 'react';
import Link from 'next/link';
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
    const initials = user.name
        ? user.name
              .split(' ')
              .map((n) => n[0])
              .join('')
              .toUpperCase()
              .substring(0, 2)
        : user.email?.substring(0, 2).toUpperCase() || 'U';

    return (
        <div className="relative group py-1">
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
                <ChevronDown className="w-3.5 h-3.5 text-zinc-400 shrink-0 transition-transform duration-200 group-hover:rotate-180" />
            </Button>

            {/* Smooth Butter-Smooth Hover Dropdown Menu */}
            <div className="absolute right-0 top-full pt-1.5 w-56 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 ease-out transform group-hover:translate-y-0 translate-y-1 z-50">
                <div className="bg-zinc-950 border border-zinc-800 text-zinc-200 shadow-2xl p-1.5 rounded-xl backdrop-blur-xl">
                    <div className="font-normal px-2 py-2">
                        <div className="flex flex-col space-y-1">
                            <p className="text-xs font-bold leading-none text-zinc-100">{user.name || 'Client'}</p>
                            {user.email && (
                                <p className="text-[11px] leading-none text-zinc-400 truncate">{user.email}</p>
                            )}
                        </div>
                    </div>

                    <div className="h-px bg-zinc-800/80 my-1" />

                    <div className="space-y-0.5">
                        <Link
                            href="/portal"
                            className="flex items-center w-full text-xs py-2 px-2.5 font-medium rounded-lg text-zinc-300 hover:text-white hover:bg-zinc-900 transition-colors"
                        >
                            <LayoutDashboard className="mr-2 h-4 w-4 text-indigo-400" />
                            <span>My Dashboard</span>
                        </Link>

                        <Link
                            href="/portal/services"
                            className="flex items-center w-full text-xs py-2 px-2.5 font-medium rounded-lg text-zinc-300 hover:text-white hover:bg-zinc-900 transition-colors"
                        >
                            <Layers className="mr-2 h-4 w-4 text-emerald-400" />
                            <span>Availed Services</span>
                        </Link>

                        {isAdmin && (
                            <Link
                                href="/dashboard"
                                className="flex items-center w-full text-xs py-2 px-2.5 font-medium rounded-lg text-zinc-300 hover:text-white hover:bg-zinc-900 transition-colors"
                            >
                                <ShieldAlert className="mr-2 h-4 w-4 text-amber-400" />
                                <span>Admin Panel</span>
                            </Link>
                        )}
                    </div>

                    <div className="h-px bg-zinc-800/80 my-1" />

                    <button
                        type="button"
                        onClick={onSignOut}
                        disabled={isPending}
                        className="flex items-center w-full text-xs py-2 px-2.5 font-medium rounded-lg text-rose-400 hover:bg-rose-500/10 transition-colors disabled:opacity-50"
                    >
                        <LogOut className="mr-2 h-4 w-4 text-rose-400" />
                        <span>{isPending ? 'Logging out...' : 'Log out'}</span>
                    </button>
                </div>
            </div>
        </div>
    );
}
