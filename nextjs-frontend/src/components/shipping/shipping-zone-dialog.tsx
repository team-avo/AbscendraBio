"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { X } from "lucide-react";
import { toast } from "sonner";
import { Country } from 'country-state-city';
import logger from '@/lib/logger';

interface ShippingZone {
  id: string;
  name: string;
  countries: string[];
  createdAt: string;
  updatedAt: string;
}

interface ShippingZoneDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  zone?: ShippingZone | null;
  onSubmit: (data: {
    name: string;
    countries: string[];
    rates?: {
      name: string;
      rate: number;
      estimatedDays?: string;
      freeShippingThreshold?: number;
    }[];
  }) => Promise<void>;
}

export function ShippingZoneDialog({ open, onOpenChange, zone, onSubmit }: ShippingZoneDialogProps) {
  const [name, setName] = useState("");
  const [selectedCountries, setSelectedCountries] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Rate fields
  const [rateName, setRateName] = useState("");
  const [rateAmount, setRateAmount] = useState("");
  const [estimatedDays, setEstimatedDays] = useState("");
  const [freeShippingThreshold, setFreeShippingThreshold] = useState("");

  // Get all countries from country-state-city package
  const allCountries = Country.getAllCountries();

  // Reset form when dialog opens/closes or zone changes
  useEffect(() => {
    if (open) {
      if (zone) {
        setName(zone.name);
        setSelectedCountries(zone.countries);
        // If editing, you might want to load existing rate data here
        setRateName("");
        setRateAmount("");
        setEstimatedDays("");
        setFreeShippingThreshold("");
      } else {
        setName("");
        setSelectedCountries([]);
        setRateName("");
        setRateAmount("");
        setEstimatedDays("");
        setFreeShippingThreshold("");
      }
    }
  }, [open, zone]);

  // Get available countries (not already selected)
  const availableCountries = allCountries.filter(country =>
    !selectedCountries.includes(country.isoCode)
  );

  const addCountry = (countryCode: string) => {
    if (countryCode && !selectedCountries.includes(countryCode)) {
      setSelectedCountries(prev => [...prev, countryCode]);
    }
  };

  const removeCountry = (countryCode: string) => {
    setSelectedCountries(prev => prev.filter(code => code !== countryCode));
  };

  const getCountryName = (code: string) => {
    return allCountries.find(country => country.isoCode === code)?.name || code;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      toast.error("Zone name is required");
      return;
    }

    if (selectedCountries.length === 0) {
      toast.error("At least one country must be selected");
      return;
    }

    // Validate rate fields if provided
    if (rateName.trim() && !rateAmount) {
      toast.error("Rate amount is required when rate name is provided");
      return;
    }

    if (rateAmount && parseFloat(rateAmount) < 0) {
      toast.error("Rate amount must be a positive number");
      return;
    }

    if (freeShippingThreshold && parseFloat(freeShippingThreshold) < 0) {
      toast.error("Free shipping threshold must be a positive number");
      return;
    }

    setIsSubmitting(true);
    try {
      const submitData: any = {
        name: name.trim(),
        countries: selectedCountries
      };

      // Add rate data if provided
      if (rateName.trim() && rateAmount) {
        submitData.rates = [{
          name: rateName.trim(),
          rate: parseFloat(rateAmount),
          estimatedDays: estimatedDays.trim() || undefined,
          freeShippingThreshold: freeShippingThreshold ? parseFloat(freeShippingThreshold) : undefined
        }];
      }

      await onSubmit(submitData);
      onOpenChange(false);
    } catch (error) {
      logger.error("Error submitting shipping zone:", { error: error });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {zone ? "Edit Shipping Zone" : "Create Shipping Zone"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="zone-name">Zone Name</Label>
            <Input
              id="zone-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., North America, Europe, Asia Pacific"
            />
          </div>

          <div className="space-y-3">
            <Label>Countries</Label>

            {/* Selected Countries */}
            {selectedCountries.length > 0 && (
              <div className="flex flex-wrap gap-2 p-3 bg-muted rounded-md border">
                {selectedCountries.map(countryCode => (
                  <Badge
                    key={countryCode}
                    variant="secondary"
                  >
                    {getCountryName(countryCode)}
                    <button
                      type="button"
                      onClick={() => removeCountry(countryCode)}
                      className="ml-2 hover:text-red-400"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}

            {/* Country Selection */}
            <div className="space-y-2">
              <Label>Add Country</Label>
              <Select onValueChange={addCountry}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a country to add" />
                </SelectTrigger>
                <SelectContent className="max-h-60">
                  {availableCountries.map((country) => (
                    <SelectItem
                      key={country.isoCode}
                      value={country.isoCode}
                    >
                      <div className="flex items-center gap-2">
                        <span>{country.flag}</span>
                        <span>{country.name}</span>
                        <span className="text-muted-foreground text-xs">({country.isoCode})</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Shipping Rate Section */}
          <div className="space-y-4 border-t pt-4">
            <div className="space-y-2">
              <Label className="text-base font-medium">Initial Shipping Rate (Optional)</Label>
              <p className="text-sm text-muted-foreground">Add a default shipping rate for this zone</p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="rate-name">Rate Name</Label>
                <Input
                  id="rate-name"
                  value={rateName}
                  onChange={(e) => setRateName(e.target.value)}
                  placeholder="e.g., Standard Shipping"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="rate-amount">Rate Amount ($)</Label>
                <Input
                  id="rate-amount"
                  type="number"
                  step="0.01"
                  min="0"
                  value={rateAmount}
                  onChange={(e) => setRateAmount(e.target.value)}
                  placeholder="0.00"
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="estimated-days">Estimated Delivery Days</Label>
                <Input
                  id="estimated-days"
                  value={estimatedDays}
                  onChange={(e) => setEstimatedDays(e.target.value)}
                  placeholder="e.g., 3-5, 1-2"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="free-shipping">Free Shipping Threshold ($)</Label>
                <Input
                  id="free-shipping"
                  type="number"
                  step="0.01"
                  min="0"
                  value={freeShippingThreshold}
                  onChange={(e) => setFreeShippingThreshold(e.target.value)}
                  placeholder="100.00"
                />
              </div>
            </div>
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
              {isSubmitting ? "Saving..." : zone ? "Update Zone" : "Create Zone"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
