"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Collection } from "@/lib/api";

interface UpdateCollectionData {
    name?: string;
    description?: string;
    isActive?: boolean;
    sortOrder?: number;
}

interface EditCollectionDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    collection: Collection;
    onSubmit: (data: UpdateCollectionData) => void;
}

export function EditCollectionDialog({ open, onOpenChange, collection, onSubmit }: EditCollectionDialogProps) {
    const [formData, setFormData] = useState<UpdateCollectionData>({
        name: collection.name,
        description: collection.description || "",
        isActive: collection.isActive,
        sortOrder: collection.sortOrder
    });

    useEffect(() => {
        setFormData({
            name: collection.name,
            description: collection.description || "",
            isActive: collection.isActive,
            sortOrder: collection.sortOrder
        });
    }, [collection]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        onSubmit(formData);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px]">
                <form onSubmit={handleSubmit}>
                    <DialogHeader>
                        <DialogTitle>Edit Collection</DialogTitle>
                        <DialogDescription>
                            Update collection details and settings
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
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
                                value={formData.sortOrder}
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
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                            Cancel
                        </Button>
                        <Button type="submit">Update Collection</Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
} 