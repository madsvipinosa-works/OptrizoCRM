import { Mail, MapPin, Phone } from "lucide-react";
import { ContactForm } from "@/components/public/ContactForm";
import { getSiteSettings } from "@/features/cms/actions";
import { getPublishedPage } from "@/features/cms/content/public-queries";
import type { ContactFields } from "@/features/cms/content/schemas";
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
    const [settings, contactPage] = await Promise.all([
        getSiteSettings(),
        getPublishedPage("contact"),
    ]);

    const fields = contactPage?.fields as ContactFields | undefined;

    // Use saved FAQs or fallback to defaults so FAQs are always populated
    let faqs = defaultFaqs;
    if (settings?.faqs && Array.isArray(settings.faqs) && settings.faqs.length > 0) {
        faqs = settings.faqs as { question: string; answer: string }[];
    }

    const heading = fields?.heading || "Let's Build Something Great";
    const intro = fields?.intro || "We'd love to hear from you. Please fill out this form or reach out through our direct engineering channels.";
    const email = fields?.email || "hello@optrizo.com";
    const phone = fields?.phone || "+1 (555) 123-4567";
    const address = fields?.address || "123 Innovation Drive\nTech Valley, CA 94043";
    const officeHours = fields?.officeHours || "Mon - Fri from 9am to 6pm PST";

    return (
        <div className="mx-auto w-full max-w-[1400px] px-4 pb-16 pt-28 sm:px-10 sm:pb-20 sm:pt-32 lg:pb-24 lg:pt-36">
            {/* Mobile order: intro and contact details, form, FAQ.
                Desktop: intro and FAQ stack in the left column, the form spans both rows on the right. */}
            <div className="grid grid-cols-1 items-start gap-12 lg:grid-cols-12 lg:gap-x-16 lg:gap-y-14">
                {/* Left column, row 1: intro and direct contact */}
                <div className="min-w-0 space-y-8 lg:col-span-6 lg:col-start-1 lg:row-start-1">
                    <div className="space-y-4">
                        <h1 className="whitespace-pre-line text-balance text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
                            {heading}
                        </h1>
                        <p className="max-w-prose whitespace-pre-line text-base leading-relaxed text-muted-foreground sm:text-lg">
                            {intro}
                        </p>
                    </div>

                    <ul className="space-y-3">
                        <li>
                            <a
                                href={`mailto:${email}`}
                                className="group flex items-start gap-4 rounded-xl border border-border bg-card p-4 outline-none transition-colors duration-150 hover:border-brand-deep/40 focus-visible:ring-2 focus-visible:ring-ring"
                            >
                                <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-brand-soft text-brand-deep">
                                    <Mail className="size-5" strokeWidth={1.75} aria-hidden="true" />
                                </span>
                                <span className="min-w-0">
                                    <span className="block text-sm font-semibold text-foreground">Email us</span>
                                    <span className="mt-0.5 block truncate text-base text-foreground">{email}</span>
                                    <span className="block text-sm text-muted-foreground">We reply within 24 hours. Careers: careers@optrizo.com</span>
                                </span>
                            </a>
                        </li>
                        <li>
                            <div className="flex items-start gap-4 rounded-xl border border-border bg-card p-4">
                                <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-brand-soft text-brand-deep">
                                    <MapPin className="size-5" strokeWidth={1.75} aria-hidden="true" />
                                </span>
                                <div>
                                    <p className="text-sm font-semibold text-foreground">Visit us</p>
                                    <p className="mt-0.5 whitespace-pre-line text-base leading-relaxed text-foreground">{address}</p>
                                </div>
                            </div>
                        </li>
                        <li>
                            <a
                                href={`tel:${phone.replace(/\s+/g, "")}`}
                                className="group flex items-start gap-4 rounded-xl border border-border bg-card p-4 outline-none transition-colors duration-150 hover:border-brand-deep/40 focus-visible:ring-2 focus-visible:ring-ring"
                            >
                                <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-brand-soft text-brand-deep">
                                    <Phone className="size-5" strokeWidth={1.75} aria-hidden="true" />
                                </span>
                                <span>
                                    <span className="block text-sm font-semibold text-foreground">Call us</span>
                                    <span className="mt-0.5 block text-base text-foreground">{phone}</span>
                                    <span className="block whitespace-pre-line text-sm text-muted-foreground">{officeHours}</span>
                                </span>
                            </a>
                        </li>
                    </ul>
                </div>

                {/* Right column: the form. Natural height, sticky on desktop, never stretches. */}
                <div className="h-fit w-full self-start lg:sticky lg:top-28 lg:col-span-6 lg:col-start-7 lg:row-span-2 lg:row-start-1">
                    <ContactForm className="h-fit w-full self-start" />
                </div>

                {/* Left column, row 2: common questions */}
                <section aria-labelledby="faq-heading" className="min-w-0 lg:col-span-6 lg:col-start-1 lg:row-start-2">
                    <div className="space-y-1">
                        <h2 id="faq-heading" className="text-2xl font-semibold tracking-tight text-foreground">
                            Common questions
                        </h2>
                        <p className="text-sm text-muted-foreground sm:text-base">
                            Timelines, billing, ownership and the stack we build with.
                        </p>
                    </div>

                    <Accordion type="single" collapsible className="mt-5 w-full space-y-2.5">
                        {faqs.map((faq, index) => (
                            <AccordionItem
                                key={index}
                                value={`item-${index}`}
                                className="rounded-xl border border-border bg-card px-4 transition-colors duration-150 data-[state=open]:border-brand-deep/40"
                            >
                                <AccordionTrigger className="py-3.5 text-left text-base font-medium text-foreground hover:no-underline">
                                    {faq.question}
                                </AccordionTrigger>
                                <AccordionContent className="whitespace-pre-wrap pb-4 pr-2 pt-0 text-sm leading-relaxed text-muted-foreground sm:text-base">
                                    {faq.answer}
                                </AccordionContent>
                            </AccordionItem>
                        ))}
                    </Accordion>
                </section>
            </div>
        </div>
    );
}
