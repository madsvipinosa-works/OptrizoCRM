"use client";

import React, { useState, useRef, useEffect } from "react";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ShieldCheck, Loader2, PenTool, Type, RotateCcw, CheckSquare } from "lucide-react";
import { acceptProposalByClient } from "@/features/proposals/actions";
import { toast } from "sonner";
import confetti from "canvas-confetti";
import { useRouter } from "next/navigation";

interface AcceptProposalDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    proposalId: string;
    proposalCode?: string | null;
    totalAmount?: number | null;
    defaultName?: string | null;
}

export function AcceptProposalDialog({
    open,
    onOpenChange,
    proposalId,
    proposalCode,
    totalAmount = 0,
    defaultName = "",
}: AcceptProposalDialogProps) {
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(false);
    const [legalName, setLegalName] = useState(defaultName || "");
    const [title, setTitle] = useState("Chief Executive Officer");
    const [signatureMode, setSignatureMode] = useState<"type" | "draw">("type");
    const [agreedToTerms, setAgreedToTerms] = useState(false);

    // Canvas drawing state
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const [hasDrawn, setHasDrawn] = useState(false);

    const currencyFormatter = new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        minimumFractionDigits: 0,
    });

    // Handle canvas drawing
    useEffect(() => {
        if (signatureMode === "draw" && canvasRef.current) {
            const canvas = canvasRef.current;
            const ctx = canvas.getContext("2d");
            if (ctx) {
                ctx.strokeStyle = "#ffffff";
                ctx.lineWidth = 2.5;
                ctx.lineCap = "round";
                ctx.lineJoin = "round";
            }
        }
    }, [signatureMode, open]);

    const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        const rect = canvas.getBoundingClientRect();
        const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
        const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;

        ctx.beginPath();
        ctx.moveTo(clientX - rect.left, clientY - rect.top);
        setIsDrawing(true);
        setHasDrawn(true);
    };

    const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
        if (!isDrawing) return;
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        const rect = canvas.getBoundingClientRect();
        const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
        const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;

        ctx.lineTo(clientX - rect.left, clientY - rect.top);
        ctx.stroke();
    };

    const stopDrawing = () => {
        setIsDrawing(false);
    };

    const clearCanvas = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        setHasDrawn(false);
    };

    const handleExecuteAcceptance = async () => {
        if (!legalName.trim()) {
            toast.error("Please enter your full legal name.");
            return;
        }
        if (!agreedToTerms) {
            toast.error("Please acknowledge the legal consent terms.");
            return;
        }

        let signatureString = legalName;
        if (signatureMode === "draw" && canvasRef.current && hasDrawn) {
            signatureString = canvasRef.current.toDataURL("image/png");
        }

        setIsLoading(true);
        try {
            const res = await acceptProposalByClient(proposalId, {
                acceptedByName: legalName.trim(),
                acceptedByTitle: title.trim() || "Authorized Signer",
                signatureData: signatureString,
            });

            if (res.success) {
                confetti({
                    particleCount: 120,
                    spread: 80,
                    origin: { y: 0.6 },
                });
                toast.success(res.message);
                onOpenChange(false);
                router.refresh();
            } else {
                toast.error(res.message || "Failed to execute agreement.");
            }
        } catch (e) {
            console.error(e);
            toast.error("An error occurred while executing the agreement.");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="glass-card border-border/80 text-foreground max-w-lg w-full p-6 sm:p-8 space-y-6">
                <DialogHeader className="space-y-2 text-left">
                    <div className="flex items-center gap-2">
                        <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center text-primary">
                            <ShieldCheck className="h-4 w-4" />
                        </div>
                        <DialogTitle className="text-xl font-serif font-bold">
                            Execute & Digitally Sign Proposal
                        </DialogTitle>
                    </div>
                    <DialogDescription className="text-xs text-muted-foreground">
                        Reviewing {proposalCode || "Proposal"} • Total Investment:{" "}
                        <span className="font-semibold text-foreground font-mono">
                            {currencyFormatter.format(totalAmount || 0)}
                        </span>
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4">
                    {/* Legal Name & Title */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <Label htmlFor="legalName" className="text-xs">
                                Signer Legal Name <span className="text-destructive">*</span>
                            </Label>
                            <Input
                                id="legalName"
                                value={legalName}
                                onChange={(e) => setLegalName(e.target.value)}
                                placeholder="e.g. Eleanor Vance"
                                className="text-sm"
                                required
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="signerTitle" className="text-xs">
                                Corporate Title / Role
                            </Label>
                            <Input
                                id="signerTitle"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                placeholder="e.g. Managing Director"
                                className="text-sm"
                            />
                        </div>
                    </div>

                    {/* Signature Selection Tabs */}
                    <div className="space-y-2">
                        <Label className="text-xs">Digital Signature Style</Label>
                        <Tabs
                            value={signatureMode}
                            onValueChange={(val) => setSignatureMode(val as "type" | "draw")}
                            className="w-full"
                        >
                            <TabsList className="grid grid-cols-2 bg-muted/60">
                                <TabsTrigger value="type" className="text-xs flex items-center gap-1.5">
                                    <Type className="h-3.5 w-3.5" /> Type Signature
                                </TabsTrigger>
                                <TabsTrigger value="draw" className="text-xs flex items-center gap-1.5">
                                    <PenTool className="h-3.5 w-3.5" /> Draw Signature
                                </TabsTrigger>
                            </TabsList>

                            {/* Type Signature Tab */}
                            <TabsContent value="type" className="mt-3">
                                <div className="p-4 rounded-md bg-muted/30 border border-border flex items-center justify-center min-h-[90px]">
                                    <span className="font-serif italic text-2xl sm:text-3xl text-primary tracking-wide">
                                        {legalName.trim() || "Your Signature"}
                                    </span>
                                </div>
                            </TabsContent>

                            {/* Draw Signature Tab */}
                            <TabsContent value="draw" className="mt-3 space-y-2">
                                <div className="relative border border-border rounded-md bg-black/60 overflow-hidden">
                                    <canvas
                                        ref={canvasRef}
                                        width={420}
                                        height={110}
                                        onMouseDown={startDrawing}
                                        onMouseMove={draw}
                                        onMouseUp={stopDrawing}
                                        onMouseLeave={stopDrawing}
                                        onTouchStart={startDrawing}
                                        onTouchMove={draw}
                                        onTouchEnd={stopDrawing}
                                        className="w-full h-[110px] cursor-crosshair touch-none"
                                    />
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        onClick={clearCanvas}
                                        className="absolute top-2 right-2 h-7 px-2 text-xs text-muted-foreground hover:text-foreground bg-black/40"
                                    >
                                        <RotateCcw className="h-3 w-3 mr-1" /> Clear
                                    </Button>
                                </div>
                                <p className="text-[11px] text-muted-foreground text-center">
                                    Draw your signature in the box above using your mouse or finger.
                                </p>
                            </TabsContent>
                        </Tabs>
                    </div>

                    {/* ESIGN Legal Consent */}
                    <div className="p-3 rounded-md bg-muted/40 border border-border/80 flex items-start gap-2.5">
                        <input
                            id="termsCheckbox"
                            type="checkbox"
                            checked={agreedToTerms}
                            onChange={(e) => setAgreedToTerms(e.target.checked)}
                            className="mt-0.5 h-4 w-4 rounded border-border text-primary focus:ring-primary cursor-pointer"
                        />
                        <label htmlFor="termsCheckbox" className="text-xs text-muted-foreground leading-relaxed cursor-pointer select-none">
                            I verify that I am authorized to execute agreements on behalf of my organization. By submitting, I adopt this digital signature as my legally binding consent under the ESIGN Act and UETA regulations.
                        </label>
                    </div>
                </div>

                <DialogFooter className="flex flex-col sm:flex-row gap-2 pt-2 border-t border-border/60">
                    <Button
                        type="button"
                        variant="ghost"
                        onClick={() => onOpenChange(false)}
                        disabled={isLoading}
                        className="w-full sm:w-auto"
                    >
                        Cancel
                    </Button>
                    <Button
                        type="button"
                        onClick={handleExecuteAcceptance}
                        disabled={isLoading || !legalName.trim() || !agreedToTerms}
                        className="w-full sm:w-auto bg-primary text-primary-foreground hover:bg-primary/90 font-semibold shadow-lg shadow-primary/20"
                    >
                        {isLoading ? (
                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        ) : (
                            <CheckSquare className="h-4 w-4 mr-2" />
                        )}
                        Execute & Sign Agreement
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
