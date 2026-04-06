'use client';

import { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/dashboard/dashboard-layout';
import { useAuth } from '@/contexts/auth-context';
import { api } from '@/lib/api';
import logger from '@/lib/logger';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Search, Users, UserCheck, UserX, Plus, MoreHorizontal, Edit, Key, Mail, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Switch } from '@/components/ui/switch';
import { SalesRepManagerDialogs } from './sales-rep-manager-dialogs';

interface SalesRep {
  id: string;
  user: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    isActive: boolean;
  };
  assignments?: Array<{
    id: string;
    customer: {
      id: string;
      firstName: string;
      lastName: string;
      email: string;
    };
  }>;
}

export default function SalesManagerTeamPage() {
  const { user, hasRole } = useAuth();
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [salesReps, setSalesReps] = useState<SalesRep[]>([]);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isPasswordOpen, setIsPasswordOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [editingRep, setEditingRep] = useState<SalesRep | null>(null);

  const isSalesManager = hasRole('SALES_MANAGER');

  const fetchTeam = async () => {
    try {
      setLoading(true);
      const response = await api.get('/sales-managers/my-team/sales-reps');

      if (response.success && response.data) {
        setSalesReps(Array.isArray(response.data) ? response.data : response.data.salesReps || []);
      }
    } catch (error) {
      logger.error('Failed to fetch team:', { error });
      toast.error('Failed to load your sales representatives');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isSalesManager) return;
    fetchTeam();
  }, [isSalesManager]);

  const handleSendResetLink = async (rep: SalesRep) => {
    try {
      const response = await api.post(`/sales-managers/my-team/sales-reps/${rep.id}/send-reset-link`, {});
      if (response.success) {
        toast.success(`Reset link sent to ${rep.user.email}`);
      }
    } catch (error) {
      logger.error('Failed to send reset link:', { error });
      toast.error('Failed to send reset link');
    }
  };

  if (!isSalesManager) {
    return (
      <DashboardLayout>
        <div className="p-6">
          <Card>
            <CardHeader>
              <CardTitle>Access Denied</CardTitle>
            </CardHeader>
            <CardContent>You do not have permission to view this page.</CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  const filteredReps = salesReps.filter(rep =>
    rep.user?.firstName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    rep.user?.lastName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    rep.user?.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const stats = {
    total: salesReps.length,
    active: salesReps.filter(rep => rep.user.isActive).length,
    inactive: salesReps.filter(rep => !rep.user.isActive).length,
  };

  return (
    <DashboardLayout>
      <>
        <div className="space-y-4 sm:space-y-6">
          {/* Header */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">My Sales Team</h1>
              <p className="text-muted-foreground text-sm sm:text-base">
                View and manage your assigned sales representatives
              </p>
            </div>
            <Button onClick={() => setIsCreateOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Sales Rep
            </Button>
          </div>

          {/* Stats Cards */}
          <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-3">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-xs sm:text-sm font-medium">Total Sales Reps</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-xl sm:text-2xl font-bold">{stats.total}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-xs sm:text-sm font-medium">Active</CardTitle>
                <UserCheck className="h-4 w-4 text-green-600" />
              </CardHeader>
              <CardContent>
                <div className="text-xl sm:text-2xl font-bold text-green-600">{stats.active}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-xs sm:text-sm font-medium">Inactive</CardTitle>
                <UserX className="h-4 w-4 text-red-600" />
              </CardHeader>
              <CardContent>
                <div className="text-xl sm:text-2xl font-bold text-red-600">{stats.inactive}</div>
              </CardContent>
            </Card>
          </div>

          {/* Search Filter */}
          <Card>
            <CardHeader>
              <CardTitle>Search</CardTitle>
              <CardDescription>Find sales representatives by name or email</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name or email..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </CardContent>
          </Card>

          {/* Sales Reps Table */}
          <Card>
            <CardHeader>
              <CardTitle>Sales Representatives</CardTitle>
              <CardDescription>
                {loading ? 'Loading...' : `Showing ${filteredReps.length} of ${salesReps.length} representatives`}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-center py-8 text-muted-foreground">Loading...</div>
              ) : filteredReps.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  {salesReps.length === 0 ? 'No sales representatives assigned to you yet' : 'No results found'}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Assigned Customers</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredReps.map((rep) => (
                        <TableRow key={rep.id}>
                          <TableCell className="font-medium">
                            {rep.user?.firstName} {rep.user?.lastName}
                          </TableCell>
                          <TableCell>{rep.user?.email}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{rep.assignments?.length || 0}</Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant={rep.user?.isActive ? 'default' : 'secondary'}>
                              {rep.user?.isActive ? 'Active' : 'Inactive'}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <SalesRepManagerDialogs
          isCreateOpen={isCreateOpen}
          setIsCreateOpen={setIsCreateOpen}
          isEditOpen={isEditOpen}
          setIsEditOpen={setIsEditOpen}
          isPasswordOpen={isPasswordOpen}
          setIsPasswordOpen={setIsPasswordOpen}
          isDeleteOpen={isDeleteOpen}
          setIsDeleteOpen={setIsDeleteOpen}
          editingRep={editingRep}
          refreshData={fetchTeam}
        />
      </>
    </DashboardLayout>
  );
}
