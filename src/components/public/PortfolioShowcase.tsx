"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import Image from "next/image";

interface Project {
    id: string;
    title: string;
    slug: string;
    description: string | null;
    clientName: string | null;
    coverImage: string | null;
}

export function PortfolioShowcase({ projects }: { projects: Project[] }) {
    if (!projects || projects.length === 0) return null;

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {projects.map((project, idx) => (
                <motion.div
                    key={project.id}
                    initial={{ opacity: 0, y: 30 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: "-100px" }}
                    transition={{ duration: 0.5, delay: idx * 0.1 }}
                    className="group relative flex flex-col justify-end overflow-hidden rounded-2xl bg-black/40 border border-white/10 aspect-[4/5] md:aspect-square"
                >
                    {/* Background Image */}
                    {project.coverImage ? (
                        <Image
                            src={project.coverImage}
                            alt={project.title}
                            fill
                            className="object-cover transition-transform duration-700 group-hover:scale-105 opacity-60 group-hover:opacity-40"
                        />
                    ) : (
                        <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-black opacity-60" />
                    )}

                    {/* Gradient Overlay */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent opacity-80" />

                    {/* Content */}
                    <div className="relative z-10 p-6 flex flex-col h-full justify-end">
                        <div className="translate-y-4 group-hover:translate-y-0 transition-transform duration-300">
                            {project.clientName && (
                                <p className="text-primary text-sm font-semibold mb-2 uppercase tracking-wider">
                                    {project.clientName}
                                </p>
                            )}
                            <h3 className="text-2xl font-bold text-white mb-2 line-clamp-2">
                                {project.title}
                            </h3>
                            {project.description && (
                                <p className="text-white/70 line-clamp-2 mb-4 opacity-0 group-hover:opacity-100 transition-opacity duration-300 delay-100">
                                    {project.description}
                                </p>
                            )}
                            <Link 
                                href={`/portfolio/${project.slug}`}
                                className="inline-flex items-center text-white font-medium hover:text-primary transition-colors opacity-0 group-hover:opacity-100 duration-300 delay-150"
                            >
                                View Case Study <ArrowRight className="ml-2 h-4 w-4" />
                            </Link>
                        </div>
                    </div>
                </motion.div>
            ))}
        </div>
    );
}
