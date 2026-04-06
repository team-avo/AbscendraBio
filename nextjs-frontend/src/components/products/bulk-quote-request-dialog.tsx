"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CheckCircle, Loader2 } from "lucide-react";
import { api, CreateBulkQuoteRequest } from "@/lib/api";
import { toast } from "sonner";
import logger from '@/lib/logger';

interface BulkQuoteRequestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  productId: string;
  customerId: string;
  productName: string;
}

export function BulkQuoteRequestDialog({
  open,
  onOpenChange,
  productId,
  customerId,
  productName,
}: BulkQuoteRequestDialogProps) {
  const [quantity, setQuantity] = useState("");
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!quantity || parseInt(quantity) < 1) {
      toast.error("Please enter a valid quantity");
      return;
    }

    setIsSubmitting(true);

    try {
      const requestData: CreateBulkQuoteRequest = {
        productId,
        customerId,
        quantity: parseInt(quantity),
        notes: notes.trim() || undefined,
      };

      const response = await api.createBulkQuote(requestData);
      logger.info("Bulk quote response:", { data: response });

      // Check if the response is successful (either has success: true, data, or is the bulk quote object itself)
      if (response.success || response.data || (response as any).productId) {
        setIsSuccess(true);
        toast.success("Bulk quote request submitted successfully!");
        
        // Reset form after a delay
        setTimeout(() => {
          setIsSuccess(false);
          setQuantity("");
          setNotes("");
          onOpenChange(false);
        }, 3000);
      } else {
        toast.error(response.error || "Failed to submit bulk quote request");
      }
    } catch (error) {
      logger.error("Error submitting bulk quote request:", { error: error });
      toast.error("Failed to submit bulk quote request");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      setIsSuccess(false);
      setQuantity("");
      setNotes("");
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Request Bulk Quote</DialogTitle>
          <DialogDescription>
            Request a bulk quote for <strong className="text-black">{productName}</strong>
          </DialogDescription>
        </DialogHeader>

        {isSuccess ? (
          <div className="flex flex-col items-center justify-center py-8 space-y-4">
            <CheckCircle className="h-16 w-16 text-green-500" />
            <div className="text-center space-y-2">
              <h3 className="text-lg font-semibold text-green-700">
                Request Submitted Successfully!
              </h3>
              <p className="text-sm text-muted-foreground">
                Your request has been sent. Our sales representative will get in touch with you.
              </p>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="quantity">Number of pieces</Label>
              <Input
                id="quantity"
                type="number"
                min="1"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder="Enter quantity"
                required
                disabled={isSubmitting}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Additional Notes (Optional)</Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Any specific requirements or questions..."
                rows={3}
                disabled={isSubmitting}
              />
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={handleClose}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Submit Request
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
