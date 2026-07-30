"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Plus, Edit, Search, FolderGit2, Building2, CheckCircle2, Clock } from "lucide-react";
import { DeleteProjectButton } from "@/features/cms/components/DeleteProjectButton";

export function PortfolioTab({ projects }: { projects: any[] }) {
    const [search, setSearch] = useState("");

    const filteredProjects = projects.filter((project) =>
        project.title?.toLowerCase().includes(search.toLowerCase()) ||
        project.clientName?.toLowerCase().includes(search.toLowerCase()) ||
        project.category?.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div className="space-y-6">
            {/* Action & Search Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-zinc-900/40 p-4 rounded-xl border border-white/5 backdrop-blur-md">
                <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
                    <Input
                        placeholder="Search case studies by project or client..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="pl-9 bg-zinc-900/80 border-white/10 text-sm focus:border-indigo-500 rounded-lg text-white placeholder:text-zinc-500"
                    />
                </div>
                <Button asChild size="sm" className="bg-indigo-600 hover:bg-indigo-500 text-white font-medium shadow-md shadow-indigo-600/20 shrink-0">
                    <Link href="/dashboard/portfolio/new">
                        <Plus className="mr-1.5 h-4 w-4" /> Add Case Study
                    </Link>
                </Button>
            </div>

            {/* Grid */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {filteredProjects.map((project) => (
                    <Card key={project.id} className="glass-card border-white/10 hover:border-purple-500/30 transition-all flex flex-col justify-between group overflow-hidden relative">
                        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-purple-500 via-indigo-500 to-blue-500 opacity-80" />

                        <CardHeader className="space-y-3 pt-6">
                            <div className="flex items-center justify-between gap-2">
                                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded border border-purple-500/20">
                                    <Building2 className="w-3 h-3" /> {project.clientName || "General Client"}
                                </span>
                                {project.status === "published" ? (
                                    <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                                        <CheckCircle2 className="w-3 h-3" /> Live
                                    </span>
                                ) : (
                                    <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
                                        <Clock className="w-3 h-3" /> Draft
                                    </span>
                                )}
                            </div>

                            <CardTitle className="text-base font-bold text-white group-hover:text-purple-300 transition-colors line-clamp-2">
                                {project.title}
                            </CardTitle>

                            {project.summary && (
                                <CardDescription className="text-xs text-zinc-400 line-clamp-2">
                                    {project.summary}
                                </CardDescription>
                            )}
                        </CardHeader>

                        <CardFooter className="flex items-center justify-between border-t border-white/5 pt-4 bg-zinc-950/40 px-6 py-3">
                            <span className="text-[11px] text-zinc-400 font-mono">
                                {project.category ? project.category : "Case Study"}
                            </span>
                            <div className="flex items-center gap-1">
                                <Button asChild size="icon" variant="ghost" className="h-8 w-8 text-zinc-400 hover:text-white hover:bg-white/10">
                                    <Link href={`/dashboard/portfolio/${project.id}`}>
                                        <Edit className="h-3.5 w-3.5" />
                                    </Link>
                                </Button>
                                <DeleteProjectButton id={project.id} />
                            </div>
                        </CardFooter>
                    </Card>
                ))}

                {filteredProjects.length === 0 && (
                    <div className="col-span-full py-16 text-center glass-card border-dashed border-white/10 rounded-xl space-y-3">
                        <div className="w-12 h-12 rounded-full bg-zinc-900 border border-white/10 flex items-center justify-center mx-auto text-zinc-400">
                            <FolderGit2 className="w-6 h-6" />
                        </div>
                        <h3 className="text-sm font-semibold text-white">No portfolio projects found</h3>
                        <p className="text-xs text-zinc-400 max-w-sm mx-auto">
                            {search ? `No projects matching "${search}". Try clearing your search filter.` : "Add impressive client case studies and completed work."}
                        </p>
                        {!search && (
                            <Button asChild size="sm" className="bg-indigo-600 hover:bg-indigo-500 text-white font-medium mt-2">
                                <Link href="/dashboard/portfolio/new">
                                    <Plus className="mr-1.5 h-4 w-4" /> Add First Case Study
                                </Link>
                            </Button>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

