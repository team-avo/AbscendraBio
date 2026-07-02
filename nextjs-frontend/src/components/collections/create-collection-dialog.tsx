"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tag } from "lucide-react";

interface CreateCollectionData {
    name: string;
    description: string;
    isActive: boolean;
    sortOrder?: number;
}

interface CreateCollectionDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSubmit: (data: CreateCollectionData) => void;
}

export function CreateCollectionDialog({ open, onOpenChange, onSubmit }: CreateCollectionDialogProps) {
    const [formData, setFormData] = useState<CreateCollectionData>({
        name: "",
        description: "",
        isActive: true
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        onSubmit(formData);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px] p-0 rounded-2xl overflow-hidden border-gray-200">
                <form onSubmit={handleSubmit}>
                    <div className="bg-[#043061] px-6 py-5 relative overflow-hidden flex-shrink-0">
                        <div className="absolute -top-8 -right-8 w-28 h-28 bg-[#5A9ADA]/25 rounded-full blur-2xl pointer-events-none" />
                        <div className="absolute -bottom-6 -left-6 w-20 h-20 bg-white/5 rounded-full pointer-events-none" />
                        <div className="flex items-center gap-3 relative z-10">
                            <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center flex-shrink-0">
                                <Tag className="h-5 w-5 text-white" />
                            </div>
                            <div>
                                <DialogTitle className="text-base font-bold text-white">Create Collection</DialogTitle>
                                <p className="text-xs text-white/50 mt-0.5">Group related products together</p>
                            </div>
                        </div>
                    </div>
                    <div className="grid gap-4 p-6">
                        <div className="grid gap-2">
                            <Label htmlFor="name">Name</Label>
                            <Input
                                id="name"
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                placeholder="Enter collection name"
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="description">Description</Label>
                            <Textarea
                                id="description"
                                value={formData.description}
                                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                placeholder="Enter collection description"
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="sortOrder">Sort Order</Label>
                            <Input
                                id="sortOrder"
                                type="number"
                                min={0}
                                value={formData.sortOrder || 0}
                                onChange={(e) => setFormData({ ...formData, sortOrder: parseInt(e.target.value) || 0 })}
                            />
                        </div>
                        <div className="flex items-center gap-2">
                            <Switch
                                id="isActive"
                                checked={formData.isActive}
                                onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
                            />
                            <Label htmlFor="isActive">Active</Label>
                        </div>
                    </div>
                    <DialogFooter className="px-6 pb-6">
                        <Button type="button" variant="outline" className="rounded-xl" onClick={() => onOpenChange(false)}>
                            Cancel
                        </Button>
                        <Button type="submit" className="bg-[#043061] hover:bg-[#0b4f96] text-white rounded-xl">Create Collection</Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
} 