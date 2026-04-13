'use client';

import { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/dashboard/dashboard-layout';
import { useAuth } from '@/contexts/auth-context';
import { api } from '@/lib/api';
import logger from '@/lib/logger';
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
import { Search, Users, UserCheck, UserX, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
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
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-5">
            <h3 className="text-base font-semibold mb-1">Access Denied</h3>
            <p className="text-sm text-muted-foreground">You do not have permission to view this page.</p>
          </div>
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
        <div className="space-y-5 px-2 sm:px-0">
          {/* Header */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">My Sales Team</h1>
              <p className="text-muted-foreground text-sm sm:text-base">
                View and manage your assigned sales representatives
              </p>
            </div>
            <Button
              className="h-9 px-4 bg-[#1B2D4F] hover:bg-[#243d6b] text-white rounded-xl text-sm font-medium"
              onClick={() => setIsCreateOpen(true)}
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Sales Rep
            </Button>
          </div>

          {/* Stat Chips */}
          <div className="grid gap-3 grid-cols-1 sm:grid-cols-3">
            <div className="flex items-center gap-3 bg-white rounded-2xl border border-slate-200/80 shadow-sm px-5 py-4">
              <div className="flex items-center justify-center h-9 w-9 rounded-xl bg-slate-100">
                <Users className="h-4 w-4 text-slate-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-medium">Total Sales Reps</p>
                <p className="text-xl sm:text-2xl font-bold">{stats.total}</p>
              </div>
            </div>

            <div className="flex items-center gap-3 bg-white rounded-2xl border border-slate-200/80 shadow-sm px-5 py-4">
              <div className="flex items-center justify-center h-9 w-9 rounded-xl bg-green-50">
                <UserCheck className="h-4 w-4 text-green-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-medium">Active</p>
                <p className="text-xl sm:text-2xl font-bold text-green-600">{stats.active}</p>
              </div>
            </div>

            <div className="flex items-center gap-3 bg-white rounded-2xl border border-slate-200/80 shadow-sm px-5 py-4">
              <div className="flex items-center justify-center h-9 w-9 rounded-xl bg-red-50">
                <UserX className="h-4 w-4 text-red-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-medium">Inactive</p>
                <p className="text-xl sm:text-2xl font-bold text-red-600">{stats.inactive}</p>
              </div>
            </div>
          </div>

          {/* Search Filter */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-slate-100">
                <Search className="h-4 w-4 text-slate-600" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-slate-900">Search</h2>
                <p className="text-xs text-muted-foreground">Find sales representatives by name or email</p>
              </div>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name or email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          {/* Sales Reps Table */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-3">
              <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-slate-100">
                <Users className="h-4 w-4 text-slate-600" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-slate-900">Sales Representatives</h2>
                <p className="text-xs text-muted-foreground">
                  {loading ? 'Loading...' : `Showing ${filteredReps.length} of ${salesReps.length} representatives`}
                </p>
              </div>
            </div>
            <div className="p-5">
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
            </div>
          </div>
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
