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
                            'border-border bg-muted/40 hover:bg-muted/70 hover:border-border/80 text-foreground shadow-xs',
                            'focus-visible:ring-1 focus-visible:ring-ring',
                            open && 'bg-muted border-border'
                        )}
                    >
                        <Avatar className="h-7 w-7 border border-border ring-1 ring-border/50">
                            {user.image && <AvatarImage src={user.image} alt={user.name || 'User'} className="object-cover" />}
                            <AvatarFallback className="text-[10px] font-bold bg-primary text-black">
                                {initials}
                            </AvatarFallback>
                        </Avatar>
                        <span className="text-xs font-semibold text-foreground truncate max-w-[130px]">
                            {user.name || user.email || 'Account'}
                        </span>
                        <ChevronDown
                            className={cn(
                                'w-3.5 h-3.5 text-muted-foreground shrink-0 transition-transform duration-200',
                                open && 'rotate-180'
                            )}
                        />
                    </Button>
                </DropdownMenuTrigger>

                <DropdownMenuContent
                    className={cn(
                        'w-56 p-1.5 rounded-xl shadow-2xl z-50 transition-colors duration-200',
                        'bg-popover border border-border text-popover-foreground backdrop-blur-xl shadow-xl'
                    )}
                    align="end"
                    sideOffset={8}
                    onMouseEnter={handleMouseEnter}
                    onMouseLeave={handleMouseLeave}
                >
                    <DropdownMenuLabel className="font-normal px-2.5 py-2">
                        <div className="flex flex-col space-y-1">
                            <p className="text-xs font-bold leading-none text-foreground">{user.name || 'Client'}</p>
                            {user.email && (
                                <p className="text-[11px] leading-none text-muted-foreground truncate">{user.email}</p>
                            )}
                        </div>
                    </DropdownMenuLabel>

                    <DropdownMenuSeparator className="bg-border my-1" />

                    <DropdownMenuGroup>
                        <DropdownMenuItem
                            asChild
                            onClick={() => setOpen(false)}
                            className="hover:bg-muted focus:bg-muted text-foreground rounded-lg cursor-pointer text-xs py-2 px-2.5 font-medium transition-colors"
                        >
                            <Link href="/portal" className="flex items-center w-full">
                                <LayoutDashboard className="mr-2.5 h-4 w-4 text-primary" />
                                <span>My Dashboard</span>
                            </Link>
                        </DropdownMenuItem>

                        <DropdownMenuItem
                            asChild
                            onClick={() => setOpen(false)}
                            className="hover:bg-muted focus:bg-muted text-foreground rounded-lg cursor-pointer text-xs py-2 px-2.5 font-medium transition-colors"
                        >
                            <Link href="/portal/services" className="flex items-center w-full">
                                <Layers className="mr-2.5 h-4 w-4 text-primary" />
                                <span>Availed Services</span>
                            </Link>
                        </DropdownMenuItem>

                        {isAdmin && (
                            <DropdownMenuItem
                                asChild
                                onClick={() => setOpen(false)}
                                className="hover:bg-muted focus:bg-muted text-foreground rounded-lg cursor-pointer text-xs py-2 px-2.5 font-medium transition-colors"
                            >
                                <Link href="/dashboard" className="flex items-center w-full">
                                    <ShieldAlert className="mr-2.5 h-4 w-4 text-amber-500" />
                                    <span>Admin Panel</span>
                                </Link>
                            </DropdownMenuItem>
                        )}
                    </DropdownMenuGroup>

                    <DropdownMenuSeparator className="bg-border my-1" />

                    <DropdownMenuItem
                        className="focus:bg-destructive/10 focus:text-destructive hover:bg-destructive/10 hover:text-destructive text-destructive rounded-lg cursor-pointer text-xs py-2 px-2.5 font-medium transition-colors"
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
