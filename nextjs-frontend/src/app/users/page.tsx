'use client';

export const dynamic = "force-dynamic";

import { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/dashboard/dashboard-layout';
import { ProtectedRoute } from '@/contexts/auth-context';
import { UsersTable } from '@/components/users/users-table';
import { CreateUserDialog } from '@/components/users/create-user-dialog';
import { EditUserDialog } from '@/components/users/edit-user-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Plus, Search, Users, UserCheck, UserX, Shield } from 'lucide-react';
import { api, User } from '@/lib/api';
import logger from '@/lib/logger';
import { toast } from 'sonner';

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalUsers, setTotalUsers] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [stats, setStats] = useState({
    total: 0,
    active: 0,
    inactive: 0,
    admins: 0,
  });

  const ITEMS_PER_PAGE = 10;
  const startIndex = totalUsers === 0 ? 0 : (currentPage - 1) * ITEMS_PER_PAGE + 1;
  const endIndex = totalUsers === 0 ? 0 : startIndex + users.length - 1;

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const params = {
        page: currentPage,
        limit: ITEMS_PER_PAGE,
        search: searchTerm || undefined,
        role: roleFilter !== 'all' ? roleFilter : undefined,
        isActive: statusFilter === 'all' ? undefined : statusFilter === 'active',
      };

      const response = await api.getUsers(params);

      if (response.success && response.data) {
        setUsers(response.data.users || []);
        setTotalUsers(response.data.pagination.total);
        setTotalPages(response.data.pagination.pages);
      }
    } catch (error) {
      logger.error('Failed to fetch users:', { error });
      toast.error('Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await api.getUserStats();
      if (response.success && response.data) {
        setStats(response.data);
      }
    } catch (error) {
      logger.error('Failed to fetch user stats:', { error });
    }
  };

  useEffect(() => {
    fetchUsers();
    fetchStats();
  }, [currentPage, searchTerm, roleFilter, statusFilter]);

  const handleSearch = (value: string) => {
    setSearchTerm(value);
    setCurrentPage(1);
  };

  const handleRoleFilter = (value: string) => {
    setRoleFilter(value);
    setCurrentPage(1);
  };

  const handleStatusFilter = (value: string) => {
    setStatusFilter(value);
    setCurrentPage(1);
  };


  const handleDeleteUser = async (userId: string) => {
    // This is called after deactivate/delete to refresh the list
    fetchUsers();
    fetchStats(); // Refresh stats after deletion
  };

  const handleUserCreated = () => {
    setShowCreateDialog(false);
    fetchUsers();
    fetchStats(); // Refresh stats after creation
    toast.success('User created successfully');
  };

  const handleUserUpdated = () => {
    setEditingUser(null);
    fetchUsers();
    fetchStats(); // Refresh stats after update
    toast.success('User updated successfully');
  };

  return (
    <ProtectedRoute requiredRoles={['ADMIN', 'MANAGER']}>
      <DashboardLayout>
        <div className="space-y-5 px-2 sm:px-0">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Users</h1>
              <p className="text-muted-foreground text-sm sm:text-base">
                Manage user accounts and permissions
              </p>
            </div>
            <Button
              onClick={() => setShowCreateDialog(true)}
              className="h-9 px-4 bg-[#1B2D4F] hover:bg-[#243d6b] text-white rounded-xl text-sm font-medium w-full sm:w-auto"
            >
              <Plus className="mr-2 h-4 w-4" />
              Add User
            </Button>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {/* Total Users */}
            <div className="flex items-center gap-3 bg-white rounded-2xl border border-slate-200/80 shadow-sm px-5 py-4">
              <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center">
                <Users className="h-5 w-5 text-slate-500" />
              </div>
              <div>
                <p className="text-xs text-slate-500 font-medium">Total Users</p>
                <p className="text-xl font-bold text-slate-900">{stats.total}</p>
              </div>
            </div>

            {/* Active */}
            <div className="flex items-center gap-3 bg-white rounded-2xl border border-slate-200/80 shadow-sm px-5 py-4">
              <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center">
                <UserCheck className="h-5 w-5 text-emerald-500" />
              </div>
              <div>
                <p className="text-xs text-slate-500 font-medium">Active</p>
                <p className="text-xl font-bold text-emerald-600">{stats.active}</p>
              </div>
            </div>

            {/* Inactive */}
            <div className="flex items-center gap-3 bg-white rounded-2xl border border-slate-200/80 shadow-sm px-5 py-4">
              <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center">
                <UserX className="h-5 w-5 text-red-500" />
              </div>
              <div>
                <p className="text-xs text-slate-500 font-medium">Inactive</p>
                <p className="text-xl font-bold text-red-600">{stats.inactive}</p>
              </div>
            </div>

            {/* Admins — dark navy hero chip */}
            <div className="relative flex items-center gap-3 bg-[#1B2D4F] rounded-2xl shadow-sm px-5 py-4 overflow-hidden">
              <div className="absolute -top-4 -right-4 w-20 h-20 rounded-full bg-white/5" />
              <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
                <Shield className="h-5 w-5 text-blue-300" />
              </div>
              <div>
                <p className="text-xs text-slate-400 font-medium">Admins</p>
                <p className="text-2xl font-bold text-white">{stats.admins}</p>
              </div>
            </div>
          </div>

          {/* Filter Bar */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-4 space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search users..."
                value={searchTerm}
                onChange={(e) => handleSearch(e.target.value)}
                className="pl-9 w-full"
              />
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <Select value={roleFilter} onValueChange={handleRoleFilter}>
                <SelectTrigger className="w-full sm:w-[160px]">
                  <SelectValue placeholder="Role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Roles</SelectItem>
                  <SelectItem value="ADMIN">Admin</SelectItem>
                  <SelectItem value="MANAGER">Manager</SelectItem>
                  <SelectItem value="STAFF">Staff</SelectItem>
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={handleStatusFilter}>
                <SelectTrigger className="w-full sm:w-[140px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Table Card */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center flex-shrink-0">
                <Users className="h-4 w-4 text-slate-500" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-slate-900">Users List</h2>
                <p className="text-xs text-slate-500">
                  {loading
                    ? 'Loading...'
                    : totalUsers === 0
                      ? 'Showing 0 users'
                      : `Showing ${startIndex}-${endIndex} of ${totalUsers} users`}
                </p>
              </div>
            </div>
            <UsersTable
              users={users}
              loading={loading}
              onEdit={setEditingUser}
              onDelete={handleDeleteUser}
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={setCurrentPage}
              onPermissionsUpdated={fetchUsers}
            />
          </div>

          {/* Dialogs */}
          <CreateUserDialog
            open={showCreateDialog}
            onOpenChange={setShowCreateDialog}
            onSuccess={handleUserCreated}
          />

          <EditUserDialog
            user={editingUser}
            open={!!editingUser}
            onOpenChange={(open) => !open && setEditingUser(null)}
            onSuccess={handleUserUpdated}
          />
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
