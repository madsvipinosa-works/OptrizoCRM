"use client";

import { useState, useActionState, useEffect, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CountryPhoneInput } from "@/components/ui/country-phone-input";
import { ArrowRight, CheckCircle2, Loader2, Sparkles, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { submitIntakeForm, getPublishedServices, type IntakeState } from "@/features/crm/actions/submit-intake";
import { ServiceDetailModal, type ServiceDetailItem } from "@/components/public/ServiceDetailModal";
import { FormSelect } from "@/components/ui/form-select";

interface ServiceCardItemProps {
  service: {
    id: string;
    title: string;
    description: string;
    slug?: string | null;
    icon?: string | null;
    image?: string | null;
    category?: string | null;
    color?: string | null;
    inclusions?: unknown;
    deliverables?: unknown;
    scopeOverview?: string | null;
    timelineEstimate?: string | null;
    targetAudience?: string | null;
  };
  images?: string[];
  tags: string[];
  isLoggedIn?: boolean;
}

const DEFAULT_SERVICE_IMAGES: Record<string, string> = {
  "Web Development": "https://images.unsplash.com/photo-1555066931-4365d14bab8c?q=80&w=1000&auto=format&fit=crop",
  "Custom Web Applications": "https://images.unsplash.com/photo-1555066931-4365d14bab8c?q=80&w=1000&auto=format&fit=crop",
  "Custom Web App Development": "https://images.unsplash.com/photo-1555066931-4365d14bab8c?q=80&w=1000&auto=format&fit=crop",
  "UI/UX Design": "https://images.unsplash.com/photo-1581291518857-4e27b48ff24e?q=80&w=1000&auto=format&fit=crop",
  "UI/UX Design & Brand Systems": "https://images.unsplash.com/photo-1581291518857-4e27b48ff24e?q=80&w=1000&auto=format&fit=crop",
  "Mobile App Development": "https://images.unsplash.com/photo-1512941937669-90a1b58e7e9c?q=80&w=1000&auto=format&fit=crop",
  "Mobile App Engineering": "https://images.unsplash.com/photo-1512941937669-90a1b58e7e9c?q=80&w=1000&auto=format&fit=crop",
  "AI Integration": "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=1000&auto=format&fit=crop",
  "Cloud & Scalable Infrastructure": "https://images.unsplash.com/photo-1558494949-ef010cbdcc31?q=80&w=1000&auto=format&fit=crop",
  "Cloud & DevOps": "https://images.unsplash.com/photo-1558494949-ef010cbdcc31?q=80&w=1000&auto=format&fit=crop",
};

export const URGENCY_OPTIONS = [
  "Within 1 month",
  "1-2 months",
  "3-6 months",
  "ASAP",
  "Flexible",
];

export const INDUSTRY_OPTIONS = [
  "Retail",
  "E-commerce",
  "Technology & SaaS",
  "Healthcare",
  "Finance & Banking",
  "Real Estate",
  "Education",
  "Hospitality & Tourism",
  "Logistics & Supply Chain",
  "Other",
];

export const CONTACT_PREFERENCES = [
  "Phone call",
  "Email",
  "Video meeting",
] as const;

const initialState: IntakeState = {
  message: "",
  errors: {},
  success: false,
};

function parseStringArray(val: unknown): string[] {
  if (!val) return [];
  if (Array.isArray(val)) return val.map(String).filter(Boolean);
  if (typeof val === "string") {
    try {
      const parsed = JSON.parse(val);
      if (Array.isArray(parsed)) return parsed.map(String).filter(Boolean);
    } catch {
      return val.split("\n").map((s) => s.trim()).filter(Boolean);
    }
  }
  return [];
}

export function ServiceCardItem({ service, tags }: ServiceCardItemProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  // Full number with dial code, e.g. "+63 917 555 0142". The picker limits digits per country.
  const [phone, setPhone] = useState("");
  const [selectedServiceId, setSelectedServiceId] = useState(service.id);
  const [serviceOptions, setServiceOptions] = useState<{ id: string; title: string }[]>([]);
  const [sessionUser, setSessionUser] = useState<{ name?: string | null; email?: string | null } | null>(null);

  const [state, formAction, isPending] = useActionState(submitIntakeForm, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  // Load published services and session client-side
  useEffect(() => {
    getPublishedServices()
      .then((servicesList) => {
        if (servicesList && servicesList.length > 0) {
          setServiceOptions(servicesList);
        } else {
          setServiceOptions([{ id: service.id, title: service.title }]);
        }
      })
      .catch(() => {
        setServiceOptions([{ id: service.id, title: service.title }]);
      });

    import("next-auth/react")
      .then(({ getSession }) => {
        getSession().then((sess) => {
          if (sess?.user) {
            setSessionUser(sess.user);
          }
        });
      })
      .catch(() => {});
  }, [service.id, service.title]);

  const detailItem: ServiceDetailItem = {
    id: service.id,
    title: service.title,
    description: service.description,
    slug: service.slug,
    category: service.category,
    image: service.image || DEFAULT_SERVICE_IMAGES[service.title],
    color: service.color,
    inclusions: parseStringArray(service.inclusions),
    deliverables: parseStringArray(service.deliverables),
    scopeOverview: service.scopeOverview,
    timelineEstimate: service.timelineEstimate,
    targetAudience: service.targetAudience,
  };

  // Sign-in is required before the inquiry form opens (the server action enforces it too).
  const openInquiry = () => {
    setIsDetailOpen(false);
    if (!sessionUser) {
      router.push("/login?callbackUrl=/services&reason=inquiry_auth");
      return;
    }
    setSelectedServiceId(service.id);
    setIsOpen(true);
  };
  const handleAvailFromDetail = openInquiry;

  const ActionButton = () => (
    <Button 
      className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold rounded-full group transition-all duration-300 shadow-md hover:shadow-lg"
    >
      Avail This Service
      <ArrowRight className="h-4 w-4 ml-2 transition-transform group-hover:translate-x-1" />
    </Button>
  );

  return (
    <>
      <div className="flex flex-col h-full bg-card backdrop-blur-xl border border-border rounded-2xl p-6 transition-all duration-300 hover:border-primary/50 hover:bg-muted/30 group shadow-sm">
        {/* Visual Top Highlight */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-3/4 h-[1px] bg-gradient-to-r from-transparent via-primary/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

        <div className="flex flex-wrap gap-2 mb-4">
          {tags.map((tag, idx) => (
            <span 
              key={idx} 
              className="px-3 py-1 bg-primary/10 text-primary border border-primary/20 text-xs font-bold tracking-wider uppercase rounded-full flex items-center gap-1.5"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
              {tag}
            </span>
          ))}
          {service.timelineEstimate && (
            <span className="px-3 py-1 bg-muted/60 text-muted-foreground border border-border text-xs font-mono rounded-full flex items-center gap-1">
              <Clock className="w-3 h-3 text-primary" />
              {service.timelineEstimate}
            </span>
          )}
        </div>
        
        <h3
          onClick={() => setIsDetailOpen(true)}
          className="text-2xl font-bold text-card-foreground mb-3 tracking-tight cursor-pointer hover:text-primary transition-colors"
        >
          {service.title}
        </h3>
        
        <p className="text-muted-foreground text-sm leading-relaxed mb-6 flex-grow">
          {service.description}
        </p>

        {/* Graphic Visualization */}
        <div
          onClick={() => setIsDetailOpen(true)}
          className="relative w-full h-40 rounded-xl mb-6 border border-border/80 overflow-hidden group-hover:border-primary/40 transition-all duration-500 bg-muted/40 shadow-xs cursor-pointer group/img"
        >
          <Image
            src={
              service.image ||
              DEFAULT_SERVICE_IMAGES[service.title] ||
              "https://images.unsplash.com/photo-1555066931-4365d14bab8c?q=80&w=1000&auto=format&fit=crop"
            }
            alt={service.title}
            fill
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            className="object-cover group-hover/img:scale-105 transition-transform duration-700 ease-out"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-background/95 via-background/20 to-transparent" />
          <div className="absolute bottom-2.5 left-3 right-3 flex items-center justify-between pointer-events-none">
            <span className="text-[11px] font-mono uppercase tracking-wider text-white/95 font-bold bg-black/60 backdrop-blur-md px-2.5 py-1 rounded-md border border-white/10 flex items-center gap-1.5 shadow-sm">
              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
              {service.category || "Optrizo Solution"}
            </span>
            <span className="text-[10px] font-mono text-white/90 bg-primary/20 text-primary backdrop-blur-xs px-2 py-0.5 rounded border border-primary/30">
              CLICK TO VIEW INCLUSIONS
            </span>
          </div>
        </div>

        <div className="mt-auto pt-4 border-t border-border flex flex-col gap-2.5">
          {/* Quick Details & Inclusions trigger */}
          <Button
            type="button"
            variant="outline"
            onClick={() => setIsDetailOpen(true)}
            className="w-full border-border hover:bg-muted text-foreground text-xs font-semibold rounded-full gap-2 transition-all bg-card/40"
          >
            <Sparkles className="w-3.5 h-3.5 text-primary" />
            View Inclusions & Details
          </Button>

          {/* Inquiry Form Modal (sign-in required - Mockups 008-1 to 011-1c) */}
          <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <div className="w-full cursor-pointer" onClick={openInquiry}>
              <ActionButton />
            </div>
            <DialogContent className="sm:max-w-[660px] bg-card border-border text-card-foreground rounded-2xl shadow-xl max-h-[90vh] overflow-y-auto override-scrollbar p-6 md:p-8">
              {state.success ? (
                /* Mockup 011-1c: Thank-you card / Inquiry received confirmation */
                <div className="py-6 flex flex-col space-y-6">
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-xs font-semibold self-start">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Inquiry received
                  </div>

                  <div>
                    <h2 className="text-2xl font-bold tracking-tight text-foreground">
                      Thank you, {state.inquiryData?.businessName || state.inquiryData?.clientName || "there"}.
                    </h2>
                    <p className="text-muted-foreground text-sm mt-1">
                      We received your request for{" "}
                      <span className="font-semibold text-foreground">
                        {state.inquiryData?.serviceName || service.title}
                      </span>
                      . We sent a confirmation copy to{" "}
                      <span className="font-semibold text-foreground">
                        {state.inquiryData?.email}
                      </span>
                      .
                    </p>
                  </div>

                  <div className="bg-muted/40 border border-border rounded-xl p-5 space-y-3">
                    <h3 className="text-sm font-semibold text-foreground uppercase tracking-wide">
                      What happens next
                    </h3>
                    <ol className="space-y-2 text-sm text-muted-foreground list-decimal list-inside leading-relaxed">
                      <li>Our team reviews your project requirements.</li>
                      <li>We reach out to schedule a short discovery meeting.</li>
                      <li>Following the meeting, our engineering team prepares a tailored proposal.</li>
                    </ol>
                  </div>

                  <DialogFooter className="pt-2 gap-2 sm:gap-2">
                    <Button
                      asChild
                      className="w-full sm:w-auto bg-primary hover:bg-primary/90 text-primary-foreground font-semibold rounded-lg px-6"
                    >
                      <Link href="/portal" onClick={() => setIsOpen(false)}>
                        View your availed service
                      </Link>
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setIsOpen(false)}
                      className="w-full sm:w-auto font-semibold rounded-lg px-6"
                    >
                      Back to Services
                    </Button>
                  </DialogFooter>
                </div>
              ) : (
                /* Mockup 008-1 / 009-1a / 010-1b: Public Service Inquiry Form */
                <>
                  <DialogHeader className="space-y-2 pb-2 border-b border-border">
                    <div className="flex items-center justify-between">
                      <DialogTitle className="text-2xl font-bold text-card-foreground">
                        Request a service
                      </DialogTitle>
                      {sessionUser?.email && (
                        <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground bg-muted px-2.5 py-1 rounded-full border border-border">
                          Signed in as <strong className="text-foreground">{sessionUser.email}</strong>
                        </span>
                      )}
                    </div>
                    <DialogDescription className="text-muted-foreground text-sm">
                      Tell us about your project requirements. No login or credit card required.
                    </DialogDescription>
                  </DialogHeader>

                  <form
                    key={state.success ? "success-reset" : "active-public-inquiry-form"}
                    action={formAction}
                    ref={formRef}
                    className="space-y-4 pt-4"
                  >
                    {state?.message && !state.success && (
                      <div className="p-3 rounded-lg text-sm bg-destructive/10 text-destructive border border-destructive/20">
                        {state.message}
                      </div>
                    )}

                    {/* Service & Urgency (Mockup 008-1 Row 1) */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <Label htmlFor="serviceId" className="text-xs font-semibold text-foreground">
                          Service
                        </Label>
                        <FormSelect
                          id="serviceId"
                          name="serviceId"
                          value={selectedServiceId}
                          onChange={(e) => setSelectedServiceId(e.target.value)}
                        >
                          {serviceOptions.map((svc) => (
                            <option key={svc.id} value={svc.id} className="bg-card text-foreground">
                              {svc.title}
                            </option>
                          ))}
                          <option value="other" className="bg-card text-foreground">
                            Other
                          </option>
                        </FormSelect>
                      </div>

                      <div className="space-y-1.5">
                        <Label htmlFor="urgency" className="text-xs font-semibold text-foreground">
                          Urgency
                        </Label>
                        <FormSelect
                          id="urgency"
                          name="urgency"
                          defaultValue={state.values?.urgency || "Within 1 month"}
                        >
                          {URGENCY_OPTIONS.map((opt) => (
                            <option key={opt} value={opt} className="bg-card text-foreground">
                              {opt}
                            </option>
                          ))}
                        </FormSelect>
                        {state?.errors?.urgency && (
                          <p className="text-xs text-destructive">{state.errors.urgency[0]}</p>
                        )}
                      </div>
                    </div>

                    {/* Conditional Other Service text (Mockup 009-1a) */}
                    {selectedServiceId === "other" && (
                      <div className="space-y-1.5 animate-in fade-in slide-in-from-top-1 duration-200">
                        <Label htmlFor="otherServiceText" className="text-xs font-semibold text-foreground">
                          Type the service you need
                        </Label>
                        <Input
                          id="otherServiceText"
                          name="otherServiceText"
                          required
                          defaultValue={state.values?.otherServiceText}
                          placeholder="e.g. Inventory management system"
                          className="bg-background border-input text-foreground focus-visible:ring-primary"
                        />
                        {state?.errors?.otherServiceText && (
                          <p className="text-xs text-destructive">{state.errors.otherServiceText[0]}</p>
                        )}
                      </div>
                    )}

                    {/* Business Name & Client Name (Mockup 008-1 Row 2) */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <Label htmlFor="businessName" className="text-xs font-semibold text-foreground">
                          Business name
                        </Label>
                        <Input
                          id="businessName"
                          name="businessName"
                          required
                          defaultValue={state.values?.businessName}
                          placeholder="e.g. Reyes Trading"
                          className="bg-background border-input text-foreground focus-visible:ring-primary"
                        />
                        {state?.errors?.businessName && (
                          <p className="text-xs text-destructive">{state.errors.businessName[0]}</p>
                        )}
                      </div>

                      <div className="space-y-1.5">
                        <Label htmlFor="clientName" className="text-xs font-semibold text-foreground">
                          Client name
                        </Label>
                        <Input
                          id="clientName"
                          name="clientName"
                          required
                          defaultValue={state.values?.clientName || sessionUser?.name || ""}
                          placeholder="e.g. Juan Reyes"
                          className="bg-background border-input text-foreground focus-visible:ring-primary"
                        />
                        {state?.errors?.clientName && (
                          <p className="text-xs text-destructive">{state.errors.clientName[0]}</p>
                        )}
                      </div>
                    </div>

                    {/* Email & Phone Number (Mockup 008-1 / 010-1b) */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <Label htmlFor="email" className="text-xs font-semibold text-foreground">
                          Email address
                        </Label>
                        <Input
                          id="email"
                          name="email"
                          type="email"
                          required
                          defaultValue={state.values?.email || sessionUser?.email || ""}
                          placeholder="e.g. juan@reyestrading.example"
                          className="bg-background border-input text-foreground focus-visible:ring-primary"
                        />
                        {state?.errors?.email && (
                          <p className="text-xs text-destructive">{state.errors.email[0]}</p>
                        )}
                      </div>

                      <div className="space-y-1.5">
                        <Label htmlFor="phone" className="text-xs font-semibold text-foreground">
                          Phone number <span className="font-normal text-muted-foreground">(optional)</span>
                        </Label>
                        <CountryPhoneInput id="phone" value={phone} onChange={setPhone} defaultCountryCode="PH" />
                        <input type="hidden" name="phone" value={phone} />
                        {state?.errors?.phone && (
                          <p className="text-xs text-destructive">{state.errors.phone[0]}</p>
                        )}
                      </div>
                    </div>

                    {/* Industry & Role in the company (Mockup 008-1 Row 3) */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <Label htmlFor="industry" className="text-xs font-semibold text-foreground">
                          Industry
                        </Label>
                        <FormSelect
                          id="industry"
                          name="industry"
                          defaultValue={state.values?.industry || "Retail"}
                        >
                          {INDUSTRY_OPTIONS.map((ind) => (
                            <option key={ind} value={ind} className="bg-card text-foreground">
                              {ind}
                            </option>
                          ))}
                        </FormSelect>
                        {state?.errors?.industry && (
                          <p className="text-xs text-destructive">{state.errors.industry[0]}</p>
                        )}
                      </div>

                      <div className="space-y-1.5">
                        <Label htmlFor="roleInCompany" className="text-xs font-semibold text-foreground">
                          Role in the company
                        </Label>
                        <Input
                          id="roleInCompany"
                          name="roleInCompany"
                          required
                          defaultValue={state.values?.roleInCompany}
                          placeholder="e.g. Owner, Operations Manager"
                          className="bg-background border-input text-foreground focus-visible:ring-primary"
                        />
                        {state?.errors?.roleInCompany && (
                          <p className="text-xs text-destructive">{state.errors.roleInCompany[0]}</p>
                        )}
                      </div>
                    </div>

                    {/* Contact Preference (Mockup 008-1 Row 4) */}
                    <div className="space-y-1.5">
                      <Label htmlFor="contactPreference" className="text-xs font-semibold text-foreground">
                        How should we reach you?
                      </Label>
                      <FormSelect
                        id="contactPreference"
                        name="contactPreference"
                        defaultValue={state.values?.contactPreference || "Email"}
                      >
                        {CONTACT_PREFERENCES.map((pref) => (
                          <option key={pref} value={pref} className="bg-card text-foreground">
                            {pref}
                          </option>
                        ))}
                      </FormSelect>
                      {state?.errors?.contactPreference && (
                        <p className="text-xs text-destructive">{state.errors.contactPreference[0]}</p>
                      )}
                    </div>

                    {/* Project Details (Mockup 008-1 Row 5) */}
                    <div className="space-y-1.5">
                      <Label htmlFor="details" className="text-xs font-semibold text-foreground">
                        Project details <span className="font-normal text-muted-foreground">(optional)</span>
                      </Label>
                      <Textarea
                        id="details"
                        name="details"
                        rows={3}
                        defaultValue={state.values?.details}
                        placeholder="Prefer to talk it through? Choose a call or meeting above and skip this."
                        className="bg-background border-input text-foreground focus-visible:ring-primary resize-none text-sm"
                      />
                      {state?.errors?.details && (
                        <p className="text-xs text-destructive">{state.errors.details[0]}</p>
                      )}
                    </div>

                    <DialogFooter className="pt-3 border-t border-border flex flex-col sm:flex-row gap-2">
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => setIsOpen(false)}
                        className="text-muted-foreground hover:text-foreground hover:bg-muted"
                      >
                        Cancel
                      </Button>
                      <Button
                        type="submit"
                        disabled={isPending}
                        className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold rounded-lg shadow-md px-6"
                      >
                        {isPending ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Sending inquiry...
                          </>
                        ) : (
                          "Send inquiry"
                        )}
                      </Button>
                    </DialogFooter>
                  </form>
                </>
              )}
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Service Inclusions & Detail Modal */}
      <ServiceDetailModal
        service={detailItem}
        isOpen={isDetailOpen}
        onClose={() => setIsDetailOpen(false)}
        onAvailClick={handleAvailFromDetail}
      />
    </>
  );
}
