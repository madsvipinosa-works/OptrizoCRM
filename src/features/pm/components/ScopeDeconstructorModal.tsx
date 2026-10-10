"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { analyzeScopeWithAI, provisionProjectFromScope, type ParsedScope } from "@/actions/project-scoper";
import { Sparkles, Loader2, CheckCircle2, ChevronRight, Server, LayoutDashboard, Trash2, Plus, Edit3 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

export function ScopeDeconstructorModal() {
  const [open, setOpen] = useState(false);
  const [rawBrief, setRawBrief] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isProvisioning, setIsProvisioning] = useState(false);
  const [parsedScope, setParsedScope] = useState<ParsedScope | null>(null);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const router = useRouter();

  const handleAnalyze = async () => {
    if (!rawBrief.trim() || rawBrief.trim().length < 10) {
      toast.error("Please paste a descriptive client brief (at least 10 characters).");
      return;
    }

    setIsAnalyzing(true);
    setParsedScope(null);
    try {
      const res = await analyzeScopeWithAI(rawBrief);
      if (res.success && res.data) {
        setParsedScope(res.data);
        toast.success("Project scope drafted successfully!");
      } else {
        toast.error(res.error || "Failed to generate scope");
      }
    } catch {
      toast.error("An unexpected error occurred during scope analysis.");
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
        toast.success("Project provisioned successfully!");
        setOpen(false);
        router.push(`/dashboard/pm/${res.projectId}`);
      } else {
        toast.error(res.error || "Failed to provision project");
      }
    } catch {
      toast.error("An unexpected error occurred during provisioning.");
    } finally {
      setIsProvisioning(false);
    }
  };

  // Human-in-the-Loop Editing Handlers
  const handleUpdateTaskTitle = (mIdx: number, tIdx: number, title: string) => {
    if (!parsedScope) return;
    const updated = { ...parsedScope };
    updated.milestones[mIdx].tasks[tIdx].title = title;
    setParsedScope(updated);
  };

  const handleUpdateTaskWeight = (mIdx: number, tIdx: number, weight: 1 | 2 | 3 | 5) => {
    if (!parsedScope) return;
    const updated = { ...parsedScope };
    updated.milestones[mIdx].tasks[tIdx].weight = weight;
    setParsedScope(updated);
  };

  const handleUpdateTaskHours = (mIdx: number, tIdx: number, hours: number) => {
    if (!parsedScope) return;
    const updated = { ...parsedScope };
    updated.milestones[mIdx].tasks[tIdx].estimatedHours = Math.max(1, Math.min(40, hours));
    setParsedScope(updated);
  };

  const handleRemoveTask = (mIdx: number, tIdx: number) => {
    if (!parsedScope) return;
    const updated = { ...parsedScope };
    updated.milestones[mIdx].tasks.splice(tIdx, 1);
    setParsedScope(updated);
  };

  const handleAddTask = (mIdx: number) => {
    if (!parsedScope) return;
    const updated = { ...parsedScope };
    updated.milestones[mIdx].tasks.push({
      title: "New Custom Task",
      description: "Custom deliverable added by Project Manager",
      weight: 2,
      estimatedHours: 6,
    });
    setParsedScope(updated);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="default" className="bg-primary/20 hover:bg-primary/30 text-primary border border-primary/50 shadow-[0_0_15px_rgba(var(--primary),0.3)]">
          <Sparkles className="w-4 h-4 mr-2" />
          Auto-Generate Project
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl bg-card border-border text-foreground shadow-2xl backdrop-blur-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl font-bold text-foreground">
            <Sparkles className="w-5 h-5 text-primary" />
            AI Scope Assistant & Effort Estimator
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Paste an unstructured client brief. The AI will deconstruct it into domain milestones and Fibonacci-weighted tasks for PM review.
          </DialogDescription>
        </DialogHeader>

        {!parsedScope ? (
          <div className="space-y-4 py-4">
            <Textarea
              placeholder="e.g., 'We need a marketplace for local artists. It needs user profiles, an image gallery, Stripe payments, and a shopping cart...'"
              className="min-h-[220px] bg-background border-border text-foreground focus-visible:ring-primary/50 resize-none font-mono text-sm placeholder:text-muted-foreground"
              value={rawBrief}
              onChange={(e) => setRawBrief(e.target.value)}
            />
            <div className="flex justify-between items-center">
              <span className="text-xs text-muted-foreground">
                Minimum 10 characters • Domain-grounded Agile backlog generator
              </span>
              <Button 
                onClick={handleAnalyze} 
                disabled={isAnalyzing || rawBrief.trim().length < 10}
                className="w-full sm:w-auto bg-primary hover:bg-primary/90 text-black font-bold cursor-pointer"
              >
                {isAnalyzing ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Deconstructing Scope...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 mr-2" />
                    Analyze & Draft Backlog
                  </>
                )}
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-6 py-4 animate-in fade-in slide-in-from-bottom-4">
            {/* Project Header Banner with Inline Editable Title */}
            <div className="bg-primary/10 border border-primary/20 rounded-lg p-4">
              <div className="flex items-center justify-between gap-2">
                {isEditingTitle ? (
                  <div className="flex items-center gap-2 flex-1">
                    <Input
                      value={parsedScope.projectTitle}
                      onChange={(e) => setParsedScope({ ...parsedScope, projectTitle: e.target.value })}
                      className="bg-background text-foreground text-sm font-semibold h-8"
                      autoFocus
                    />
                    <Button size="sm" variant="ghost" onClick={() => setIsEditingTitle(false)} className="h-8 px-2 text-xs">
                      Done
                    </Button>
                  </div>
                ) : (
                  <h3 className="font-semibold text-lg flex items-center gap-2 text-foreground">
                    <LayoutDashboard className="w-5 h-5 text-primary" />
                    {parsedScope.projectTitle}
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setIsEditingTitle(true)}
                      className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
                      title="Edit project title"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </Button>
                  </h3>
                )}
                <Badge variant="outline" className="text-xs font-mono text-primary bg-primary/10 border-primary/30">
                  Human-in-the-Loop Review
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                {parsedScope.projectDescription}
              </p>
            </div>

            {/* Editable Milestones & Tasks Backlog */}
            <div className="max-h-[420px] overflow-y-auto space-y-6 pr-2 custom-scrollbar">
              {parsedScope.milestones.map((milestone, mIdx) => (
                <div key={mIdx} className="space-y-3 bg-muted/10 p-3 rounded-lg border border-border/60">
                  <div className="flex items-center justify-between sticky top-0 bg-card py-1.5 z-10 border-b border-border/50">
                    <h4 className="font-medium text-sm text-foreground flex items-center gap-2">
                      <span className="flex items-center justify-center w-5 h-5 rounded-full bg-primary/20 text-primary font-mono text-xs font-bold">
                        {milestone.order}
                      </span>
                      {milestone.title}
                    </h4>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleAddTask(mIdx)}
                      className="h-7 text-xs text-primary hover:bg-primary/10 gap-1"
                    >
                      <Plus className="w-3.5 h-3.5" /> Add Task
                    </Button>
                  </div>

                  <div className="space-y-2 pl-2">
                    {milestone.tasks.map((task, tIdx) => (
                      <div
                        key={tIdx}
                        className="bg-muted/40 border border-border rounded-lg p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 group hover:bg-muted/70 transition-colors"
                      >
                        <div className="flex-1 space-y-1">
                          <div className="flex items-center gap-2">
                            <CheckCircle2 className="w-3.5 h-3.5 text-primary shrink-0" />
                            <Input
                              value={task.title}
                              onChange={(e) => handleUpdateTaskTitle(mIdx, tIdx, e.target.value)}
                              className="h-7 text-xs font-medium bg-transparent border-transparent hover:border-border focus:border-primary focus:bg-background px-1.5 py-0"
                            />
                          </div>
                          <p className="text-[11px] text-muted-foreground pl-5 line-clamp-2">
                            {task.description}
                          </p>
                        </div>

                        {/* Point & Hour Modifiers */}
                        <div className="flex items-center gap-2 shrink-0">
                          {/* Fibonacci Points Selector */}
                          <div className="flex items-center gap-1 bg-background border border-border rounded px-1.5 py-0.5">
                            <span className="text-[10px] uppercase font-mono text-muted-foreground">Pts:</span>
                            <select
                              value={task.weight}
                              onChange={(e) => handleUpdateTaskWeight(mIdx, tIdx, Number(e.target.value) as 1 | 2 | 3 | 5)}
                              className="bg-transparent text-xs font-mono font-bold text-foreground cursor-pointer focus:outline-none"
                            >
                              <option value={1} className="bg-card">1</option>
                              <option value={2} className="bg-card">2</option>
                              <option value={3} className="bg-card">3</option>
                              <option value={5} className="bg-card">5</option>
                            </select>
                          </div>

                          {/* Hours Input */}
                          <div className="flex items-center gap-1 bg-background border border-border rounded px-1.5 py-0.5">
                            <span className="text-[10px] uppercase font-mono text-muted-foreground">Hrs:</span>
                            <input
                              type="number"
                              min={1}
                              max={40}
                              value={task.estimatedHours}
                              onChange={(e) => handleUpdateTaskHours(mIdx, tIdx, Number(e.target.value))}
                              className="w-10 bg-transparent text-xs font-mono font-bold text-primary focus:outline-none text-right"
                            />
                          </div>

                          {/* Remove Task Button */}
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleRemoveTask(mIdx, tIdx)}
                            className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                            title="Remove task"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* Bottom Actions & Live Aggregations */}
            <div className="flex flex-col-reverse sm:flex-row justify-between gap-3 pt-4 border-t border-border">
              <Button
                variant="ghost"
                onClick={() => setParsedScope(null)}
                disabled={isProvisioning}
                className="hover:bg-muted text-foreground"
              >
                Back to Brief
              </Button>
              <div className="flex items-center gap-4">
                <div className="text-xs text-muted-foreground text-right hidden sm:block font-mono">
                  <span>Total Tasks: <strong className="text-foreground">{parsedScope.milestones.reduce((acc, m) => acc + m.tasks.length, 0)}</strong></span> •{" "}
                  <span>Total Effort: <strong className="text-primary">{parsedScope.milestones.reduce((acc, m) => acc + m.tasks.reduce((sum, t) => sum + t.estimatedHours, 0), 0)} hrs</strong></span>
                </div>
                <Button
                  onClick={handleProvision}
                  disabled={isProvisioning || parsedScope.milestones.every(m => m.tasks.length === 0)}
                  className="bg-primary hover:bg-primary/90 text-black font-bold w-full sm:w-auto cursor-pointer"
                >
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
