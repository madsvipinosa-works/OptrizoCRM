import Link from "next/link";
import { Github, Twitter, Linkedin, Mail } from "lucide-react";

export function Footer() {
    return (
        <footer className="border-t border-white/10 bg-black py-16">
            <div className="container mx-auto px-4 grid grid-cols-1 md:grid-cols-4 gap-12">
                <div className="space-y-4">
                    <div className="flex items-center space-x-2">
                        <div className="h-6 w-6 bg-primary rounded-sm"></div>
                        <span className="text-lg font-bold font-mono">OPTRIZO</span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                        Forging digital excellence with code. We build scalable, high-performance web applications for the modern web.
                    </p>
                    <div className="flex space-x-4">
                        <Link href="#" className="text-muted-foreground hover:text-primary"><Github className="h-5 w-5" /></Link>
                        <Link href="#" className="text-muted-foreground hover:text-primary"><Twitter className="h-5 w-5" /></Link>
                        <Link href="#" className="text-muted-foreground hover:text-primary"><Linkedin className="h-5 w-5" /></Link>
                    </div>
                </div>

                <div>
                    <h3 className="font-semibold mb-4 text-white">Company</h3>
                    <ul className="space-y-2 text-sm text-muted-foreground">
                        <li><Link href="/about" className="hover:text-primary transition-colors">About Us</Link></li>
                        <li><Link href="/team" className="hover:text-primary transition-colors">Our Team</Link></li>
                        <li><Link href="/careers" className="hover:text-primary transition-colors">Careers</Link></li>
                    </ul>
                </div>

                <div>
                    <h3 className="font-semibold mb-4 text-white">Resources</h3>
                    <ul className="space-y-2 text-sm text-muted-foreground">
                        <li><Link href="/blog" className="hover:text-primary transition-colors">Blog</Link></li>
                        <li><Link href="/projects" className="hover:text-primary transition-colors">Case Studies</Link></li>
                        <li><Link href="/testimonials" className="hover:text-primary transition-colors">Testimonials</Link></li>
                    </ul>
                </div>

                <div>
                    <h3 className="font-semibold mb-4 text-white">Contact</h3>
                    <ul className="space-y-2 text-sm text-muted-foreground">
                        <li className="flex items-center space-x-2"><Mail className="h-4 w-4" /> <span>hello@optrizo.com</span></li>
                        <li>123 Code Street, Tech City</li>
                    </ul>
                </div>
            </div>
            <div className="container mx-auto px-4 mt-12 pt-8 border-t border-white/5 text-center text-xs text-muted-foreground">
                © 2026 Optrizo Digital Solutions. All rights reserved.
            </div>
        </footer>
    );
}
