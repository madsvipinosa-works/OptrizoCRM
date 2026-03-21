'use client';
import React from 'react';
import type { ComponentProps, ReactNode } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import {
    LinkedinIcon,
    InstagramIcon,
    TwitterIcon,
    GithubIcon,
    Code2,
    Mail,
} from 'lucide-react';
import Link from 'next/link';

import { cn } from '@/lib/utils';

interface FooterLink {
    title: string;
    href: string;
    icon?: React.ComponentType<{ className?: string }>;
}

interface FooterSection {
    label: string;
    links: FooterLink[];
}

const footerLinks: FooterSection[] = [
    {
        label: 'Services',
        links: [
            { title: 'Web Development', href: '/services' },
            { title: 'UI/UX Design', href: '/services' },
            { title: 'AI Integration', href: '/services' },
            { title: 'Custom Software', href: '/services' },
        ],
    },
    {
        label: 'Company',
        links: [
            { title: 'About Us', href: '/about' },
            { title: 'Our Work', href: '/projects' },
            { title: 'Blog', href: '/blog' },
            { title: 'Contact', href: '/contact' },
        ],
    },
    {
        label: 'Resources',
        links: [
            { title: 'Case Studies', href: '/projects' },
            { title: 'Testimonials', href: '/testimonials' },
            { title: 'Get a Quote', href: '/contact' },
            { title: 'Careers', href: '/careers' },
        ],
    },
    {
        label: 'Follow Us',
        links: [
            { title: 'LinkedIn', href: '#', icon: LinkedinIcon },
            { title: 'Instagram', href: '#', icon: InstagramIcon },
            { title: 'Twitter / X', href: '#', icon: TwitterIcon },
            { title: 'GitHub', href: '#', icon: GithubIcon },
        ],
    },
];

interface FooterProps {
    contactEmail?: string;
    className?: string;
}

export function FooterSection({ contactEmail = 'hello@optrizo.com', className }: FooterProps) {
    return (
        <footer className={cn("md:rounded-t-6xl relative w-full max-w-6xl mx-auto flex flex-col items-center justify-center rounded-t-4xl border-t bg-[radial-gradient(35%_128px_at_50%_0%,theme(backgroundColor.white/8%),transparent)] px-6 py-12 lg:py-16", className)}>
            <div className="bg-foreground/20 absolute top-0 right-1/2 left-1/2 h-px w-1/3 -translate-x-1/2 -translate-y-1/2 rounded-full blur" />

            <div className="grid w-full gap-8 xl:grid-cols-3 xl:gap-8">
                {/* Brand Column */}
                <AnimatedContainer className="space-y-4">
                    <Link href="/" className="flex items-center space-x-2 group w-fit">
                        <div className="h-8 w-8 bg-primary rounded-xl flex items-center justify-center shadow-sm transition-transform group-hover:scale-105">
                            <Code2 className="h-5 w-5 text-primary-foreground" />
                        </div>
                        <span className="text-xl font-bold font-mono tracking-tight">OPTRIZO</span>
                    </Link>
                    <p className="text-muted-foreground text-sm max-w-xs">
                        Forging digital excellence with code. Scalable, high-performance web applications for the modern web.
                    </p>
                    <p className="text-muted-foreground text-xs flex items-center gap-1.5">
                        <Mail className="h-3.5 w-3.5" />
                        <a href={`mailto:${contactEmail}`} className="hover:text-primary transition-colors">
                            {contactEmail}
                        </a>
                    </p>
                    <p className="text-muted-foreground text-xs mt-4">
                        © {new Date().getFullYear()} Optrizo Digital Solutions. All rights reserved.
                    </p>
                </AnimatedContainer>

                {/* Links Grid */}
                <div className="mt-10 grid grid-cols-2 gap-8 md:grid-cols-4 xl:col-span-2 xl:mt-0">
                    {footerLinks.map((section, index) => (
                        <AnimatedContainer key={section.label} delay={0.1 + index * 0.1}>
                            <div className="mb-10 md:mb-0">
                                <h3 className="text-xs font-semibold text-white uppercase tracking-wider mb-4">
                                    {section.label}
                                </h3>
                                <ul className="text-muted-foreground space-y-2 text-sm">
                                    {section.links.map((link) => (
                                        <li key={link.title}>
                                            <Link
                                                href={link.href}
                                                className="hover:text-primary inline-flex items-center gap-1.5 transition-all duration-300"
                                            >
                                                {link.icon && <link.icon className="h-4 w-4" />}
                                                {link.title}
                                            </Link>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        </AnimatedContainer>
                    ))}
                </div>
            </div>
        </footer>
    );
}

type ViewAnimationProps = {
    delay?: number;
    className?: ComponentProps<typeof motion.div>['className'];
    children: ReactNode;
};

function AnimatedContainer({ className, delay = 0.1, children }: ViewAnimationProps) {
    const shouldReduceMotion = useReducedMotion();

    if (shouldReduceMotion) {
        return <>{children}</>;
    }

    return (
        <motion.div
            initial={{ filter: 'blur(4px)', translateY: -8, opacity: 0 }}
            whileInView={{ filter: 'blur(0px)', translateY: 0, opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay, duration: 0.8 }}
            className={className}
        >
            {children}
        </motion.div>
    );
}
