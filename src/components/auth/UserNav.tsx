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
import { LayoutDashboard, Layers, ShieldAlert, LogOut, ChevronDown, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';
import { LogoutConfirmDialog } from '@/components/auth/LogoutConfirmDialog';

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
    const [confirmOpen, setConfirmOpen] = useState(false);
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
                            'relative flex h-10 cursor-pointer select-none items-center gap-2 rounded-xl border border-border bg-card pl-1.5 pr-2.5 text-foreground transition-colors duration-150 hover:bg-muted',
                            'focus-visible:ring-2 focus-visible:ring-ring',
                            open && 'bg-muted'
                        )}
                    >
                        <Avatar className="size-7">
                            {user.image && <AvatarImage src={user.image} alt={user.name || 'User'} className="object-cover" />}
                            <AvatarFallback className="bg-brand-soft text-xs font-semibold text-brand-deep">
                                {initials}
                            </AvatarFallback>
                        </Avatar>
                        <span className="max-w-36 truncate text-sm font-semibold text-foreground">
                            {user.name || user.email || 'Account'}
                        </span>
                        <ChevronDown
                            className={cn(
                                'size-4 shrink-0 text-muted-foreground transition-transform duration-200 ease-out',
                                open && 'rotate-180'
                            )}
                        />
                    </Button>
                </DropdownMenuTrigger>

                <DropdownMenuContent
                    className="w-60"
                    align="end"
                    sideOffset={8}
                    onMouseEnter={handleMouseEnter}
                    onMouseLeave={handleMouseLeave}
                >
                    <DropdownMenuLabel className="font-normal">
                        <p className="truncate text-sm font-semibold text-foreground">{user.name || 'Client'}</p>
                        {user.email && <p className="truncate text-sm text-muted-foreground">{user.email}</p>}
                    </DropdownMenuLabel>

                    <DropdownMenuSeparator />

                    <DropdownMenuGroup>
                        <DropdownMenuItem
                            asChild
                            onClick={() => setOpen(false)}
                            className="cursor-pointer"
                        >
                            <Link href="/portal" className="flex items-center w-full">
                                <LayoutDashboard className="size-4" strokeWidth={1.75} />
                                <span>Client portal</span>
                            </Link>
                        </DropdownMenuItem>

                        <DropdownMenuItem
                            asChild
                            onClick={() => setOpen(false)}
                            className="cursor-pointer"
                        >
                            <Link href="/portal/settings" className="flex items-center w-full">
                                <Settings className="size-4" strokeWidth={1.75} />
                                <span>Settings</span>
                            </Link>
                        </DropdownMenuItem>

                        <DropdownMenuItem
                            asChild
                            onClick={() => setOpen(false)}
                            className="cursor-pointer"
                        >
                            <Link href="/portal/projects" className="flex items-center w-full">
                                <Layers className="size-4" strokeWidth={1.75} />
                                <span>Availed services</span>
                            </Link>
                        </DropdownMenuItem>

                        {isAdmin && (
                            <DropdownMenuItem
                                asChild
                                onClick={() => setOpen(false)}
                                className="cursor-pointer"
                            >
                                <Link href="/dashboard" className="flex items-center w-full">
                                    <ShieldAlert className="size-4" strokeWidth={1.75} />
                                    <span>Admin Panel</span>
                                </Link>
                            </DropdownMenuItem>
                        )}
                    </DropdownMenuGroup>

                    <DropdownMenuSeparator />

                    <DropdownMenuItem
                        className="cursor-pointer"
                        onSelect={() => {
                            setOpen(false);
                            // Open after the menu has closed, so focus and pointer locks hand over cleanly.
                            setTimeout(() => setConfirmOpen(true), 0);
                        }}
                        disabled={isPending}
                    >
                        <LogOut className="size-4" strokeWidth={1.75} />
                        <span>{isPending ? 'Logging out...' : 'Log out'}</span>
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
            <LogoutConfirmDialog
                open={confirmOpen}
                onOpenChange={setConfirmOpen}
                email={user?.email}
                onConfirm={async () => {
                    await onSignOut();
                }}
            />
        </div>
    );
}
