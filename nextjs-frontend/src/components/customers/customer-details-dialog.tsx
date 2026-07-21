'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { Loader2, User, Building, Crown, Mail, Phone, MapPin, Calendar, CreditCard, Shield, Users } from 'lucide-react';
import { Customer, api } from '@/lib/api';
import logger from '@/lib/logger';

interface CustomerDetailsDialogProps {
  customer: Customer | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCommentAdded?: () => void;
}

const CustomerTypeBadge = ({ type }: { type: string }) => {
  const variants: { [key: string]: { variant: "default" | "secondary" | "destructive" | "outline", label: string, icon: any } } = {
    B2C: { variant: "outline", label: "Wholesale", icon: Building },
    B2B: { variant: "secondary", label: "Wholesale", icon: Building },
    ENTERPRISE_1: { variant: "default", label: "Enterprise", icon: Crown },
    ENTERPRISE_2: { variant: "default", label: "Enterprise", icon: Crown },
  };

  const config = variants[type] || { variant: "outline", label: type, icon: User };
  const Icon = config.icon;

  return (
    <Badge variant={config.variant} className="flex items-center gap-1">
      <Icon className="h-3 w-3" />
      {config.label}
    </Badge>
  );
};

const StatusBadge = ({ isApproved, approvalStatus }: { isApproved: boolean; approvalStatus?: 'PENDING' | 'APPROVED' | 'DEACTIVATED' }) => {
  const status = approvalStatus || (isApproved ? 'APPROVED' : 'PENDING');
  const map: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
    PENDING: { label: 'Pending', variant: 'secondary' },
    APPROVED: { label: 'Approved', variant: 'default' },
    DEACTIVATED: { label: 'Deactivated', variant: 'destructive' },
  };
  const cfg = map[status] || map.PENDING;
  return <Badge variant={cfg.variant}>{cfg.label}</Badge>;
};

