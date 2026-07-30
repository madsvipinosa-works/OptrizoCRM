"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Plus, Edit, Search, MessageSquareQuote, Star, Quote } from "lucide-react";
import { DeleteTestimonialButton } from "@/features/cms/components/DeleteTestimonialButton";

export function TestimonialsTab({ testimonials }: { testimonials: any[] }) {
    const [search, setSearch] = useState("");

    const filteredTestimonials = testimonials.filter((t) =>
        t.name?.toLowerCase().includes(search.toLowerCase()) ||
        t.company?.toLowerCase().includes(search.toLowerCase()) ||
        t.content?.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div className="space-y-6">
            {/* Action & Search Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-zinc-900/40 p-4 rounded-xl border border-white/5 backdrop-blur-md">
                <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
                    <Input
                        placeholder="Search testimonials by name or company..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="pl-9 bg-zinc-900/80 border-white/10 text-sm focus:border-indigo-500 rounded-lg text-white placeholder:text-zinc-500"
                    />
                </div>
                <Button asChild size="sm" className="bg-indigo-600 hover:bg-indigo-500 text-white font-medium shadow-md shadow-indigo-600/20 shrink-0">
                    <Link href="/dashboard/testimonials/new">
                        <Plus className="mr-1.5 h-4 w-4" /> Add Testimonial
                    </Link>
                </Button>
            </div>

            {/* Grid */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {filteredTestimonials.map((t) => (
                    <Card key={t.id} className="glass-card border-white/10 hover:border-emerald-500/30 transition-all flex flex-col justify-between group overflow-hidden relative">
                        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 opacity-80" />

                        <CardHeader className="space-y-3 pt-6">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-1 text-amber-400">
                                    {Array.from({ length: t.rating || 5 }).map((_, i) => (
                                        <Star key={i} className="w-3.5 h-3.5 fill-amber-400" />
                                    ))}
                                </div>
                                <Quote className="w-4 h-4 text-zinc-600 group-hover:text-emerald-400/60 transition-colors" />
                            </div>

                            <CardDescription className="text-xs text-zinc-300 italic line-clamp-4 leading-relaxed">
                                &quot;{t.content}&quot;
                            </CardDescription>

                            <div className="pt-2 border-t border-white/5">
                                <CardTitle className="text-sm font-bold text-white group-hover:text-emerald-300 transition-colors">
                                    {t.name}
                                </CardTitle>
                                <p className="text-[11px] text-zinc-400">
                                    {t.role} {t.company ? `at ${t.company}` : ""}
                                </p>
                            </div>
                        </CardHeader>

                        <CardFooter className="flex items-center justify-end gap-1 border-t border-white/5 pt-3 bg-zinc-950/40 px-6 py-2.5">
                            <Button asChild size="icon" variant="ghost" className="h-8 w-8 text-zinc-400 hover:text-white hover:bg-white/10">
                                <Link href={`/dashboard/testimonials/${t.id}`}>
                                    <Edit className="h-3.5 w-3.5" />
                                </Link>
                            </Button>
                            <DeleteTestimonialButton id={t.id} />
                        </CardFooter>
                    </Card>
                ))}

                {filteredTestimonials.length === 0 && (
                    <div className="col-span-full py-16 text-center glass-card border-dashed border-white/10 rounded-xl space-y-3">
                        <div className="w-12 h-12 rounded-full bg-zinc-900 border border-white/10 flex items-center justify-center mx-auto text-zinc-400">
                            <MessageSquareQuote className="w-6 h-6" />
                        </div>
                        <h3 className="text-sm font-semibold text-white">No testimonials found</h3>
                        <p className="text-xs text-zinc-400 max-w-sm mx-auto">
                            {search ? `No testimonials matching "${search}". Try clearing your search filter.` : "Add client reviews to boost social proof on your site."}
                        </p>
                        {!search && (
                            <Button asChild size="sm" className="bg-indigo-600 hover:bg-indigo-500 text-white font-medium mt-2">
                                <Link href="/dashboard/testimonials/new">
                                    <Plus className="mr-1.5 h-4 w-4" /> Add First Testimonial
                                </Link>
                            </Button>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

