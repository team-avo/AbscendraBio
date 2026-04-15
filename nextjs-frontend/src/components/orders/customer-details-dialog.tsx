import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { format } from 'date-fns';
import { User, Mail, Phone, MapPin, Calendar, CreditCard, Package, Loader2 } from 'lucide-react';
import { api } from '@/lib/api';
import logger from '@/lib/logger';

interface CustomerDetailsDialogProps {
  customer: any;
  open: boolean;
  onClose: () => void;
}

export function CustomerDetailsDialog({ customer, open, onClose }: CustomerDetailsDialogProps) {
  const [fullCustomer, setFullCustomer] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open && customer?.id) {
      fetchFullCustomer();
    }
  }, [open, customer?.id]);

  const fetchFullCustomer = async () => {
    if (!customer?.id) return;

    setLoading(true);
    try {
      const response = await api.getCustomer(customer.id);
      if (response.success && response.data) {
        setFullCustomer(response.data);
      } else {
        setFullCustomer(customer); // Fallback to basic customer data
      }
    } catch (error) {
      logger.error('Error fetching customer details:', { error: error });
      setFullCustomer(customer); // Fallback to basic customer data
    } finally {
      setLoading(false);
    }
  };

  if (!customer) return null;

  const displayCustomer = fullCustomer || customer;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl w-[95vw] max-h-[95vh] overflow-hidden flex flex-col p-0 rounded-2xl overflow-hidden border-gray-200">
        <div className="bg-[#1B2D4F] px-6 py-5 relative overflow-hidden flex-shrink-0">
          <div className="absolute -top-8 -right-8 w-28 h-28 bg-[#3A6FA0]/25 rounded-full blur-2xl pointer-events-none" />
          <div className="absolute -bottom-6 -left-6 w-20 h-20 bg-white/5 rounded-full pointer-events-none" />
          <div className="flex items-center gap-3 relative z-10">
            <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center flex-shrink-0">
              <User className="h-5 w-5 text-white" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold text-white">Customer Details</DialogTitle>
              <p className="text-xs text-white/50 mt-0.5">Customer profile and contact information</p>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto space-y-6 p-6">
          {/* Customer Profile */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Customer Information</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin" />
                  <span className="ml-2 text-sm text-muted-foreground">Loading customer details...</span>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center space-x-4">
                    <Avatar className="h-16 w-16">
                      <AvatarImage src="" />
                      <AvatarFallback className="text-lg">
                        {displayCustomer.firstName?.[0]}{displayCustomer.lastName?.[0]}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-lg font-semibold break-words">
                        {displayCustomer.firstName} {displayCustomer.lastName}
                      </h3>
                      <p className="text-sm text-muted-foreground break-words">
                        {displayCustomer.email}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t">
                    <div className="flex items-center gap-2 min-w-0">
                      <Phone className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      <span className="text-sm break-words truncate">
                        {displayCustomer.mobile || displayCustomer.phone || displayCustomer.phoneNumber || displayCustomer.contactPhone || displayCustomer.primaryPhone || 'No phone number'}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      <span className="text-sm">
                        {displayCustomer.customerType === 'B2C' || displayCustomer.customerType === 'B2B' ? 'Wholesale' :
                          displayCustomer.customerType === 'ENTERPRISE_1' || displayCustomer.customerType === 'ENTERPRISE_2' ? 'Enterprise' :
                            displayCustomer.customerType || 'Wholesale'}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
}
