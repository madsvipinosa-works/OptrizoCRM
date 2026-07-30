"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Plus, Edit, Search, FileText, Calendar, CheckCircle2, Clock } from "lucide-react";
import { DeletePostButton } from "@/features/cms/components/DeletePostButton";

export function PostsTab({ posts }: { posts: any[] }) {
    const [search, setSearch] = useState("");

    const filteredPosts = posts.filter((post) =>
        post.title?.toLowerCase().includes(search.toLowerCase()) ||
        post.slug?.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div className="space-y-6">
            {/* Action & Search Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-zinc-900/40 p-4 rounded-xl border border-white/5 backdrop-blur-md">
                <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
                    <Input
                        placeholder="Search articles by title or slug..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="pl-9 bg-zinc-900/80 border-white/10 text-sm focus:border-indigo-500 rounded-lg text-white placeholder:text-zinc-500"
                    />
                </div>
                <Button asChild size="sm" className="bg-indigo-600 hover:bg-indigo-500 text-white font-medium shadow-md shadow-indigo-600/20 shrink-0">
                    <Link href="/dashboard/posts/new">
                        <Plus className="mr-1.5 h-4 w-4" /> Create Article
                    </Link>
                </Button>
            </div>

            {/* Grid */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {filteredPosts.map((post) => (
                    <Card key={post.id} className="glass-card border-white/10 hover:border-indigo-500/30 transition-all flex flex-col justify-between group overflow-hidden relative">
                        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 opacity-80" />
                        
                        <CardHeader className="space-y-3 pt-6">
                            <div className="flex items-center justify-between gap-2">
                                <span className="text-[11px] font-mono uppercase tracking-wider text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20">
                                    /{post.slug}
                                </span>
                                {post.published ? (
                                    <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                                        <CheckCircle2 className="w-3 h-3" /> Published
                                    </span>
                                ) : (
                                    <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
                                        <Clock className="w-3 h-3" /> Draft
                                    </span>
                                )}
                            </div>

                            <CardTitle className="text-base font-bold text-white group-hover:text-indigo-300 transition-colors line-clamp-2">
                                {post.title}
                            </CardTitle>

                            {post.summary && (
                                <CardDescription className="text-xs text-zinc-400 line-clamp-2">
                                    {post.summary}
                                </CardDescription>
                            )}
                        </CardHeader>

                        <CardFooter className="flex items-center justify-between border-t border-white/5 pt-4 bg-zinc-950/40 px-6 py-3">
                            <div className="flex items-center gap-1.5 text-xs text-zinc-500">
                                <Calendar className="w-3.5 h-3.5" />
                                <span>{post.createdAt ? new Date(post.createdAt).toLocaleDateString() : "Recent"}</span>
                            </div>
                            <div className="flex items-center gap-1">
                                <Button asChild size="icon" variant="ghost" className="h-8 w-8 text-zinc-400 hover:text-white hover:bg-white/10">
                                    <Link href={`/dashboard/posts/${post.id}`}>
                                        <Edit className="h-3.5 w-3.5" />
                                    </Link>
                                </Button>
                                <DeletePostButton id={post.id} />
                            </div>
                        </CardFooter>
                    </Card>
                ))}

                {filteredPosts.length === 0 && (
                    <div className="col-span-full py-16 text-center glass-card border-dashed border-white/10 rounded-xl space-y-3">
                        <div className="w-12 h-12 rounded-full bg-zinc-900 border border-white/10 flex items-center justify-center mx-auto text-zinc-400">
                            <FileText className="w-6 h-6" />
                        </div>
                        <h3 className="text-sm font-semibold text-white">No articles found</h3>
                        <p className="text-xs text-zinc-400 max-w-sm mx-auto">
                            {search ? `No articles matching "${search}". Try clearing your search filter.` : "Start publishing blog posts and announcements for your agency."}
                        </p>
                        {!search && (
                            <Button asChild size="sm" className="bg-indigo-600 hover:bg-indigo-500 text-white font-medium mt-2">
                                <Link href="/dashboard/posts/new">
                                    <Plus className="mr-1.5 h-4 w-4" /> Create First Article
                                </Link>
                            </Button>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

