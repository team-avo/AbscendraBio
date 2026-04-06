'use client';

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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, Search, Filter, Users, UserCheck, UserX } from 'lucide-react';
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
        <div className="space-y-4 sm:space-y-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 px-2 sm:px-0">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Users</h1>
              <p className="text-muted-foreground text-sm sm:text-base">
                Manage user accounts and permissions
              </p>
            </div>
            <Button onClick={() => setShowCreateDialog(true)} className="w-full sm:w-auto">
              <Plus className="mr-2 h-4 w-4" />
              Add User
            </Button>
          </div>

          {/* Stats Cards */}
          <div className="grid gap-2 sm:gap-4 grid-cols-2 lg:grid-cols-4 px-2 sm:px-0">
            <Card className="py-0 gap-0">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 p-2 sm:p-4 pb-0 sm:pb-0">
                <CardTitle className="text-[10px] sm:text-sm font-medium text-muted-foreground uppercase tracking-wider">Total Users</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground hidden sm:block" />
              </CardHeader>
              <CardContent className="p-2 sm:p-4 pt-0 sm:pt-0">
                <div className="text-xl sm:text-2xl font-bold">{stats.total}</div>
              </CardContent>
            </Card>
            <Card className="py-0 gap-0">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 p-2 sm:p-4 pb-0 sm:pb-0">
                <CardTitle className="text-[10px] sm:text-sm font-medium text-muted-foreground uppercase tracking-wider">Active</CardTitle>
                <UserCheck className="h-4 w-4 text-green-600 hidden sm:block" />
              </CardHeader>
              <CardContent className="p-2 sm:p-4 pt-0 sm:pt-0">
                <div className="text-xl sm:text-2xl font-bold text-green-600">{stats.active}</div>
              </CardContent>
            </Card>
            <Card className="py-0 gap-0">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 p-2 sm:p-4 pb-0 sm:pb-0">
                <CardTitle className="text-[10px] sm:text-sm font-medium text-muted-foreground uppercase tracking-wider">Inactive</CardTitle>
                <UserX className="h-4 w-4 text-red-600 hidden sm:block" />
              </CardHeader>
              <CardContent className="p-2 sm:p-4 pt-0 sm:pt-0">
                <div className="text-xl sm:text-2xl font-bold text-red-600">{stats.inactive}</div>
              </CardContent>
            </Card>
            <Card className="py-0 gap-0">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 p-2 sm:p-4 pb-0 sm:pb-0">
                <CardTitle className="text-[10px] sm:text-sm font-medium text-muted-foreground uppercase tracking-wider">Admins</CardTitle>
                <Badge variant="default" className="h-4 px-2 text-[10px] hidden sm:flex">ADMIN</Badge>
              </CardHeader>
              <CardContent className="p-2 sm:p-4 pt-0 sm:pt-0">
                <div className="text-xl sm:text-2xl font-bold">{stats.admins}</div>
              </CardContent>
            </Card>
          </div>

          {/* Filters */}
          <Card className="mx-2 sm:mx-0">
            <CardHeader className="p-4 sm:p-6 pb-2 sm:pb-3">
              <CardTitle className="text-lg sm:text-xl">Filters</CardTitle>
              <CardDescription className="text-xs sm:text-sm">Filter and search users</CardDescription>
            </CardHeader>
            <CardContent className="p-4 sm:p-6 pt-0 sm:pt-0">
              <div className="flex flex-col md:flex-row gap-3 sm:gap-4">
                <div className="flex-1">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search users..."
                      value={searchTerm}
                      onChange={(e) => handleSearch(e.target.value)}
                      className="pl-10 w-full"
                    />
                  </div>
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
            </CardContent>
          </Card>

          {/* Users Table */}
          <Card className="mx-2 sm:mx-0">
            <CardHeader className="p-4 sm:p-6 pb-2 sm:pb-3">
              <CardTitle className="text-lg sm:text-xl">Users List</CardTitle>
              <CardDescription className="text-xs sm:text-sm">
                {loading
                  ? 'Loading...'
                  : totalUsers === 0
                    ? 'Showing 0 users'
                    : `Showing ${startIndex}-${endIndex} of ${totalUsers} users`}
              </CardDescription>
            </CardHeader>
            <CardContent className="p-3 sm:p-6 pt-0 sm:pt-0">
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
            </CardContent>
          </Card>

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