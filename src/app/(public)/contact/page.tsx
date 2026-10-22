import { Mail, MapPin, Phone, HelpCircle, ArrowRight, Sparkles } from "lucide-react";
import { ContactForm } from "@/components/public/ContactForm";
import { getSiteSettings } from "@/features/cms/actions";
import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "@/components/ui/accordion";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export const revalidate = 3600;

export default async function ContactPage() {
    const settings = await getSiteSettings();

    // Make sure we have an array of FAQs
    let faqs: { question: string; answer: string }[] = [];
    if (settings?.faqs && Array.isArray(settings.faqs)) {
        faqs = settings.faqs as { question: string; answer: string }[];
    }

    const contactEmail = settings?.contactEmail || "hello@optrizo.com";

    return (
        <div className="container mx-auto px-4 py-20 lg:py-28 relative">
            {/* Ambient Lighting Glows */}
            <div className="absolute top-12 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-3xl pointer-events-none -z-10" />
            <div className="absolute top-1/3 right-10 w-80 h-80 bg-purple-500/5 rounded-full blur-3xl pointer-events-none -z-10" />

            {/* Primary Grid: Contact Details & Sticky Contact Form */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-start">
                {/* Left Column: Direct Outreach & Company Channels */}
                <div className="lg:col-span-5 space-y-8">
                    <div className="space-y-4">
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-primary/10 text-primary border border-primary/20">
                            <Sparkles className="w-3.5 h-3.5" /> Direct Communications
                        </div>
                        <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-foreground">
                            Let&apos;s Build Something <span className="text-primary text-glow">Great</span>
                        </h1>
                        <p className="text-lg text-muted-foreground leading-relaxed">
                            Whether you need enterprise web architecture, an MVP sprint, or cloud infrastructure, our engineering squad is ready to consult.
                        </p>
                    </div>

                    {/* Direct Contact Cards */}
                    <div className="space-y-4">
                        <a
                            href={`mailto:${contactEmail}`}
                            className="flex items-start gap-4 p-4 rounded-xl border border-border bg-card/60 backdrop-blur-sm hover:border-primary/50 hover:bg-card/90 transition-all group"
                        >
                            <div className="h-11 w-11 rounded-lg bg-primary/10 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-black transition-colors shrink-0">
                                <Mail className="h-5 w-5" />
                            </div>
                            <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                    <h3 className="text-base font-semibold text-foreground">Email Us</h3>
                                    <span className="text-[11px] font-medium text-primary px-1.5 py-0.5 rounded-full bg-primary/10 border border-primary/20">Replies in 24h</span>
                                </div>
                                <p className="text-sm text-foreground/90 font-medium truncate mt-0.5">{contactEmail}</p>
                                <p className="text-xs text-muted-foreground">careers@optrizo.com</p>
                            </div>
                        </a>

                        <div className="flex items-start gap-4 p-4 rounded-xl border border-border bg-card/60 backdrop-blur-sm">
                            <div className="h-11 w-11 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0">
                                <MapPin className="h-5 w-5" />
                            </div>
                            <div>
                                <h3 className="text-base font-semibold text-foreground">Visit Us</h3>
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
                            <div className="h-11 w-11 rounded-lg bg-primary/10 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-black transition-colors shrink-0">
                                <Phone className="h-5 w-5" />
                            </div>
                            <div>
                                <h3 className="text-base font-semibold text-foreground">Call Us Directly</h3>
                                <p className="text-sm text-foreground/90 font-medium mt-0.5">+1 (555) 123-4567</p>
                                <p className="text-xs text-muted-foreground">Mon - Fri from 9am to 6pm PST</p>
                            </div>
                        </a>
                    </div>

                    {/* Interactive Scoping Banner */}
                    <div className="p-5 rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/10 via-card/50 to-card/80 space-y-3 relative overflow-hidden">
                        <div className="flex items-center gap-2 text-primary font-semibold text-sm">
                            <Sparkles className="w-4 h-4" /> Looking for instant scoping?
                        </div>
                        <p className="text-xs text-muted-foreground leading-relaxed">
                            Have specific features or deliverables? Use our Project Intake Wizard to build a custom scope with instant budgeting tiers.
                        </p>
                        <Button asChild size="sm" className="w-full bg-primary text-black hover:bg-primary/90 font-semibold mt-1">
                            <Link href="/intake">
                                Launch Project Wizard <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
                            </Link>
                        </Button>
                    </div>
                </div>

                {/* Right Column: Contact Form (Fixed natural height, never stretches) */}
                <div className="lg:col-span-7 w-full h-fit self-start">
                    <ContactForm />
                </div>
            </div>

            {/* Dedicated FAQs Section: Completely Decoupled from Contact Form */}
            {faqs.length > 0 && (
                <section className="mt-24 pt-20 border-t border-border/60 relative">
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[300px] bg-primary/5 rounded-full blur-3xl pointer-events-none -z-10" />

                    <div className="text-center max-w-2xl mx-auto mb-12 space-y-3">
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-primary/10 text-primary border border-primary/20">
                            <HelpCircle className="w-3.5 h-3.5" /> Frequently Asked Questions
                        </div>
                        <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-foreground">
                            Got Questions? We&apos;ve Got <span className="text-primary text-glow">Answers</span>
                        </h2>
                        <p className="text-base text-muted-foreground">
                            Straightforward clarity on our engineering process, sprint models, IP ownership, and delivery timelines.
                        </p>
                    </div>

                    <div className="max-w-3xl mx-auto">
                        <Accordion type="single" collapsible className="w-full space-y-3.5">
                            {faqs.map((faq, index) => (
                                <AccordionItem
                                    key={index}
                                    value={`item-${index}`}
                                    className="border border-border/80 bg-card/60 backdrop-blur-md rounded-xl px-5 transition-all hover:border-primary/40 data-[state=open]:border-primary/40 data-[state=open]:bg-card/90"
                                >
                                    <AccordionTrigger className="text-left font-semibold text-base sm:text-lg text-foreground hover:text-primary hover:no-underline py-4">
                                        <div className="flex items-center gap-3 pr-2">
                                            <span className="font-mono text-xs font-bold text-primary/80 px-2 py-0.5 rounded bg-primary/10 border border-primary/20 shrink-0">
                                                {String(index + 1).padStart(2, "0")}
                                            </span>
                                            <span>{faq.question}</span>
                                        </div>
                                    </AccordionTrigger>
                                    <AccordionContent className="text-muted-foreground whitespace-pre-wrap text-sm sm:text-base leading-relaxed pl-10 pr-2 pb-5 pt-1">
                                        {faq.answer}
                                    </AccordionContent>
                                </AccordionItem>
                            ))}
                        </Accordion>

                        {/* Bottom Help Note */}
                        <div className="mt-10 p-5 rounded-xl border border-border bg-card/40 text-center space-y-2">
                            <p className="text-sm text-foreground font-medium">Have a question that isn&apos;t listed here?</p>
                            <p className="text-xs text-muted-foreground">
                                We are always happy to answer technical questions, review RFPs, or execute standard NDAs prior to discovery.
                            </p>
                            <div className="pt-2">
                                <a
                                    href={`mailto:${contactEmail}`}
                                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline"
                                >
                                    <Mail className="w-3.5 h-3.5" />
                                    Send us an email directly at {contactEmail}
                                </a>
                            </div>
                        </div>
                    </div>
                </section>
            )}
        </div>
    );
}
