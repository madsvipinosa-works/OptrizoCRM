import { Mail, MapPin, Phone, HelpCircle, Sparkles } from "lucide-react";
import { ContactForm } from "@/components/public/ContactForm";
import { getSiteSettings } from "@/features/cms/actions";
import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "@/components/ui/accordion";

export const revalidate = 3600;

const defaultFaqs = [
    {
        question: "What is your typical project timeline and turnaround?",
        answer: "Most MVP builds and bespoke web platforms take between 4 to 8 weeks from kickoff to deployment. Larger enterprise infrastructure projects typically run in 2-week agile sprints with continuous delivery.",
    },
    {
        question: "How do you handle IP ownership and source code?",
        answer: "You retain 100% full intellectual property ownership of all custom code, assets, and architecture upon project completion and milestone sign-off. Everything is transferred to your private repositories.",
    },
    {
        question: "What technologies and stacks does Optrizo specialize in?",
        answer: "Our core stack includes Next.js, TypeScript, Node.js, React, PostgreSQL/Drizzle, TailwindCSS, AWS/Vercel cloud platforms, and modern AI/LLM integrations.",
    },
    {
        question: "How does billing, invoicing, and payment milestones work?",
        answer: "We typically work on milestone-based billing (e.g. 50% upfront, 50% on completion for fixed-scope MVPs) or flexible bi-weekly engineering sprints for dedicated delivery squads.",
    },
];

export default async function ContactPage() {
    const settings = await getSiteSettings();

    // Use saved FAQs or fallback to defaults so FAQs are always populated
    let faqs = defaultFaqs;
    if (settings?.faqs && Array.isArray(settings.faqs) && settings.faqs.length > 0) {
        faqs = settings.faqs as { question: string; answer: string }[];
    }

    const contactEmail = settings?.contactEmail || "hello@optrizo.com";

    return (
        <div className="container mx-auto px-4 py-16 sm:py-20 lg:py-24 relative">
            {/* Ambient Lighting Glows */}
            <div className="absolute top-12 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-3xl pointer-events-none -z-10" />
            <div className="absolute top-1/3 right-10 w-80 h-80 bg-purple-500/5 rounded-full blur-3xl pointer-events-none -z-10" />

            {/* Primary 2-Column Grid (items-start prevents contact card stretching) */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-start">
                {/* Left Column: Direct Outreach & Frequently Asked Questions */}
                <div className="lg:col-span-6 space-y-8 min-w-0">
                    <div className="space-y-4">
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-primary/10 text-primary border border-primary/20">
                            <Sparkles className="w-3.5 h-3.5" /> Direct Communications
                        </div>
                        <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-foreground">
                            Let&apos;s Build Something <span className="text-primary text-glow">Great</span>
                        </h1>
                        <p className="text-base sm:text-lg text-muted-foreground leading-relaxed">
                            We&apos;d love to hear from you. Please fill out this form or reach out through our direct engineering channels.
                        </p>
                    </div>

                    {/* Direct Contact Cards */}
                    <div className="space-y-3.5">
                        <a
                            href={`mailto:${contactEmail}`}
                            className="flex items-start gap-4 p-4 rounded-xl border border-border bg-card/60 backdrop-blur-sm hover:border-primary/50 hover:bg-card/90 transition-all group"
                        >
                            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-black transition-colors shrink-0">
                                <Mail className="h-5 w-5" />
                            </div>
                            <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                    <h3 className="text-sm font-semibold text-foreground">Email Us</h3>
                                    <span className="text-[10px] font-medium text-primary px-1.5 py-0.2 rounded-full bg-primary/10 border border-primary/20">Replies in 24h</span>
                                </div>
                                <p className="text-sm text-foreground/90 font-medium truncate mt-0.5">{contactEmail}</p>
                                <p className="text-xs text-muted-foreground">careers@optrizo.com</p>
                            </div>
                        </a>

                        <div className="flex items-start gap-4 p-4 rounded-xl border border-border bg-card/60 backdrop-blur-sm">
                            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0">
                                <MapPin className="h-5 w-5" />
                            </div>
                            <div>
                                <h3 className="text-sm font-semibold text-foreground">Visit Us</h3>
                                <p className="text-sm text-muted-foreground leading-relaxed mt-0.5">
                                    123 Innovation Drive<br />
                                    Tech Valley, CA 94043
                                </p>
                            </div>
                        </div>

                        <a
                            href="tel:+15551234567"
                            className="flex items-start gap-4 p-4 rounded-xl border border-border bg-card/60 backdrop-blur-sm hover:border-primary/50 hover:bg-card/90 transition-all group"
                        >
                            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-black transition-colors shrink-0">
                                <Phone className="h-5 w-5" />
                            </div>
                            <div>
                                <h3 className="text-sm font-semibold text-foreground">Call Us Directly</h3>
                                <p className="text-sm text-foreground/90 font-medium mt-0.5">+1 (555) 123-4567</p>
                                <p className="text-xs text-muted-foreground">Mon - Fri from 9am to 6pm PST</p>
                            </div>
                        </a>
                    </div>

                    {/* Frequently Asked Questions (Embedded directly in flow) */}
                    <div className="pt-6 border-t border-border/80 space-y-4">
                        <div className="space-y-1">
                            <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary">
                                <HelpCircle className="w-3.5 h-3.5" /> Frequently Asked Questions
                            </div>
                            <h2 className="text-2xl font-bold tracking-tight text-foreground">
                                Common Questions
                            </h2>
                            <p className="text-xs sm:text-sm text-muted-foreground">
                                Clear answers about our technical engagement models, billing, timelines, and deliverables.
                            </p>
                        </div>

                        <Accordion type="single" collapsible className="w-full space-y-2.5 pt-1">
                            {faqs.map((faq, index) => (
                                <AccordionItem
                                    key={index}
                                    value={`item-${index}`}
                                    className="border border-border/70 bg-card/50 backdrop-blur-sm rounded-xl px-4 transition-all hover:border-primary/40 data-[state=open]:border-primary/40 data-[state=open]:bg-card/80"
                                >
                                    <AccordionTrigger className="text-left font-semibold text-sm sm:text-base text-foreground hover:text-primary hover:no-underline py-3.5">
                                        <div className="flex items-center gap-2.5 pr-2">
                                            <span className="font-mono text-[11px] font-bold text-primary/90 px-1.5 py-0.5 rounded bg-primary/10 border border-primary/20 shrink-0">
                                                {String(index + 1).padStart(2, "0")}
                                            </span>
                                            <span>{faq.question}</span>
                                        </div>
                                    </AccordionTrigger>
                                    <AccordionContent className="text-muted-foreground whitespace-pre-wrap text-sm leading-relaxed pl-8 pr-2 pb-4 pt-0">
                                        {faq.answer}
                                    </AccordionContent>
                                </AccordionItem>
                            ))}
                        </Accordion>
                    </div>
                </div>

                {/* Right Column: Contact Form (Fixed natural height, sticky on desktop, NEVER stretches) */}
                <div className="lg:col-span-6 w-full h-fit self-start lg:sticky lg:top-28">
                    <ContactForm className="w-full h-fit self-start" />
                </div>
            </div>
        </div>
    );
}
