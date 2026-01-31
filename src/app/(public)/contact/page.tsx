import { db } from "@/db";

import { Mail, MapPin, Phone } from "lucide-react";
import { ContactForm } from "@/components/public/ContactForm";

export default async function ContactPage() {
    // Fetch available services for the dropdown
    let availableServices: { id: string; title: string }[] = [];
    try {
        availableServices = await db.query.services.findMany({
            columns: {
                id: true,
                title: true,
            },
        });
    } catch (error) {
        console.error("Failed to fetch services for contact form:", error);
        // Fallback or empty list
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
                                <p className="text-muted-foreground">hello@optrizo.com</p>
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
                </div>


                {/* Contact Form (Client Component) */}
                <ContactForm availableServices={availableServices} />
            </div>
        </div>
    );
}
