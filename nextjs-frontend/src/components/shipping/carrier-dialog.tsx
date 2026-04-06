"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { X, Plus } from "lucide-react";
import { toast } from "sonner";
import logger from '@/lib/logger';

interface Carrier {
  id: string;
  name: string;
  code: string;
  apiKey?: string;
  apiSecret?: string;
  isActive: boolean;
  services: string[];
  trackingUrl?: string;
  createdAt: string;
  updatedAt: string;
}

interface CarrierDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  carrier?: Carrier | null;
  onSubmit: (data: {
    name: string;
    code: string;
    apiKey?: string;
    apiSecret?: string;
    services: string[];
    trackingUrl?: string;
    isActive: boolean;
  }) => Promise<void>;
}

// Common carrier services
const COMMON_SERVICES = [
  "Ground",
  "Express",
  "Overnight",
  "Next Day Air",
  "2nd Day Air",
  "Priority Mail",
  "Express Mail",
  "Standard",
  "Expedited",
  "International",
  "Same Day",
  "Economy",
];

export function CarrierDialog({ open, onOpenChange, carrier, onSubmit }: CarrierDialogProps) {
  const [formData, setFormData] = useState({
    name: "",
    code: "",
    apiKey: "",
    apiSecret: "",
    trackingUrl: "",
    isActive: true,
  });
  const [services, setServices] = useState<string[]>([]);
  const [newService, setNewService] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Reset form when dialog opens/closes or carrier changes
  useEffect(() => {
    if (open) {
      if (carrier) {
        setFormData({
          name: carrier.name,
          code: carrier.code,
          apiKey: carrier.apiKey || "",
          apiSecret: carrier.apiSecret || "",
          trackingUrl: carrier.trackingUrl || "",
          isActive: carrier.isActive,
        });
        setServices(carrier.services || []);
      } else {
        setFormData({
          name: "",
          code: "",
          apiKey: "",
          apiSecret: "",
          trackingUrl: "",
          isActive: true,
        });
        setServices([]);
      }
      setNewService("");
    }
  }, [open, carrier]);

  const handleInputChange = (field: string, value: string | boolean) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const addService = (serviceName: string) => {
    const trimmedService = serviceName.trim();
    if (trimmedService && !services.includes(trimmedService)) {
      setServices(prev => [...prev, trimmedService]);
      setNewService("");
    }
  };

  const removeService = (serviceName: string) => {
    setServices(prev => prev.filter(service => service !== serviceName));
  };

  const handleAddCustomService = () => {
    if (newService.trim()) {
      addService(newService);
    }
  };

  const validateForm = () => {
    if (!formData.name.trim()) {
      toast.error("Carrier name is required");
      return false;
    }
    if (!formData.code.trim()) {
      toast.error("Carrier code is required");
      return false;
    }
    if (formData.trackingUrl && !isValidUrl(formData.trackingUrl)) {
      toast.error("Please enter a valid tracking URL");
      return false;
    }
    return true;
  };

  const isValidUrl = (url: string) => {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);
    try {
      const submitData = {
        name: formData.name.trim(),
        code: formData.code.trim().toUpperCase(),
        apiKey: formData.apiKey.trim() || undefined,
        apiSecret: formData.apiSecret.trim() || undefined,
        services,
        trackingUrl: formData.trackingUrl.trim() || undefined,
        isActive: formData.isActive,
      };

      await onSubmit(submitData);
      onOpenChange(false);
    } catch (error) {
      logger.error("Error submitting carrier:", { error: error });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-foreground">
            {carrier ? "Edit Carrier" : "Add New Carrier"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="name" className="text-foreground">Carrier Name</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => handleInputChange("name", e.target.value)}
                placeholder="e.g., FedEx, UPS, USPS"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="code" className="text-foreground">Carrier Code</Label>
              <Input
                id="code"
                value={formData.code}
                onChange={(e) => handleInputChange("code", e.target.value.toUpperCase())}
                placeholder="e.g., FEDEX, UPS, USPS"
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="apiKey" className="text-foreground">API Key (optional)</Label>
              <Input
                id="apiKey"
                type="password"
                value={formData.apiKey}
                onChange={(e) => handleInputChange("apiKey", e.target.value)}
                placeholder="Enter API key"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="apiSecret" className="text-foreground">API Secret (optional)</Label>
              <Input
                id="apiSecret"
                type="password"
                value={formData.apiSecret}
                onChange={(e) => handleInputChange("apiSecret", e.target.value)}
                placeholder="Enter API secret"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="trackingUrl" className="text-foreground">Tracking URL Template (optional)</Label>
            <Input
              id="trackingUrl"
              value={formData.trackingUrl}
              onChange={(e) => handleInputChange("trackingUrl", e.target.value)}
              placeholder="e.g., https://fedex.com/track?id={trackingNumber}"
            />
            <p className="text-xs text-muted-foreground">
              Use {"{trackingNumber}"} as placeholder for the tracking number
            </p>
          </div>

          <div className="space-y-4">
            <Label className="text-foreground">Services</Label>
            
            {/* Selected Services */}
            {services.length > 0 && (
              <div className="space-y-2">
                <div className="text-sm text-foreground">Available Services:</div>
                <div className="flex flex-wrap gap-2">
                  {services.map(service => (
                    <Badge
                      key={service}
                      variant="secondary"
                    >
                      {service}
                      <button
                        type="button"
                        onClick={() => removeService(service)}
                        className="ml-2 hover:text-red-400"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Common Services */}
            <div className="space-y-2">
              <div className="text-sm text-foreground">Add Common Services:</div>
              <div className="flex flex-wrap gap-2">
                {COMMON_SERVICES.filter(service => !services.includes(service)).map(service => (
                  <Button
                    key={service}
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => addService(service)}
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    {service}
                  </Button>
                ))}
              </div>
            </div>

            {/* Custom Service */}
            <div className="space-y-2">
              <div className="text-sm text-foreground">Add Custom Service:</div>
              <div className="flex gap-2">
                <Input
                  value={newService}
                  onChange={(e) => setNewService(e.target.value)}
                  placeholder="Enter custom service name"
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddCustomService();
                    }
                  }}
                />
                <Button
                  type="button"
                  onClick={handleAddCustomService}
                  disabled={!newService.trim()}
                >
                  Add
                </Button>
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <Switch
              id="isActive"
              checked={formData.isActive}
              onCheckedChange={(checked) => handleInputChange("isActive", checked)}
            />
            <Label htmlFor="isActive" className="text-foreground">Active</Label>
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
            >
              {isSubmitting ? "Saving..." : carrier ? "Update Carrier" : "Add Carrier"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
