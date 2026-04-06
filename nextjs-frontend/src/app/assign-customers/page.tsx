'use client';

import { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/dashboard/dashboard-layout';
import { ProtectedRoute } from '@/contexts/auth-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Search, UserPlus, CheckCircle, Users, Building } from 'lucide-react';
import { api } from '@/lib/api';
import logger from '@/lib/logger';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/auth-context';

interface UnassignedCustomer {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  customerType: string;
  isActive: boolean;
  isApproved: boolean;
  createdAt: string;
  salesAssignments?: Array<{
    salesRep: {
      user: {
        firstName: string;
        lastName: string;
      }
    }
  }>;
  salesManagerAssignments?: Array<{
    salesManager: {
      user: {
        firstName: string;
        lastName: string;
      }
    }
  }>;
}

export default function AssignCustomersPage() {
  const { user } = useAuth();
  const [customers, setCustomers] = useState<UnassignedCustomer[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [assigningId, setAssigningId] = useState<string | null>(null);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, pages: 1 });

  const fetchCustomers = async () => {
    try {
      setLoading(true);
      const response = await api.getUnassignedCustomers({
        search: searchTerm || undefined,
        page: pagination.page,
        limit: pagination.limit
      }) as any;

      if (response.success && response.data) {
        if (response.pagination) {
          setCustomers(response.data);
          setPagination(response.pagination);
        } else {
          // Fallback for old API response structured as array
          setCustomers(response.data as any);
        }
      }
    } catch (error) {
      logger.error('Failed to fetch unassigned customers:', { error });
      toast.error('Failed to load unassigned customers');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user?.role === 'SALES_REP') {
      fetchCustomers();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchTerm, user, pagination.page]);

  // Debounce search to reset page
  useEffect(() => {
    setPagination(prev => ({ ...prev, page: 1 }));
  }, [searchTerm]);

  const handleAssign = async (customerId: string) => {
    try {
      setAssigningId(customerId);
      const response = await api.assignCustomerToSalesRep(customerId);

      if (response.success) {
        toast.success('Customer assigned successfully');
        fetchCustomers();
      } else {
        toast.error(response.error || 'Failed to assign customer');
      }
    } catch (error) {
      logger.error('Failed to assign customer:', { error });
      toast.error('Failed to assign customer');
    } finally {
      setAssigningId(null);
    }
  };

  const getCustomerTypeBadge = (type: string) => {
    const types: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive' }> = {
      'B2C': { label: 'Wholesale', variant: 'default' },
      'B2B': { label: 'Wholesale', variant: 'default' },
      'ENTERPRISE_1': { label: 'Enterprise', variant: 'outline' },
      'ENTERPRISE_2': { label: 'Enterprise', variant: 'outline' },
    };
    return types[type] || { label: type, variant: 'default' as const };
  };

  if (user?.role === 'SALES_REP') {
    return (
      <ProtectedRoute>
        <DashboardLayout>
          <div className="p-6">
            <Card>
              <CardContent className="flex items-center justify-center py-12">
                <p className="text-lg text-muted-foreground">You do not have permission to access this page.</p>
              </CardContent>
            </Card>
          </div>
        </DashboardLayout>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute>
      <DashboardLayout>
        <div className="p-6 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold">Assign Customers</h1>
              <p className="text-muted-foreground mt-1">
                Assign customers to yourself
              </p>
            </div>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Unassigned Customers
              </CardTitle>
              <CardDescription>
                These customers have not been assigned
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4 mb-6">
                <div className="relative flex-1 max-w-sm">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                  <Input
                    placeholder="Search by name or email..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <Badge variant="outline" className="text-sm">
                  {pagination.total} unassigned {pagination.total === 1 ? 'customer' : 'customers'}
                </Badge>
              </div>

              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="text-muted-foreground">Loading customers...</div>
                </div>
              ) : customers.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <Users className="h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No unassigned customers</h3>
                  <p className="text-muted-foreground">
                    {searchTerm ? 'Try adjusting your search terms' : 'All customers have been assigned'}
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="border rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Name</TableHead>
                          <TableHead>Email</TableHead>
                          <TableHead>Customer Type</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Assigned Rep</TableHead>
                          <TableHead>Sales Manager</TableHead>
                          <TableHead>Created</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {customers.map((customer) => (
                          <TableRow key={customer.id}>
                            <TableCell className="font-medium">
                              {customer.firstName} {customer.lastName}
                            </TableCell>
                            <TableCell>{customer.email}</TableCell>
                            <TableCell>
                              <Badge variant={getCustomerTypeBadge(customer.customerType).variant}>
                                {getCustomerTypeBadge(customer.customerType).label}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-col gap-1">
                                {/* <Badge variant={customer.isActive ? 'default' : 'secondary'}>
                                {customer.isActive ? 'Active' : 'Inactive'}
                              </Badge> */}
                                <Badge variant={customer.isApproved ? 'default' : 'outline'}>
                                  {customer.isApproved ? 'Approved' : 'Pending'}
                                </Badge>
                              </div>
                            </TableCell>
                            <TableCell>
                              {customer.salesAssignments && customer.salesAssignments.length > 0 ? (
                                <Badge variant="secondary">
                                  {customer.salesAssignments[0].salesRep.user.firstName} {customer.salesAssignments[0].salesRep.user.lastName}
                                </Badge>
                              ) : (
                                <span className="text-muted-foreground text-sm">-</span>
                              )}
                            </TableCell>
                            <TableCell>
                              {customer.salesManagerAssignments && customer.salesManagerAssignments.length > 0 ? (
                                <Badge variant="secondary" className="bg-blue-100 text-blue-800 hover:bg-blue-200">
                                  {customer.salesManagerAssignments[0].salesManager.user.firstName} {customer.salesManagerAssignments[0].salesManager.user.lastName}
                                </Badge>
                              ) : (
                                <span className="text-muted-foreground text-sm">-</span>
                              )}
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              {new Date(customer.createdAt).toLocaleDateString()}
                            </TableCell>
                            <TableCell className="text-right">
                              <Button
                                size="sm"
                                onClick={() => handleAssign(customer.id)}
                                disabled={assigningId === customer.id || (customer.salesAssignments && customer.salesAssignments.length > 0)}
                                className="gap-2"
                                variant={customer.salesAssignments && customer.salesAssignments.length > 0 ? "outline" : "default"}
                              >
                                <UserPlus className="h-4 w-4" />
                                {assigningId === customer.id ? 'Assigning...' : 'Assign to Me'}
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>

                  {/* Pagination Controls */}
                  {pagination.pages > 1 && (
                    <div className="flex items-center justify-end gap-2 pt-4">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={pagination.page <= 1}
                        onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
                      >
                        Previous
                      </Button>
                      <span className="text-sm text-muted-foreground">
                        Page {pagination.page} of {pagination.pages}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={pagination.page >= pagination.pages}
                        onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
                      >
                        Next
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    </ProtectedRoute >
  );
}
