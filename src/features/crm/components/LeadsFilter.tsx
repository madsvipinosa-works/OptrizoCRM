"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useDebouncedCallback } from "use-debounce";
import { Search } from "lucide-react";

export function LeadsFilter() {
    const searchParams = useSearchParams();
    const pathname = usePathname();
    const { replace } = useRouter();

    const currentFilter = searchParams.get("status") || "all";

    const handleSearch = useDebouncedCallback((term: string) => {
        const params = new URLSearchParams(searchParams);
        if (term) {
            params.set("query", term);
        } else {
            params.delete("query");
        }
        replace(`${pathname}?${params.toString()}`);
    }, 300);

    const handleStatusChange = (status: string) => {
        const params = new URLSearchParams(searchParams);
        if (status && status !== "all") {
            params.set("status", status);
        } else {
            params.delete("status");
        }
        replace(`${pathname}?${params.toString()}`);
    };

    return (
        <div className="space-y-4">
            <div className="flex items-center gap-4">
                <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Search leads..."
                        className="pl-9 bg-black/50 border-white/10"
                        onChange={(e) => handleSearch(e.target.value)}
                        defaultValue={searchParams.get("query")?.toString()}
                    />
                </div>
            </div>

            <Tabs defaultValue={currentFilter} onValueChange={handleStatusChange} className="w-full">
                <TabsList className="bg-white/5 border border-white/10 flex-wrap h-auto p-1">
                    <TabsTrigger value="all" className="text-xs">All Opportunities</TabsTrigger>
                    <TabsTrigger value="New Lead" className="text-xs">New Lead</TabsTrigger>
                    <TabsTrigger value="Discovery & Qualifying" className="text-xs">Discovery & Qualifying</TabsTrigger>
                    <TabsTrigger value="Proposal Sent" className="text-xs">Proposal Sent</TabsTrigger>
                    <TabsTrigger value="In Negotiation" className="text-xs">In Negotiation</TabsTrigger>
                    <TabsTrigger value="Closed Won" className="text-xs">Closed Won</TabsTrigger>
                    <TabsTrigger value="Closed Lost" className="text-xs">Closed Lost</TabsTrigger>
                </TabsList>
            </Tabs>
        </div>
    );
}
