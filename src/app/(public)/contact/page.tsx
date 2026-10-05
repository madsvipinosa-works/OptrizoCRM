import { db } from "@/db";

import { Mail, MapPin, Phone } from "lucide-react";
import { ContactForm } from "@/components/public/ContactForm";
import { getSiteSettings } from "@/features/cms/actions";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

export default async function ContactPage() {

    const settings = await getSiteSettings();

    // Make sure we have an array of FAQs
    let faqs: { question: string, answer: string }[] = [];
    if (settings?.faqs && Array.isArray(settings.faqs)) {
        faqs = settings.faqs as { question: string, answer: string }[];
    }

    return (
        <div className="container mx-auto px-4 py-24">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-16">

                {/* Contact Info (Static) */}
                <div>
                    <h1 className="text-5xl font-bold mb-6 tracking-tight">Let&apos;s Build Something <span className="text-primary text-glow">Great</span></h1>
                    <p className="text-xl text-muted-foreground mb-12">
                        We&apos;d love to hear from you. Please fill out this form or shoot us an email.
                    </p>

                    <div className="space-y-8">
                        <div className="flex items-start gap-4">
                            <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0">
                                <Mail className="h-6 w-6" />
                            </div>
                            <div>
                                <h3 className="text-lg font-semibold mb-1">Email Us</h3>
                                <p className="text-muted-foreground">{settings?.contactEmail || "hello@optrizo.com"}</p>
                                <p className="text-muted-foreground">careers@optrizo.com</p>
                            </div>
                        </div>

                        <div className="flex items-start gap-4">
                            <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0">
                                <MapPin className="h-6 w-6" />
                            </div>
                            <div>
                                <h3 className="text-lg font-semibold mb-1">Visit Us</h3>
                                <p className="text-muted-foreground">
                                    123 Innovation Drive<br />
                                    Tech Valley, CA 94043
                                </p>
                            </div>
                        </div>

                        <div className="flex items-start gap-4">
                            <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0">
                                <Phone className="h-6 w-6" />
                            </div>
                            <div>
                                <h3 className="text-lg font-semibold mb-1">Call Us</h3>
                                <p className="text-muted-foreground">+1 (555) 123-4567</p>
                            </div>
                        </div>
                    </div>

                    {faqs.length > 0 && (
                        <div className="mt-16">
                            <h2 className="text-3xl font-bold mb-6 tracking-tight">Frequently Asked Questions</h2>
                            <Accordion type="single" collapsible className="w-full">
                                {faqs.map((faq, index) => (
                                    <AccordionItem key={index} value={`item-${index}`}>
                                        <AccordionTrigger className="text-left font-semibold text-lg">{faq.question}</AccordionTrigger>
                                        <AccordionContent className="text-muted-foreground whitespace-pre-wrap text-base">
                                            {faq.answer}
                                        </AccordionContent>
                                    </AccordionItem>
                                ))}
                            </Accordion>
                        </div>
                    )}
                </div>


                <ContactForm />
            </div>
        </div>
    );
}
