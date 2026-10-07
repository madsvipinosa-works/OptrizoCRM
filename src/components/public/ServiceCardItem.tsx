"use client";

import { useState, useActionState, useEffect, useRef } from "react";
import { LoginModal } from "@/components/auth/LoginModal";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ArrowRight, CheckCircle2, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { submitIntakeForm, type IntakeState } from "@/features/crm/actions/submit-intake";
import { BUDGET_OPTIONS } from "@/lib/constants";

interface ServiceCardItemProps {
  service: {
    id: string;
    title: string;
    description: string;
    icon?: string | null;
  };
  images: string[];
  tags: string[];
  isLoggedIn: boolean;
}

const initialState: IntakeState = {
    message: "",
    errors: {},
    success: false,
}

export function ServiceCardItem({ service, tags, isLoggedIn }: ServiceCardItemProps) {
  const router = useRouter();
  const redirectTarget = `/portal/request-proposal?serviceId=${service.id}`;
  const [isOpen, setIsOpen] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  
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

  const ActionButton = () => (
    <Button 
      className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold rounded-full mt-4 group transition-all duration-300 shadow-md hover:shadow-lg"
    >
      Avail This Service
      <ArrowRight className="h-4 w-4 ml-2 transition-transform group-hover:translate-x-1" />
    </Button>
  );

  const cardContent = (
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
      </div>
      
      <h3 className="text-2xl font-bold text-card-foreground mb-3 tracking-tight">
        {service.title}
      </h3>
      
      <p className="text-muted-foreground text-sm leading-relaxed mb-6 flex-grow">
        {service.description}
      </p>

      {/* Placeholder graphic container */}
      <div className="w-full h-32 bg-muted/50 rounded-xl mb-6 border border-border flex items-center justify-center overflow-hidden relative group-hover:border-primary/20 transition-colors">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
        <span className="text-muted-foreground font-mono text-sm">[ Graphic Visualization ]</span>
      </div>

      <div className="mt-auto pt-4 border-t border-border">
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
                  <form action={formAction} ref={formRef} className="space-y-6 pt-4">
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
  );

  return (
    <div className="h-full">
      {cardContent}
    </div>
  );
}
