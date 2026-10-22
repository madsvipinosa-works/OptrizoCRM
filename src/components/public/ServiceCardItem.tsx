"use client";

import { useState, useActionState, useEffect, useRef } from "react";
import Image from "next/image";
import { LoginModal } from "@/components/auth/LoginModal";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ArrowRight, CheckCircle2, Loader2, Sparkles, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { submitIntakeForm, type IntakeState } from "@/features/crm/actions/submit-intake";
import { BUDGET_OPTIONS } from "@/lib/constants";
import { ServiceDetailModal, type ServiceDetailItem } from "@/components/public/ServiceDetailModal";

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

export function ServiceCardItem({ service, tags, isLoggedIn: initialIsLoggedIn }: ServiceCardItemProps) {
  const router = useRouter();
  const redirectTarget = `/portal/request-proposal?serviceId=${service.id}`;
  const [isOpen, setIsOpen] = useState(false);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(initialIsLoggedIn ?? false);
  
  useEffect(() => {
    if (initialIsLoggedIn !== undefined) {
      setIsLoggedIn(initialIsLoggedIn);
      return;
    }
    // Dynamic client-side session resolution (avoids blocking static page rendering on server)
    import("next-auth/react").then(({ getSession }) => {
      getSession().then((session) => {
        if (session?.user) {
          setIsLoggedIn(true);
        }
      });
    }).catch(() => {});
  }, [initialIsLoggedIn]);

  const [state, formAction, isPending] = useActionState(submitIntakeForm, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.success) {
      setIsSuccess(true);
      const timer = setTimeout(() => {
        setIsOpen(false);
        setIsSuccess(false);
        router.push("/portal/projects");
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [state?.success, router]);

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

  const handleAvailFromDetail = () => {
    setIsDetailOpen(false);
    if (!isLoggedIn) {
      router.push(redirectTarget);
    } else {
      setIsOpen(true);
    }
  };

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

        {/* High-fidelity Graphic Visualization */}
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

          {/* Avail This Service Direct CTA */}
          {!isLoggedIn ? (
            <LoginModal defaultRedirect={redirectTarget}>
              <div className="w-full">
                <ActionButton />
              </div>
            </LoginModal>
          ) : (
            <Dialog open={isOpen} onOpenChange={setIsOpen}>
              <DialogTrigger asChild>
                <div className="w-full cursor-pointer">
                  <ActionButton />
                </div>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[600px] bg-card border-border text-card-foreground rounded-2xl shadow-xl max-h-[90vh] overflow-y-auto override-scrollbar">
                {isSuccess ? (
                  <div className="py-12 flex flex-col items-center justify-center text-center space-y-4">
                    <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center border border-primary/20 text-primary mb-2">
                      <CheckCircle2 className="h-8 w-8" />
                    </div>
                    <h3 className="text-xl font-bold text-card-foreground">Request Received</h3>
                    <p className="text-muted-foreground text-sm">We&apos;ll be in touch shortly to begin architecting your solution.</p>
                  </div>
                ) : (
                  <>
                    <DialogHeader>
                      <DialogTitle className="text-xl font-bold text-card-foreground">Avail {service.title}</DialogTitle>
                      <DialogDescription className="text-muted-foreground">
                        Provide some brief details about your project to get started.
                      </DialogDescription>
                    </DialogHeader>
                    <form key={state.success ? "success-reset" : "active-service-intake-form"} action={formAction} ref={formRef} className="space-y-6 pt-4">
                      <input type="hidden" name="serviceId" value={service.id} />
                      
                      {state?.message && (
                          <div className={cn("p-3 rounded-md text-sm", state.success ? "bg-primary/10 text-primary border border-primary/20" : "bg-destructive/10 text-destructive border border-destructive/20")}>
                              {state.message}
                          </div>
                      )}

                      <div className="space-y-2">
                        <Label htmlFor="businessName" className="text-foreground">Business / Company Name</Label>
                        <Input 
                          id="businessName" 
                          name="businessName"
                          required 
                          defaultValue={state.values?.businessName}
                          className="bg-background border-input text-foreground focus-visible:ring-primary focus-visible:border-primary placeholder:text-muted-foreground" 
                          placeholder="Acme Corp"
                        />
                        {state?.errors?.businessName && (
                            <p className="text-sm text-destructive">{state.errors.businessName[0]}</p>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                              <Label htmlFor="industry" className="text-foreground">Industry</Label>
                              <Input 
                                  id="industry" 
                                  name="industry" 
                                  placeholder="e.g. Real Estate, E-commerce" 
                                  defaultValue={state.values?.industry}
                                  className="bg-background border-input text-foreground focus-visible:ring-primary placeholder:text-muted-foreground" 
                              />
                              {state?.errors?.industry && (
                                  <p className="text-sm text-destructive">{state.errors.industry[0]}</p>
                              )}
                          </div>
                          <div className="space-y-2">
                              <Label htmlFor="targetAudience" className="text-foreground">Target Audience</Label>
                              <Input 
                                  id="targetAudience" 
                                  name="targetAudience" 
                                  placeholder="Who are your customers?" 
                                  defaultValue={state.values?.targetAudience}
                                  className="bg-background border-input text-foreground focus-visible:ring-primary placeholder:text-muted-foreground" 
                              />
                              {state?.errors?.targetAudience && (
                                  <p className="text-sm text-destructive">{state.errors.targetAudience[0]}</p>
                              )}
                          </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                              <Label htmlFor="budget" className="text-foreground">Budget Range</Label>
                              <select
                                  id="budget"
                                  name="budget"
                                  defaultValue={state.values?.budget || ""}
                                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                  <option value="" className="bg-card">Select a budget...</option>
                                  {BUDGET_OPTIONS.map((option) => (
                                      <option key={option} value={option} className="bg-card">
                                          {option}
                                      </option>
                                  ))}
                              </select>
                              {state?.errors?.budget && (
                                  <p className="text-sm text-destructive">{state.errors.budget[0]}</p>
                              )}
                          </div>
                          <div className="space-y-2">
                              <Label htmlFor="timelineExpectation" className="text-foreground">Timeline Expectation</Label>
                              <select
                                  id="timelineExpectation"
                                  name="timelineExpectation"
                                  defaultValue={state.values?.timelineExpectation || ""}
                                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                  <option value="" className="bg-card">Select a timeline...</option>
                                  <option value="ASAP" className="bg-card">ASAP</option>
                                  <option value="1-2 months" className="bg-card">1-2 months</option>
                                  <option value="3-6 months" className="bg-card">3-6 months</option>
                                  <option value="Flexible" className="bg-card">Flexible</option>
                              </select>
                              {state?.errors?.timelineExpectation && (
                                  <p className="text-sm text-destructive">{state.errors.timelineExpectation[0]}</p>
                              )}
                          </div>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="goals" className="text-foreground">Project Goals & Description</Label>
                        <Textarea 
                          id="goals" 
                          name="goals"
                          required 
                          rows={4}
                          defaultValue={state.values?.goals}
                          className="bg-background border-input text-foreground focus-visible:ring-primary focus-visible:border-primary placeholder:text-muted-foreground resize-none" 
                          placeholder="What are you trying to achieve? What are the key deliverables?"
                        />
                        {state?.errors?.goals && (
                            <p className="text-sm text-destructive">{state.errors.goals[0]}</p>
                        )}
                      </div>

                      <DialogFooter className="pt-4 border-t border-border">
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
                          className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-full shadow-md"
                        >
                          {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Submit Request"}
                        </Button>
                      </DialogFooter>
                    </form>
                  </>
                )}
              </DialogContent>
            </Dialog>
          )}
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
