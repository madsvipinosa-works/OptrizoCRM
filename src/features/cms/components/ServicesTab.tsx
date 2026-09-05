"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Plus, Edit, Search, Layers, Cuboid, ImageIcon } from "lucide-react";
import { DeleteServiceButton } from "@/features/cms/components/DeleteServiceButton";

export interface ServiceItem {
    id: string;
    title: string;
    description: string;
    category?: string | null;
    image?: string | null;
    color?: string | null;
    link?: string | null;
    icon?: string | null;
    order?: number | null;
    tags?: string[] | null;
    deliverables?: string[] | null;
    imageUrl?: string | null;
    threeDModelUrl?: string | null;
}

export function ServicesTab({ services }: { services: ServiceItem[] }) {
    const [search, setSearch] = useState("");

    const filteredServices = services.filter((service) =>
        service.title?.toLowerCase().includes(search.toLowerCase()) ||
        service.description?.toLowerCase().includes(search.toLowerCase()) ||
        service.category?.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div className="space-y-6">
            {/* Action & Search Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-zinc-900/40 p-4 rounded-xl border border-white/5 backdrop-blur-md">
                <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
                    <Input
                        placeholder="Search service offerings..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="pl-9 bg-zinc-900/80 border-white/10 text-sm focus:border-primary rounded-lg text-white placeholder:text-zinc-500"
                    />
                </div>
                <Button asChild size="sm" className="bg-primary hover:bg-primary/90 text-black font-semibold shadow-md shadow-primary/20 shrink-0">
                    <Link href="/dashboard/services/new">
                        <Plus className="mr-1.5 h-4 w-4" /> Add Service
                    </Link>
                </Button>
            </div>

            {/* Grid */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {filteredServices.map((service) => (
                    <Card key={service.id} className="glass-card border-white/10 hover:border-primary/40 transition-all flex flex-col justify-between group overflow-hidden relative">
                        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary via-emerald-400 to-primary opacity-80" />

                        <div>
                            {/* Service Image Preview */}
                            {service.image ? (
                                <div className="relative w-full h-36 overflow-hidden bg-black/40 border-b border-white/5">
                                    <Image
                                        src={service.image}
                                        alt={service.title}
                                        fill
                                        className="object-cover group-hover:scale-105 transition-transform duration-500"
                                    />
                                    {service.category && (
                                        <div className="absolute bottom-2 left-2">
                                            <Badge variant="secondary" className="bg-black/70 backdrop-blur-md text-primary text-[10px] border border-white/10">
                                                {service.category}
                                            </Badge>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="w-full h-24 bg-white/5 flex items-center justify-center text-zinc-500 border-b border-white/5">
                                    <div className="flex items-center gap-2 text-xs">
                                        <ImageIcon className="w-4 h-4" />
                                        <span>No preview image</span>
                                    </div>
                                </div>
                            )}

                            <CardHeader className="space-y-3 pt-5">
                                <div className="flex items-center gap-3">
                                    <div className="p-2.5 bg-primary/10 rounded-xl text-primary border border-primary/20 group-hover:scale-105 transition-transform">
                                        <Cuboid className="h-5 w-5" />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <CardTitle className="text-base font-bold text-white group-hover:text-primary transition-colors truncate">
                                            {service.title}
                                        </CardTitle>
                                        <div className="flex items-center gap-2 mt-0.5">
                                            {service.category && !service.image && (
                                                <span className="text-[10px] text-primary font-mono">{service.category}</span>
                                            )}
                                            {service.icon && (
                                                <span className="text-[10px] font-mono text-zinc-400">Icon: {service.icon}</span>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                <CardDescription className="text-xs text-zinc-400 line-clamp-2 leading-relaxed">
                                    {service.description}
                                </CardDescription>
                            </CardHeader>
                        </div>

                        <CardFooter className="flex items-center justify-between border-t border-white/5 pt-3 bg-zinc-950/40 px-6 py-3">
                            <div className="flex items-center gap-2">
                                <span className="text-[11px] font-mono text-zinc-400">
                                    #{service.order ?? 0}
                                </span>
                                {service.color && (
                                    <span
                                        className="w-3 h-3 rounded-full border border-white/20 inline-block"
                                        style={{ backgroundColor: service.color }}
                                        title={`Card color: ${service.color}`}
                                    />
                                )}
                            </div>
                            <div className="flex items-center gap-1">
                                <Button asChild size="icon" variant="ghost" className="h-8 w-8 text-zinc-400 hover:text-white hover:bg-white/10">
                                    <Link href={`/dashboard/services/${service.id}`}>
                                        <Edit className="h-3.5 w-3.5" />
                                    </Link>
                                </Button>
                                <DeleteServiceButton id={service.id} />
                            </div>
                        </CardFooter>
                    </Card>
                ))}

                {filteredServices.length === 0 && (
                    <div className="col-span-full py-16 text-center glass-card border-dashed border-white/10 rounded-xl space-y-3">
                        <div className="w-12 h-12 rounded-full bg-zinc-900 border border-white/10 flex items-center justify-center mx-auto text-zinc-400">
                            <Layers className="w-6 h-6" />
                        </div>
                        <h3 className="text-sm font-semibold text-white">No services found</h3>
                        <p className="text-xs text-zinc-400 max-w-sm mx-auto">
                            {search ? `No services matching "${search}". Try clearing your search filter.` : "Define agency services to feature on your public homepage."}
                        </p>
                        {!search && (
                            <Button asChild size="sm" className="bg-primary hover:bg-primary/90 text-black font-semibold mt-2">
                                <Link href="/dashboard/services/new">
                                    <Plus className="mr-1.5 h-4 w-4" /> Add First Service
                                </Link>
                            </Button>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
