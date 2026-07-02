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
import { Plus, Search, Users } from 'lucide-react';
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
        <div className="space-y-0">

          {/* ════════ DARK HERO STRIP ════════ */}
          <div className="relative bg-mist border border-line border-t-2 border-t-[#5A9ADA] rounded-2xl mx-1 sm:mx-0 overflow-hidden">
            <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'linear-gradient(rgba(77,125,242,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(77,125,242,0.6) 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
            <div className="absolute top-0 right-0 w-[400px] h-[200px] bg-[#5A9ADA]/8 rounded-full blur-[100px] pointer-events-none" />

            <div className="relative z-10 px-6 py-6 sm:px-8 sm:py-7">
              {/* Top row */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
                <div>
                  <h1 className="text-xl font-black text-[#043061] tracking-tight">Users</h1>
                  <p className="text-xs text-gray-500 mt-0.5">Manage user accounts and permissions</p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2.5 bg-white border border-line rounded-xl px-4 py-2">
                    <Users className="h-4 w-4 text-[#5A9ADA]" />
                    <div>
                      <p className="text-[9px] text-gray-500 font-medium uppercase tracking-widest leading-none">Total</p>
                      <p className="text-base font-black text-[#043061] tabular-nums leading-tight">{stats.total.toLocaleString()}</p>
                    </div>
                  </div>
                  <Button onClick={() => setShowCreateDialog(true)} className="h-9 px-5 bg-[#043061] text-white hover:bg-[#0b4f96] rounded-xl text-xs font-black uppercase tracking-widest">
                    <Plus className="mr-1.5 h-3.5 w-3.5" /> Add User
                  </Button>
                </div>
              </div>

              {/* Role + status pills */}
              <div className="flex items-center gap-2 overflow-x-auto scrollbar-none pb-1">
                {[
                  { rKey: 'all',          sKey: 'all',      label: 'All',         count: stats.total,    color: null },
                  { rKey: 'all',          sKey: 'active',   label: 'Active',      count: stats.active,   color: 'emerald' },
                  { rKey: 'all',          sKey: 'inactive', label: 'Inactive',    count: stats.inactive, color: 'red' },
                  { rKey: 'ADMIN',        sKey: 'all',      label: 'Admins',      count: stats.admins,   color: 'blue' },
                  { rKey: 'MANAGER',      sKey: 'all',      label: 'Managers',    count: null,           color: 'purple' },
                  { rKey: 'STAFF',        sKey: 'all',      label: 'Staff',       count: null,           color: 'amber' },
                  { rKey: 'SALES_REP',    sKey: 'all',      label: 'Sales Reps',  count: null,           color: 'cyan' },
                ].map((pill) => {
                  const colorStyles: Record<string, { bg: string; text: string; ring: string; dot: string }> = {
                    emerald: { bg: 'bg-emerald-500/15', text: 'text-emerald-400', ring: 'ring-emerald-500/30', dot: 'bg-emerald-400' },
                    red:     { bg: 'bg-red-500/15',     text: 'text-red-400',     ring: 'ring-red-500/30',     dot: 'bg-red-400' },
                    blue:    { bg: 'bg-blue-500/15',    text: 'text-blue-400',    ring: 'ring-blue-500/30',    dot: 'bg-blue-400' },
                    purple:  { bg: 'bg-purple-500/15',  text: 'text-purple-400',  ring: 'ring-purple-500/30',  dot: 'bg-purple-400' },
                    amber:   { bg: 'bg-amber-500/15',   text: 'text-amber-400',   ring: 'ring-amber-500/30',   dot: 'bg-amber-400' },
                    cyan:    { bg: 'bg-cyan-500/15',    text: 'text-cyan-400',    ring: 'ring-cyan-500/30',    dot: 'bg-cyan-400' },
                  };
                  const c = pill.color ? colorStyles[pill.color] : null;
                  const isAll = pill.rKey === 'all' && pill.sKey === 'all';
                  const isActive = isAll
                    ? roleFilter === 'all' && statusFilter === 'all'
                    : roleFilter === pill.rKey && statusFilter === pill.sKey;
                  return (
                    <button
                      key={`${pill.rKey}-${pill.sKey}`}
                      onClick={() => { setRoleFilter(pill.rKey); setStatusFilter(pill.sKey); setCurrentPage(1); }}
                      className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                        isAll && isActive ? 'bg-[#043061] text-white ring-1 ring-[#043061]/20'
                        : isActive && c ? `${c.bg} ${c.text} ring-1 ${c.ring}`
                        : 'bg-white/[0.04] text-gray-500 hover:bg-white/[0.08] hover:text-gray-300'
                      }`}
                    >
                      {c && <span className={`w-1.5 h-1.5 rounded-full ${isActive ? c.dot : 'bg-gray-600'}`} />}
                      <span>{pill.label}</span>
                      {pill.count !== null && (
                        <span className={`ml-0.5 px-1.5 py-0.5 rounded-md text-[10px] font-black tabular-nums ${
                          isAll && isActive ? 'bg-white/20 text-white'
                          : isActive && c ? `${c.bg} ${c.text}`
                          : 'bg-white/[0.06] text-gray-500'
                        }`}>
                          {pill.count.toLocaleString()}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* ════════ COMPACT FILTER ROW ════════ */}
          <div className="px-1 sm:px-0 py-4 space-y-3">
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1 sm:max-w-sm">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                <Input
                  placeholder="Search users by name or email…"
                  value={searchTerm}
                  onChange={(e) => handleSearch(e.target.value)}
                  className="pl-10 h-9 bg-white border-gray-200 rounded-xl text-xs placeholder:text-gray-400"
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <Select value={roleFilter} onValueChange={handleRoleFilter}>
                  <SelectTrigger className="h-9 px-3 text-xs border-gray-200 rounded-xl bg-white w-auto min-w-[120px]">
                    <SelectValue placeholder="Role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Roles</SelectItem>
                    <SelectItem value="ADMIN">Admin</SelectItem>
                    <SelectItem value="MANAGER">Manager</SelectItem>
                    <SelectItem value="STAFF">Staff</SelectItem>
                    <SelectItem value="SALES_REP">Sales Rep</SelectItem>
                    <SelectItem value="SALES_MANAGER">Sales Manager</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={statusFilter} onValueChange={handleStatusFilter}>
                  <SelectTrigger className="h-9 px-3 text-xs border-gray-200 rounded-xl bg-white w-auto min-w-[120px]">
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
          </div>

          {/* ════════ TABLE ════════ */}
          <div className="bg-white rounded-2xl border border-gray-200/80 shadow-sm overflow-hidden mx-1 sm:mx-0">
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

          {/* ════════ DIALOGS ════════ */}
          <CreateUserDialog open={showCreateDialog} onOpenChange={setShowCreateDialog} onSuccess={handleUserCreated} />
          <EditUserDialog user={editingUser} open={!!editingUser} onOpenChange={(open) => !open && setEditingUser(null)} onSuccess={handleUserUpdated} />
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
