"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileUpload } from "@/components/ui/file-upload";
import { createProposal } from "@/features/proposals/actions";
import { toast } from "sonner";
import { FileText, Loader2, Plus, Trash2, UploadCloud } from "lucide-react";

interface Props {
    leadId: string;
    leadName: string;
}

export function ProposalBuilderModal({ leadId, leadName }: Props) {
    const [open, setOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    // Form state (Dynamic)
    const [scope, setScope] = useState("");
    const [deliverables, setDeliverables] = useState([""]);
    const [timeline, setTimeline] = useState("");
    const [pricingItems, setPricingItems] = useState([{ name: "", price: 0 }]);

    // Form state (Direct Upload)
    const [fileUrl, setFileUrl] = useState<string | null>(null);

    const [activeTab, setActiveTab] = useState("dynamic");

    const addDeliverable = () => setDeliverables([...deliverables, ""]);
    const removeDeliverable = (index: number) => setDeliverables(deliverables.filter((_, i) => i !== index));
    const updateDeliverable = (index: number, val: string) => {
        const newArr = [...deliverables];
        newArr[index] = val;
        setDeliverables(newArr);
    };

    const addPricingItem = () => setPricingItems([...pricingItems, { name: "", price: 0 }]);
    const removePricingItem = (index: number) => setPricingItems(pricingItems.filter((_, i) => i !== index));
    const updatePricingItem = (index: number, field: "name" | "price", val: string | number) => {
        const newArr = [...pricingItems];
        newArr[index] = { ...newArr[index], [field]: val };
        setPricingItems(newArr);
    };

    const totalAmount = pricingItems.reduce((sum, item) => sum + (Number(item.price) || 0), 0);

    const handleCreateProposal = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);

        let data;
        if (activeTab === "upload") {
            if (!fileUrl) {
                toast.error("Please upload a file first.");
                setIsLoading(false);
                return;
            }
            data = {
                fileUrl: fileUrl
            };
        } else {
            data = {
                scope,
                deliverables: JSON.stringify(deliverables.filter(d => d.trim() !== "")),
                timeline,
                pricingStructure: JSON.stringify({ items: pricingItems.filter(p => p.name.trim() !== ""), total: totalAmount })
            };
        }

        const res = await createProposal(leadId, data);
        
        if (res.success) {
            toast.success("Proposal created successfully!");
            setOpen(false);
        } else {
            toast.error(res.message || "Failed to create proposal.");
        }
        setIsLoading(false);
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="w-full bg-primary/10 text-primary border-primary/20 hover:bg-primary/20 hover:text-primary">
                    <FileText className="h-4 w-4 mr-2" />
                    Build Dynamic Proposal
                </Button>
            </DialogTrigger>
            <DialogContent className="glass-card border-white/10 text-white max-w-3xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="text-xl">Create Proposal for {leadName}</DialogTitle>
                </DialogHeader>
                
                <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-4">
                    <TabsList className="grid w-full grid-cols-2 bg-black/40 border border-white/5">
                        <TabsTrigger value="dynamic">✨ Build Dynamic</TabsTrigger>
                        <TabsTrigger value="upload">📄 Upload PDF</TabsTrigger>
                    </TabsList>
                    
                    <form onSubmit={handleCreateProposal} className="mt-6 space-y-6">
                        <TabsContent value="dynamic" className="space-y-6 mt-0">
                            {/* Scope */}
                            <div className="space-y-2">
                                <Label>Project Scope & Objectives</Label>
                                <Textarea 
                                    required={activeTab === "dynamic"}
                                    placeholder="Describe what the project aims to achieve..." 
                                    className="bg-black/50 border-white/10 min-h-[100px]"
                                    value={scope}
                                    onChange={(e) => setScope(e.target.value)}
                                />
                            </div>

                            {/* Deliverables */}
                            <div className="space-y-2 border-t border-white/5 pt-4">
                                <Label className="flex justify-between items-center">
                                    Deliverables
                                    <Button type="button" variant="ghost" size="sm" onClick={addDeliverable} className="h-6 px-2 text-xs">
                                        <Plus className="h-3 w-3 mr-1" /> Add Item
                                    </Button>
                                </Label>
                                <div className="space-y-2">
                                    {deliverables.map((item, idx) => (
                                        <div key={idx} className="flex gap-2">
                                            <Input 
                                                placeholder={`Deliverable ${idx + 1}`} 
                                                className="bg-black/50 border-white/10"
                                                value={item}
                                                onChange={(e) => updateDeliverable(idx, e.target.value)}
                                                required={activeTab === "dynamic"}
                                            />
                                            {deliverables.length > 1 && (
                                                <Button type="button" variant="ghost" size="icon" onClick={() => removeDeliverable(idx)} className="text-muted-foreground hover:text-red-500 shrink-0">
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Timeline */}
                            <div className="space-y-2 border-t border-white/5 pt-4">
                                <Label>Estimated Timeline</Label>
                                <Input 
                                    required={activeTab === "dynamic"}
                                    placeholder="e.g., 4-6 Weeks" 
                                    className="bg-black/50 border-white/10"
                                    value={timeline}
                                    onChange={(e) => setTimeline(e.target.value)}
                                />
                            </div>

                            {/* Pricing */}
                            <div className="space-y-2 border-t border-white/5 pt-4">
                                <Label className="flex justify-between items-center">
                                    Pricing Structure
                                    <Button type="button" variant="ghost" size="sm" onClick={addPricingItem} className="h-6 px-2 text-xs">
                                        <Plus className="h-3 w-3 mr-1" /> Add Line Item
                                    </Button>
                                </Label>
                                <div className="space-y-2 bg-black/20 p-3 rounded-lg border border-white/5">
                                    {pricingItems.map((item, idx) => (
                                        <div key={idx} className="flex gap-2 items-center">
                                            <Input 
                                                placeholder="Item Name (e.g. Design Phase)" 
                                                className="bg-black/50 border-white/10 flex-1"
                                                value={item.name}
                                                onChange={(e) => updatePricingItem(idx, "name", e.target.value)}
                                                required={activeTab === "dynamic"}
                                            />
                                            <div className="relative w-32 shrink-0">
                                                <span className="absolute left-3 top-2.5 text-muted-foreground">$</span>
                                                <Input 
                                                    type="number"
                                                    className="bg-black/50 border-white/10 pl-7"
                                                    value={item.price}
                                                    onChange={(e) => updatePricingItem(idx, "price", parseFloat(e.target.value) || 0)}
                                                    required={activeTab === "dynamic"}
                                                    min="0"
                                                />
                                            </div>
                                            {pricingItems.length > 1 && (
                                                <Button type="button" variant="ghost" size="icon" onClick={() => removePricingItem(idx)} className="text-muted-foreground hover:text-red-500 shrink-0">
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            )}
                                        </div>
                                    ))}
                                    <div className="flex justify-between items-center pt-2 mt-2 border-t border-white/10 px-1">
                                        <span className="text-sm font-medium text-muted-foreground">Total Estimate:</span>
                                        <span className="text-lg font-bold text-green-400">${totalAmount.toLocaleString()}</span>
                                    </div>
                                </div>
                            </div>
                        </TabsContent>

                        <TabsContent value="upload" className="space-y-6 mt-0">
                            <div className="bg-primary/5 border border-primary/10 rounded-xl p-6 text-center">
                                <UploadCloud className="h-10 w-10 text-primary mx-auto mb-3" />
                                <h3 className="text-lg font-semibold text-white mb-2">Upload Pre-made PDF</h3>
                                <p className="text-sm text-muted-foreground mb-6">
                                    If your client sent a signed PDF or you generated one using an external tool, you can upload it here to integrate it with the Deal Won automations.
                                </p>
                                <FileUpload 
                                    accept=".pdf"
                                    label=""
                                    value={fileUrl}
                                    onChange={(url) => setFileUrl(url)}
                                />
                            </div>
                        </TabsContent>

                        <div className="flex justify-end gap-3 pt-4 border-t border-white/10">
                            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
                            <Button type="submit" disabled={isLoading || (activeTab === "upload" && !fileUrl)} className="bg-primary text-black hover:bg-primary/90">
                                {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                                Generate Proposal Link
                            </Button>
                        </div>
                    </form>
                </Tabs>
            </DialogContent>
        </Dialog>
    );
}
