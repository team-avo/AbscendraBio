"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import logger from '@/lib/logger';

interface ShippingZone {
  id: string;
  name: string;
  countries: string[];
}

interface ShippingRate {
  id: string;
  zoneId: string;
  name: string;
  rate: number;
  minWeight?: number;
  maxWeight?: number;
  minPrice?: number;
  maxPrice?: number;
  freeShippingThreshold?: number;
  estimatedDays?: string;
  isActive: boolean;
  zone?: ShippingZone;
}

interface ShippingRateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rate?: ShippingRate | null;
  zones: ShippingZone[];
  onSubmit: (data: {
    zoneId: string;
    name: string;
    rate: number;
    minWeight?: number;
    maxWeight?: number;
    minPrice?: number;
    maxPrice?: number;
    freeShippingThreshold?: number;
    estimatedDays?: string;
    isActive: boolean;
  }) => Promise<void>;
}

export function ShippingRateDialog({ open, onOpenChange, rate, zones, onSubmit }: ShippingRateDialogProps) {
  const [formData, setFormData] = useState({
    zoneId: "",
    name: "",
    rate: "",
    minWeight: "",
    maxWeight: "",
    minPrice: "",
    maxPrice: "",
    freeShippingThreshold: "",
    estimatedDays: "",
    isActive: true,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Reset form when dialog opens/closes or rate changes
  useEffect(() => {
    if (open) {
      if (rate) {
        setFormData({
          zoneId: rate.zoneId,
          name: rate.name,
          rate: rate.rate.toString(),
          minWeight: rate.minWeight?.toString() || "",
          maxWeight: rate.maxWeight?.toString() || "",
          minPrice: rate.minPrice?.toString() || "",
          maxPrice: rate.maxPrice?.toString() || "",
          freeShippingThreshold: rate.freeShippingThreshold?.toString() || "",
          estimatedDays: rate.estimatedDays || "",
          isActive: rate.isActive,
        });
      } else {
        setFormData({
          zoneId: "",
          name: "",
          rate: "",
          minWeight: "",
          maxWeight: "",
          minPrice: "",
          maxPrice: "",
          freeShippingThreshold: "",
          estimatedDays: "",
          isActive: true,
        });
      }
    }
  }, [open, rate]);

  const handleInputChange = (field: string, value: string | boolean) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const validateForm = () => {
    if (!formData.zoneId) {
      toast.error("Please select a shipping zone");
      return false;
    }
    if (!formData.name.trim()) {
      toast.error("Rate name is required");
      return false;
    }
    if (!formData.rate || parseFloat(formData.rate) < 0) {
      toast.error("Please enter a valid rate");
      return false;
    }
    
    // Validate weight range
    if (formData.minWeight && formData.maxWeight) {
      const minWeight = parseFloat(formData.minWeight);
      const maxWeight = parseFloat(formData.maxWeight);
      if (minWeight >= maxWeight) {
        toast.error("Maximum weight must be greater than minimum weight");
        return false;
      }
    }

    // Validate price range
    if (formData.minPrice && formData.maxPrice) {
      const minPrice = parseFloat(formData.minPrice);
      const maxPrice = parseFloat(formData.maxPrice);
      if (minPrice >= maxPrice) {
        toast.error("Maximum price must be greater than minimum price");
        return false;
      }
    }

    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);
    try {
      const submitData = {
        zoneId: formData.zoneId,
        name: formData.name.trim(),
        rate: parseFloat(formData.rate),
        minWeight: formData.minWeight ? parseFloat(formData.minWeight) : undefined,
        maxWeight: formData.maxWeight ? parseFloat(formData.maxWeight) : undefined,
        minPrice: formData.minPrice ? parseFloat(formData.minPrice) : undefined,
        maxPrice: formData.maxPrice ? parseFloat(formData.maxPrice) : undefined,
        freeShippingThreshold: formData.freeShippingThreshold ? parseFloat(formData.freeShippingThreshold) : undefined,
        estimatedDays: formData.estimatedDays || undefined,
        isActive: formData.isActive,
      };

      await onSubmit(submitData);
      onOpenChange(false);
    } catch (error) {
      logger.error("Error submitting shipping rate:", { error: error });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {rate ? "Edit Shipping Rate" : "Create Shipping Rate"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="zone">Shipping Zone</Label>
              <Select
                value={formData.zoneId}
                onValueChange={(value) => handleInputChange("zoneId", value)}
                disabled={!!rate} // Don't allow changing zone for existing rates
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a zone" />
                </SelectTrigger>
                <SelectContent>
                  {zones.map((zone) => (
                    <SelectItem key={zone.id} value={zone.id}>
                      {zone.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="name">Rate Name</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => handleInputChange("name", e.target.value)}
                placeholder="e.g., Standard Shipping, Express"
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="rate">Rate ($)</Label>
              <Input
                id="rate"
                type="number"
                step="0.01"
                min="0"
                value={formData.rate}
                onChange={(e) => handleInputChange("rate", e.target.value)}
                placeholder="0.00"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="estimatedDays">Estimated Days</Label>
              <Input
                id="estimatedDays"
                value={formData.estimatedDays}
                onChange={(e) => handleInputChange("estimatedDays", e.target.value)}
                placeholder="e.g., 3-5, 1-2"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="freeShippingThreshold">Free Shipping Threshold ($)</Label>
              <Input
                id="freeShippingThreshold"
                type="number"
                step="0.01"
                min="0"
                value={formData.freeShippingThreshold}
                onChange={(e) => handleInputChange("freeShippingThreshold", e.target.value)}
                placeholder="100.00"
              />
            </div>
          </div>

          <div className="space-y-4">
            <Label>Weight Range (optional)</Label>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="minWeight">Min Weight (lbs)</Label>
                <Input
                  id="minWeight"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.minWeight}
                  onChange={(e) => handleInputChange("minWeight", e.target.value)}
                  placeholder="0.00"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="maxWeight">Max Weight (lbs)</Label>
                <Input
                  id="maxWeight"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.maxWeight}
                  onChange={(e) => handleInputChange("maxWeight", e.target.value)}
                  placeholder="50.00"
                />
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <Label>Price Range (optional)</Label>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="minPrice">Min Order Value ($)</Label>
                <Input
                  id="minPrice"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.minPrice}
                  onChange={(e) => handleInputChange("minPrice", e.target.value)}
                  placeholder="0.00"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="maxPrice">Max Order Value ($)</Label>
                <Input
                  id="maxPrice"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.maxPrice}
                  onChange={(e) => handleInputChange("maxPrice", e.target.value)}
                  placeholder="1000.00"
                />
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <Switch
              id="isActive"
              checked={formData.isActive}
              onCheckedChange={(checked) => handleInputChange("isActive", checked)}
            />
            <Label htmlFor="isActive">Active</Label>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="bg-white text-black hover:bg-gray-200"
            >
              {isSubmitting ? "Saving..." : rate ? "Update Rate" : "Create Rate"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
