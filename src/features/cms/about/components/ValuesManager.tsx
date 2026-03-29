"use client";

import { useState } from "react";
import { createAboutValue, updateAboutValue, deleteAboutValue } from "@/features/cms/about-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Trash2, Pencil, Plus, Check, X } from "lucide-react";
import { toast } from "sonner";

// Predefined list of safe Lucide icons
const ICONS = ["Zap", "Shield", "Code2", "Users", "Globe", "Rocket", "Star", "Heart", "Briefcase", "CheckCircle", "Target", "TrendingUp", "Award", "Lightbulb", "Monitor"];

export interface AboutValue {
    id: string;
    title: string;
    description: string;
    icon: string | null;
    order: number;
}

export function ValuesManager({ initialValues }: { initialValues: AboutValue[] }) {
    const [values] = useState<AboutValue[]>(initialValues);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    
    // Form state for editing/creating
    const [form, setForm] = useState({ title: "", description: "", icon: "Zap", order: "0" });
    const [isCreating, setIsCreating] = useState(false);

    const handleCreate = async () => {
        if (!form.title || !form.description) return toast.error("Title and Description Required");
        
        setLoading(true);
        const formData = new FormData();
        formData.append("title", form.title);
        formData.append("description", form.description);
        formData.append("icon", form.icon);
        formData.append("order", form.order);
        
        const res = await createAboutValue({ message: "", success: false }, formData);
        setLoading(false);
        
        if (res.success) {
            toast.success("Created successfully");
            setIsCreating(false);
            setForm({ title: "", description: "", icon: "Zap", order: "0" });
            // Ideally we'd refresh data here, but page will revalidate on reload.
            // In a more complex setup, we'd use useTransition and useRouter().refresh()
            window.location.reload(); 
        } else {
            toast.error(res.message);
        }
    };

    const handleUpdate = async (id: string) => {
        if (!form.title || !form.description) return toast.error("Title and Description Required");
        
        setLoading(true);
        const formData = new FormData();
        formData.append("id", id);
        formData.append("title", form.title);
        formData.append("description", form.description);
        formData.append("icon", form.icon);
        formData.append("order", form.order);
        
        const res = await updateAboutValue({ message: "", success: false }, formData);
        setLoading(false);
        
        if (res.success) {
            toast.success("Updated successfully");
            setEditingId(null);
            window.location.reload();
        } else {
            toast.error(res.message);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Delete this value?")) return;
        setLoading(true);
        await deleteAboutValue(id);
        toast.success("Deleted!");
        window.location.reload();
    };

    const startEdit = (v: AboutValue) => {
        setForm({ title: v.title, description: v.description, icon: v.icon || "Zap", order: String(v.order || 0) });
        setEditingId(v.id);
        setIsCreating(false);
    };

    const startCreate = () => {
        setForm({ title: "", description: "", icon: "Zap", order: "0" });
        setIsCreating(true);
        setEditingId(null);
    };

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between mt-8 mb-4">
                <h3 className="text-xl font-bold">Mission & Values Grid Cards</h3>
                {!isCreating && !editingId && (
                    <Button onClick={startCreate} size="sm">
                        <Plus className="h-4 w-4 mr-2" /> Add Card
                    </Button>
                )}
            </div>

            {/* Editor Inline Form */}
            {(isCreating || editingId) && (
                <Card className="border-primary/50 bg-primary/5 mb-6">
                    <CardContent className="pt-6 space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Title / Headline</Label>
                                <Input 
                                    value={form.title} 
                                    onChange={e => setForm({...form, title: e.target.value})} 
                                    className="bg-black/40 border-white/20"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Icon</Label>
                                <select 
                                    value={form.icon} 
                                    onChange={e => setForm({...form, icon: e.target.value})}
                                    className="flex h-10 w-full rounded-md border border-white/20 bg-black/40 px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                    {ICONS.map(i => <option key={i} value={i}>{i}</option>)}
                                </select>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label>Description</Label>
                            <Textarea 
                                value={form.description} 
                                onChange={e => setForm({...form, description: e.target.value})} 
                                className="bg-black/40 border-white/20 h-24"
                            />
                        </div>

                        <div className="flex gap-2 justify-end pt-2">
                            <Button variant="ghost" onClick={() => { setIsCreating(false); setEditingId(null); }} disabled={loading}>
                                <X className="h-4 w-4 mr-2" /> Cancel
                            </Button>
                            <Button onClick={() => editingId ? handleUpdate(editingId) : handleCreate()} disabled={loading} className="bg-primary text-black">
                                <Check className="h-4 w-4 mr-2" /> Save Form
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* List */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {values.length === 0 && !isCreating && (
                    <p className="text-muted-foreground text-sm italic col-span-full">No values defined. Add one to show the Bento Grid on the About page.</p>
                )}
                {values.map((v) => (
                    <div key={v.id} className="p-5 rounded-[1rem] bg-[#121212] border border-[#262626] relative group">
                        <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity flex gap-2">
                            <button onClick={() => startEdit(v)} className="p-1.5 bg-blue-500/10 text-blue-400 rounded-md hover:bg-blue-500/20">
                                <Pencil className="h-4 w-4" />
                            </button>
                            <button onClick={() => handleDelete(v.id)} className="p-1.5 bg-red-500/10 text-red-500 rounded-md hover:bg-red-500/20">
                                <Trash2 className="h-4 w-4" />
                            </button>
                        </div>
                        
                        <div className="h-10 w-10 bg-primary/10 text-primary rounded-xl flex items-center justify-center mb-4">
                            {/* We just show the name since we don't have dynamic Lucide mapping imported on client side simply. */}
                            <span className="text-[10px] font-bold break-all px-1 leading-tight text-center">{v.icon}</span>
                        </div>
                        <h4 className="font-bold text-white mb-2">{v.title}</h4>
                        <p className="text-sm text-[#A3A3A3] line-clamp-3">{v.description}</p>
                    </div>
                ))}
            </div>
        </div>
    );
}