export function CustomerDetailsDialog({ customer, open, onOpenChange }: CustomerDetailsDialogProps) {
  const [fullCustomer, setFullCustomer] = useState<Customer | null>(null);
  const [loading, setLoading] = useState(false);
  const [salesRepUsers, setSalesRepUsers] = useState<Record<string, { firstName: string; lastName: string; email: string }>>({});

  useEffect(() => {
    if (customer && open) {
      setLoading(true);
      api.getCustomer(customer.id)
        .then(response => {
          if (response.success) {
            setFullCustomer(response.data || null);
            // Fetch sales rep user details if there are assignments
            if (response.data?.salesAssignments && response.data.salesAssignments.length > 0) {
              const repIds = response.data.salesAssignments.map(a => a.salesRepId);
              // Fetch sales rep details for each sales rep
              Promise.all(repIds.map(repId => api.getSalesRep(repId)))
                .then(responses => {
                  const users: Record<string, { firstName: string; lastName: string; email: string }> = {};
                  responses.forEach((resp, idx) => {
                    if (resp.success && resp.data?.user) {
                      users[repIds[idx]] = {
                        firstName: resp.data.user.firstName,
                        lastName: resp.data.user.lastName,
                        email: resp.data.user.email
                      };
                    }
                  });
                  setSalesRepUsers(users);
                })
                .catch(error => {
                  logger.error('Error fetching sales rep details:', { error: error });
                });
            }
          }
        })
        .catch(error => {
          logger.error('Error fetching customer details:', { error: error });
        })
        .finally(() => {
          setLoading(false);
        });
    }
  }, [customer, open]);

  const getInitials = (firstName: string, lastName: string) => {
    return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
  };

  if (!customer) return null;

  const displayName = [fullCustomer?.firstName ?? customer.firstName, fullCustomer?.lastName ?? customer.lastName]
    .filter(Boolean)
    .join(' ');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] sm:max-w-2xl md:max-w-4xl lg:max-w-5xl xl:max-w-6xl max-h-[90vh] overflow-y-auto w-full p-0 rounded-2xl overflow-hidden border-gray-200">
        <div className="bg-[#043061] px-6 py-5 relative overflow-hidden flex-shrink-0">
          <div className="absolute -top-8 -right-8 w-28 h-28 bg-[#5A9ADA]/25 rounded-full blur-2xl pointer-events-none" />
          <div className="absolute -bottom-6 -left-6 w-20 h-20 bg-white/5 rounded-full pointer-events-none" />
          <div className="flex items-center gap-3 relative z-10">
            <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center flex-shrink-0">
              <User className="h-5 w-5 text-white" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold text-white">Customer Details</DialogTitle>
              <p className="text-xs text-white/50 mt-0.5">View full customer profile and information</p>
            </div>
          </div>
        </div>

        <div className="p-4 sm:p-6 md:p-8">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin" />
            <span className="ml-2">Loading customer details...</span>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Personal Information */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5" />
                  Personal Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">First Name</label>
                    <p className="text-sm break-words">{fullCustomer?.firstName || customer.firstName}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Last Name</label>
                    <p className="text-sm break-words">{fullCustomer?.lastName || customer.lastName}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Customer ID</label>
                    <p className="text-sm font-mono break-words">{customer.id}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Contact Information */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Mail className="h-5 w-5" />
                  Contact Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Email Address</label>
                    <p className="text-sm break-words">{fullCustomer?.email || customer.email}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Mobile Number</label>
                    <p className="text-sm break-words">{fullCustomer?.mobile || customer.mobile || '-'}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Phone Number</label>
                    <p className="text-sm break-words">
                      {fullCustomer?.addresses?.find(addr => addr.phone)?.phone ||
                        fullCustomer?.mobile ||
                        customer.mobile ||
                        '-'}
                    </p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Company</label>
                    <p className="text-sm break-words">
                      {fullCustomer?.companyName || customer.companyName || '-'}
                    </p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">NPI / License Number</label>
                    <p className="text-sm break-words">
                      {fullCustomer?.licenseNumber || customer.licenseNumber || '-'}
                    </p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">City</label>
                    <p className="text-sm break-words">
                      {fullCustomer?.city || customer.city || '-'}
                    </p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">ZIP Code</label>
                    <p className="text-sm break-words">
                      {fullCustomer?.zip || customer.zip || '-'}
                    </p>
                  </div>
                  <div className="md:col-span-2">
                    <label className="text-sm font-medium text-muted-foreground">SMS Enrollment</label>
                    <p className="text-sm break-words">
                      Account texts: <span className="font-medium">{(fullCustomer?.smsTransactionalConsent ?? (customer as any).smsTransactionalConsent) ? 'Enrolled' : 'Not enrolled'}</span>
                      {' · '}Marketing texts: <span className="font-medium">{(fullCustomer?.smsMarketingConsent ?? (customer as any).smsMarketingConsent) ? 'Enrolled' : 'Not enrolled'}</span>
                    </p>
                    {(fullCustomer?.smsConsentAt) && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Consent recorded {new Date(fullCustomer.smsConsentAt).toLocaleDateString()}{fullCustomer?.smsConsentSource ? ` · via ${fullCustomer.smsConsentSource}` : ''}
                      </p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Sales Rep Information */}
            {fullCustomer?.salesAssignments && fullCustomer.salesAssignments.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-[#10b981]">
                    <Users className="h-5 w-5" />
                    Assigned Sales Representative
                  </CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {fullCustomer.salesAssignments.map((assignment, index) => {
                    const repUser = salesRepUsers[assignment.salesRepId];
                    const repName = repUser ? `${repUser.firstName} ${repUser.lastName}` : 'Secondary Representative';
                    return (
                      <div key={assignment.id} className="relative overflow-hidden group bg-muted/20 hover:bg-muted/30 transition-colors p-5 rounded-[1.5rem] border border-border/50">
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex flex-col">
                            <span className="text-sm font-bold text-foreground">{repName}</span>
                            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Sales Rep</span>
                          </div>
                          <div className="p-2 rounded-xl bg-background border border-border/50">
                            <Shield className="w-4 h-4 text-[#10b981]" />
                          </div>
                        </div>
                        <Separator className="mb-4 bg-border/40" />
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <p className="text-[10px] font-bold text-muted-foreground/60 uppercase mb-1">Contact Email</p>
                            <p className="text-xs font-semibold truncate">{repUser?.email || '-'}</p>
                          </div>
                          <div>
                            <p className="text-[10px] font-bold text-muted-foreground/60 uppercase mb-1">System ID</p>
                            <p className="text-[10px] font-mono opacity-50 truncate">{assignment.salesRepId}</p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            )}

            {/* Sales Manager Information */}
            {fullCustomer?.salesManagerAssignments && fullCustomer.salesManagerAssignments.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-primary">
                    <Crown className="h-5 w-5" />
                    Account Manager (Senior Leadership)
                  </CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {fullCustomer.salesManagerAssignments.map((assignment: any) => {
                    const manager = assignment.salesManager;
                    const managerName = manager?.user ? `${manager.user.firstName} ${manager.user.lastName}` : 'Unrecognized Manager';
                    return (
                      <div key={assignment.id} className="relative overflow-hidden group bg-primary/[0.03] hover:bg-primary/[0.05] transition-colors p-5 rounded-[1.5rem] border border-primary/20">
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex flex-col">
                            <span className="text-sm font-bold text-foreground">{managerName}</span>
                            <span className="text-[10px] font-black text-primary uppercase tracking-widest">Sales Manager</span>
                          </div>
                          <div className="p-2 rounded-xl bg-background border border-primary/20 shadow-sm">
                            <Crown className="w-4 h-4 text-primary" />
                          </div>
                        </div>
                        <Separator className="mb-4 bg-primary/10" />
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <p className="text-[10px] font-bold text-muted-foreground/60 uppercase mb-1">Operations Email</p>
                            <p className="text-xs font-bold truncate text-primary/80">{manager?.user?.email || '-'}</p>
                          </div>
                          <div>
                            <p className="text-[10px] font-bold text-muted-foreground/60 uppercase mb-1">Assignment Date</p>
                            <p className="text-xs font-semibold">{new Date(assignment.assignedAt).toLocaleDateString()}</p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            )}

            {/* Customer Information */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building className="h-5 w-5" />
                  Customer Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Customer Type</label>
                    <div className="mt-1">
                      <CustomerTypeBadge type={fullCustomer?.customerType || customer.customerType} />
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Status</label>
                    <div className="mt-1">
                      <StatusBadge
                        isApproved={fullCustomer?.isApproved || customer.isApproved}
                        approvalStatus={fullCustomer?.approvalStatus as any || customer.approvalStatus as any}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Total Orders</label>
                    <p className="text-sm font-semibold text-blue-600">{fullCustomer?._count?.orders || customer._count?.orders || 0}</p>
                  </div>
                  <div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Address Information */}
            {fullCustomer?.addresses && fullCustomer.addresses.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <MapPin className="h-5 w-5" />
                    Address Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                    {fullCustomer.addresses.map((address, index) => (
                      <div key={address.id} className="border rounded-lg p-4 overflow-hidden">
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="font-medium">{address.type}</h4>
                          {address.isDefault && (
                            <Badge variant="outline" className="text-xs">Default</Badge>
                          )}
                        </div>
                        <div className="space-y-1.5 text-sm">
                          <div className="flex items-start">
                            <span className="text-muted-foreground w-20 sm:w-24 shrink-0 font-medium text-xs sm:text-sm">Name:</span>
                            <span className="font-semibold text-xs sm:text-sm min-w-0 break-words">{address.firstName} {address.lastName}</span>
                          </div>
                          {address.company && (
                            <div className="flex items-start">
                              <span className="text-muted-foreground w-20 sm:w-24 shrink-0 font-medium text-xs sm:text-sm">Company:</span>
                              <span className="font-medium text-blue-800 text-xs sm:text-sm min-w-0 break-words">{address.company}</span>
                            </div>
                          )}
                          <div className="flex items-start">
                            <span className="text-muted-foreground w-20 sm:w-24 shrink-0 font-medium text-xs sm:text-sm">Address 1:</span>
                            <span className="text-xs sm:text-sm min-w-0 break-words">{address.address1}</span>
                          </div>
                          {address.address2 && (
                            <div className="flex items-start">
                              <span className="text-muted-foreground w-20 sm:w-24 shrink-0 font-medium text-xs sm:text-sm">Address 2:</span>
                              <span className="text-xs sm:text-sm min-w-0 break-words">{address.address2}</span>
                            </div>
                          )}
                          <div className="flex items-start">
                            <span className="text-muted-foreground w-20 sm:w-24 shrink-0 font-medium text-xs sm:text-sm">Location:</span>
                            <div className="text-xs sm:text-sm min-w-0 break-words">{address.city}, {address.state} {address.postalCode}</div>
                          </div>
                          <div className="flex items-start">
                            <span className="text-muted-foreground w-20 sm:w-24 shrink-0 font-medium text-xs sm:text-sm">Country:</span>
                            <div className="text-xs sm:text-sm min-w-0 break-words">{address.country}</div>
                          </div>
                          {address.phone && (
                            <div className="flex items-start pb-1">
                              <span className="text-muted-foreground w-20 sm:w-24 shrink-0 font-medium text-xs sm:text-sm">Phone:</span>
                              <div className="text-gray-600 text-xs sm:text-sm">📞 {address.phone}</div>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Account Information */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  Account Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Account Status</label>
                    <p className="text-sm">{fullCustomer?.isActive ? 'Active' : 'Inactive'}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Email Verified</label>
                    <p className="text-sm">{fullCustomer?.emailVerified ? 'Yes' : 'No'}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Created Date</label>
                    <p className="text-sm">{new Date(fullCustomer?.createdAt || customer.createdAt).toLocaleDateString()}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Last Updated</label>
                    <p className="text-sm">{new Date(fullCustomer?.updatedAt || customer.updatedAt).toLocaleDateString()}</p>
                  </div>
                </div>
              </CardContent>
            </Card>


          </div>
        )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
