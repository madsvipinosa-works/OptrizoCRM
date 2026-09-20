"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { analyzeScopeWithAI, provisionProjectFromScope, type ParsedScope } from "@/actions/project-scoper";
import { Sparkles, Loader2, CheckCircle2, ChevronRight, Server, LayoutDashboard } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

export function ScopeDeconstructorModal() {
  const [open, setOpen] = useState(false);
  const [rawBrief, setRawBrief] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isProvisioning, setIsProvisioning] = useState(false);
  const [parsedScope, setParsedScope] = useState<ParsedScope | null>(null);
  const router = useRouter();

  const handleAnalyze = async () => {
    if (!rawBrief.trim()) {
      toast.error("Please paste a client brief first.");
      return;
    }

    setIsAnalyzing(true);
    setParsedScope(null);
    try {
      const res = await analyzeScopeWithAI(rawBrief);
      if (res.success && res.data) {
        setParsedScope(res.data);
        toast.success("Project scope generated successfully!");
      } else {
        toast.error(res.error || "Failed to generate scope");
      }
    } catch (e) {
      toast.error("An unexpected error occurred.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleProvision = async () => {
    if (!parsedScope) return;
    setIsProvisioning(true);
    try {
      const res = await provisionProjectFromScope(parsedScope, rawBrief);
      if (res.success && res.projectId) {
        toast.success("Project provisionsed successfully!");
        setOpen(false);
        router.push(`/dashboard/pm/${res.projectId}`);
      } else {
        toast.error(res.error || "Failed to provision project");
      }
    } catch (e) {
      toast.error("An unexpected error occurred.");
    } finally {
      setIsProvisioning(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="default" className="bg-primary/20 hover:bg-primary/30 text-primary border border-primary/50 shadow-[0_0_15px_rgba(var(--primary),0.3)]">
          <Sparkles className="w-4 h-4 mr-2" />
          Auto-Generate Project
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl bg-card border-border text-foreground shadow-2xl backdrop-blur-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl font-bold text-foreground">
            <Sparkles className="w-5 h-5 text-primary" />
            Autonomous Scope & Effort Deconstructor
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Paste an unstructured client email or brief. The AI will instantly generate a weighted Agile Kanban board.
          </DialogDescription>
        </DialogHeader>

        {!parsedScope ? (
          <div className="space-y-4 py-4">
            <Textarea
              placeholder="e.g., 'We need a marketplace for local artists. It needs user profiles, an image gallery, Stripe payments, and a shopping cart...'"
              className="min-h-[200px] bg-background border-border text-foreground focus-visible:ring-primary/50 resize-none font-mono text-sm placeholder:text-muted-foreground"
              value={rawBrief}
              onChange={(e) => setRawBrief(e.target.value)}
            />
            <div className="flex justify-end">
              <Button 
                onClick={handleAnalyze} 
                disabled={isAnalyzing || !rawBrief.trim()}
                className="w-full sm:w-auto bg-primary hover:bg-primary/90 text-black font-bold cursor-pointer"
              >
                {isAnalyzing ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Analyzing Scope...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 mr-2" />
                    Analyze & Deconstruct
                  </>
                )}
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-6 py-4 animate-in fade-in slide-in-from-bottom-4">
            <div className="bg-primary/10 border border-primary/20 rounded-lg p-4">
              <h3 className="font-semibold text-lg flex items-center gap-2 text-foreground">
                <LayoutDashboard className="w-5 h-5 text-primary" />
                {parsedScope.projectTitle}
              </h3>
              <p className="text-sm text-muted-foreground mt-1">
                {parsedScope.projectDescription}
              </p>
            </div>

            <div className="max-h-[400px] overflow-y-auto space-y-6 pr-2 custom-scrollbar">
              {parsedScope.milestones.map((milestone, i) => (
                <div key={i} className="space-y-3">
                  <h4 className="font-medium text-sm text-foreground flex items-center gap-2 sticky top-0 bg-card py-2 z-10 border-b border-border/50">
                    <span className="flex items-center justify-center w-5 h-5 rounded-full bg-primary/20 text-primary font-mono text-xs font-bold">
                      {milestone.order}
                    </span>
                    {milestone.title}
                  </h4>
                  <div className="space-y-2 pl-4 border-l border-border ml-2">
                    {milestone.tasks.map((task, j) => (
                      <div key={j} className="bg-muted/30 border border-border rounded-lg p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 group hover:bg-muted/60 transition-colors">
                        <div>
                          <div className="font-medium text-sm text-foreground flex items-center gap-2">
                            <CheckCircle2 className="w-3.5 h-3.5 text-primary" />
                            {task.title}
                          </div>
                          <div className="text-xs text-muted-foreground mt-1 ml-5">
                            {task.description}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <Badge variant="outline" className="bg-background border-border text-xs text-foreground font-mono">
                            {task.weight} pts
                          </Badge>
                          <Badge variant="outline" className="bg-background border-border text-xs text-primary font-mono">
                            {task.estimatedHours} hrs
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className="flex flex-col-reverse sm:flex-row justify-between gap-3 pt-4 border-t border-border">
              <Button variant="ghost" onClick={() => setParsedScope(null)} disabled={isProvisioning} className="hover:bg-muted text-foreground">
                Back to Edit
              </Button>
              <div className="flex items-center gap-3">
                <div className="text-xs text-muted-foreground text-right hidden sm:block font-mono">
                  Total Tasks: {parsedScope.milestones.reduce((acc, m) => acc + m.tasks.length, 0)} <br/>
                  Total Effort: {parsedScope.milestones.reduce((acc, m) => acc + m.tasks.reduce((sum, t) => sum + t.estimatedHours, 0), 0)} hrs
                </div>
                <Button onClick={handleProvision} disabled={isProvisioning} className="bg-primary hover:bg-primary/90 text-black font-bold w-full sm:w-auto cursor-pointer">
                  {isProvisioning ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Server className="w-4 h-4 mr-2" />
                  )}
                  Provision Project
                  {!isProvisioning && <ChevronRight className="w-4 h-4 ml-1" />}
                </Button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
