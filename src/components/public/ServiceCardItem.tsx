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
import { ArrowRight, Check, CheckCircle2, Loader2 } from "lucide-react";
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

export function ServiceCardItem({ service }: ServiceCardItemProps) {
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
  const openInquiry = async () => {
    setIsDetailOpen(false);
    // The session loads in the background; a click before it arrived used to send a signed-in client to the login page.
    let user = sessionUser;
    if (!user) {
      const { getSession } = await import("next-auth/react");
      user = (await getSession().catch(() => null))?.user ?? null;
      if (user) setSessionUser(user);
    }
    if (!user) {
      router.push("/login?callbackUrl=/services&reason=inquiry_auth");
      return;
    }
    setSelectedServiceId(service.id);
    setIsOpen(true);
  };
  const handleAvailFromDetail = openInquiry;

  const inclusions = parseStringArray(service.inclusions);
  const image = service.image || DEFAULT_SERVICE_IMAGES[service.title];

  return (
    <>
      {/* The same card the content editor previews (mockup C3): image, name, short description, what's included, Request this service. */}
      <article className="group flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-card transition-colors duration-200 ease-out hover:border-foreground/20">
        <button
          type="button"
          onClick={() => setIsDetailOpen(true)}
          aria-label={`View details of ${service.title}`}
          className="relative aspect-[16/9] w-full overflow-hidden bg-muted outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
        >
          {image && (
            <Image
              src={image}
              alt=""
              fill
              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
              className="object-cover transition-transform duration-500 ease-out group-hover:scale-[1.03] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
            />
          )}
        </button>

        <div className="flex flex-1 flex-col p-5">
          <h2 className="text-lg font-semibold tracking-tight text-foreground">{service.title}</h2>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{service.description}</p>

          {inclusions.length > 0 && (
            <ul className="mt-4 space-y-1.5 text-sm text-foreground">
              {inclusions.slice(0, 5).map((item, idx) => (
                <li key={`${item}-${idx}`} className="flex gap-2">
                  <Check className="mt-0.5 size-4 shrink-0 text-brand-deep" aria-hidden="true" />
                  {item}
                </li>
              ))}
              {inclusions.length > 5 && <li className="pl-6 text-muted-foreground">and {inclusions.length - 5} more in the details</li>}
            </ul>
          )}

          <div className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-2 pt-5">
            <Button type="button" onClick={openInquiry} className="group/btn h-10 gap-1.5 font-semibold active:scale-[0.97]">
              Request this service
              <ArrowRight className="size-4 transition-transform duration-200 ease-out group-hover/btn:translate-x-0.5" aria-hidden="true" />
            </Button>
            <button
              type="button"
              onClick={() => setIsDetailOpen(true)}
              className="rounded-md text-sm font-medium text-muted-foreground outline-none underline-offset-4 transition-colors hover:text-foreground hover:underline focus-visible:ring-2 focus-visible:ring-ring"
            >
              View details
            </button>
          </div>

          {/* Inquiry form (sign-in required; mockups 1 to 1c). Opened by Request this service. */}
          <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogContent className="sm:max-w-[660px] bg-card border-border text-card-foreground rounded-2xl max-h-[90vh] overflow-y-auto override-scrollbar p-6 md:p-8">
              {state.success ? (
                /* Mockup 011-1c: Thank-you card / Inquiry received confirmation */
                <div className="py-6 flex flex-col space-y-6">
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-soft text-brand-deep border border-brand-deep/30 text-xs font-semibold self-start">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Inquiry received
                  </div>

                  <div>
                    <h2 className="text-2xl font-semibold tracking-tight text-foreground">
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
                    <h3 className="text-sm font-semibold text-foreground ">
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
                      <DialogTitle className="text-2xl font-semibold text-card-foreground">
                        Request a service
                      </DialogTitle>
                      {sessionUser?.email && (
                        <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground bg-muted px-2.5 py-1 rounded-full border border-border">
                          Signed in as <strong className="text-foreground">{sessionUser.email}</strong>
                        </span>
                      )}
                    </div>
                    <DialogDescription className="text-muted-foreground text-sm">
                      Tell us about your project requirements. Fields marked * are required.
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
                          Service <span className="text-destructive" aria-hidden="true">*</span>
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
                          Urgency <span className="text-destructive" aria-hidden="true">*</span>
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
                          Type the service you need <span className="text-destructive" aria-hidden="true">*</span>
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
                          Business name <span className="text-destructive" aria-hidden="true">*</span>
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
                          Client name <span className="text-destructive" aria-hidden="true">*</span>
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
                          Email address <span className="text-destructive" aria-hidden="true">*</span>
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
                          Industry <span className="text-destructive" aria-hidden="true">*</span>
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
                          Role in the company <span className="text-destructive" aria-hidden="true">*</span>
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
                        How should we reach you? <span className="text-destructive" aria-hidden="true">*</span>
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
      </article>

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
