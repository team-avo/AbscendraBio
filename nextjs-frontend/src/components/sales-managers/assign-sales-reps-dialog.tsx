'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import logger from '@/lib/logger';

interface SalesRep {
  id: string;
  user: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    isActive: boolean;
  };
}

interface SalesManager {
  id: string;
  user: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    role: string;
    isActive: boolean;
  };
  salesReps: SalesRep[];
}

interface AssignSalesRepsDialogProps {
  manager: SalesManager | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function AssignSalesRepsDialog({ manager, open, onOpenChange, onSuccess }: AssignSalesRepsDialogProps) {
  const [allReps, setAllReps] = useState<SalesRep[]>([]);
  const [selectedRepIds, setSelectedRepIds] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingReps, setIsLoadingReps] = useState(false);

  useEffect(() => {
    if (open && manager) {
      fetchAvailableReps();
      // Set initially selected reps
      setSelectedRepIds(manager.salesReps.map(rep => rep.id));
    }
  }, [open, manager]);

  const fetchAvailableReps = async () => {
    try {
      setIsLoadingReps(true);
      const response = await api.get('/sales-reps');
      
      if (response.success && response.data) {
        setAllReps(response.data);
      }
    } catch (error) {
      logger.error('Failed to fetch sales reps:', { error: error });
      toast.error('Failed to load sales representatives');
    } finally {
      setIsLoadingReps(false);
    }
  };

  const handleToggleRep = (repId: string) => {
    setSelectedRepIds(prev =>
      prev.includes(repId)
        ? prev.filter(id => id !== repId)
        : [...prev, repId]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!manager) return;

    setIsSubmitting(true);

    try {
      const response = await api.put(`/sales-managers/${manager.id}/sales-reps`, {
        salesRepIds: selectedRepIds,
      });

      if (response.success) {
        toast.success('Sales representatives assigned successfully');
        onSuccess();
      } else {
        toast.error(response.error || 'Failed to assign sales representatives');
      }
    } catch (error) {
      logger.error('Failed to assign sales representatives:', { error: error });
      toast.error('An unexpected error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!manager) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Assign Sales Representatives</DialogTitle>
          <DialogDescription>
            Select sales representatives to assign to {manager.user.firstName} {manager.user.lastName}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="border rounded-lg p-4 max-h-96 overflow-y-auto space-y-3">
            {isLoadingReps ? (
              <p className="text-center text-gray-500 py-4">Loading sales representatives...</p>
            ) : allReps.length === 0 ? (
              <p className="text-center text-gray-500 py-4">No sales representatives available</p>
            ) : (
              allReps.map((rep) => (
                <div key={rep.id} className="flex items-center space-x-3 p-2 hover:bg-gray-50 rounded">
                  <Checkbox
                    id={rep.id}
                    checked={selectedRepIds.includes(rep.id)}
                    onCheckedChange={() => handleToggleRep(rep.id)}
                  />
                  <Label htmlFor={rep.id} className="flex-1 cursor-pointer">
                    <div>
                      <p className="font-medium">{rep.user.firstName} {rep.user.lastName}</p>
                      <p className="text-sm text-gray-500">{rep.user.email}</p>
                    </div>
                  </Label>
                </div>
              ))
            )}
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
            <Button type="submit" disabled={isSubmitting || isLoadingReps}>
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Assigning...
                </>
              ) : (
                'Assign Representatives'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
