'use client';

import { useState } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from '@/components/ui/pagination';
import { MoreHorizontal, Edit, Trash2, Key, Shield, ChevronLeft, ChevronRight } from 'lucide-react';
import { User, formatDate, getStatusColor, api } from '@/lib/api';
import { toast } from 'sonner';
import { usePermissions } from '@/contexts/auth-context';
import { ManagePermissionsDialog } from './manage-permissions-dialog';
import { ChangePasswordDialog } from './change-password-dialog';
import logger from '@/lib/logger';

interface UsersTableProps {
  users: User[];
  loading: boolean;
  onEdit: (user: User) => void;
  onDelete: (userId: string) => void;
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  onPermissionsUpdated: () => void;
}

export function UsersTable({
  users,
  loading,
  onEdit,
  onDelete,
  currentPage,
  totalPages,
  onPageChange,
  onPermissionsUpdated,
}: UsersTableProps) {
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deactivateDialogOpen, setDeactivateDialogOpen] = useState(false);
  const [changePasswordDialogOpen, setChangePasswordDialogOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<User | null>(null);
  const [userToDeactivate, setUserToDeactivate] = useState<User | null>(null);
  const [permissionsDialogOpen, setPermissionsDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const { canDelete, canUpdate } = usePermissions();

  const handleDeactivateClick = (user: User) => {
    setUserToDeactivate(user);
    setDeactivateDialogOpen(true);
  };

  const handleDeactivateConfirm = async () => {
    if (userToDeactivate) {
      try {
        const response = await api.deactivateUser(userToDeactivate.id);
        if (response.success) {
          toast.success('User deactivated successfully');
          onDelete(userToDeactivate.id); // Refresh the list
        } else {
          toast.error(response.error || 'Failed to deactivate user');
        }
      } catch (error) {
        logger.error('Failed to deactivate user:', { error: error });
        toast.error('Failed to deactivate user');
      }
      setDeactivateDialogOpen(false);
      setUserToDeactivate(null);
    }
  };

  const handleDeleteClick = (user: User) => {
    setUserToDelete(user);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (userToDelete) {
      try {
        const response = await api.deleteUser(userToDelete.id);
        if (response.success) {
          toast.success('User permanently deleted successfully');
          onDelete(userToDelete.id); // Refresh the list
        } else {
          toast.error(response.error || 'Failed to delete user');
        }
      } catch (error) {
        logger.error('Failed to delete user:', { error: error });
        toast.error('Failed to delete user');
      }
      setDeleteDialogOpen(false);
      setUserToDelete(null);
    }
  };

  const handleManagePermissions = (user: User) => {
    setSelectedUser(user);
    setPermissionsDialogOpen(true);
  };

  const handlePermissionsSuccess = () => {
    onPermissionsUpdated();
  };

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case 'ADMIN':
        return 'destructive';
      case 'MANAGER':
        return 'default';
      case 'STAFF':
        return 'secondary';
      default:
        return 'outline';
    }
  };

  const getInitials = (firstName?: string | null, lastName?: string | null, email?: string | null) => {
    const safeFirst = firstName?.trim() ?? '';
    const safeLast = lastName?.trim() ?? '';

    const firstInitial = safeFirst.charAt(0) || safeLast.charAt(0) || email?.trim().charAt(0) || '?';
    const secondInitial =
      safeLast.charAt(0) ||
      safeFirst.charAt(1) ||
      email?.trim().charAt(1) ||
      '';

    return `${firstInitial}${secondInitial}`.toUpperCase().slice(0, 2);
  };
  const getDisplayName = (firstName?: string | null, lastName?: string | null, fallback?: string) => {
    const name = [firstName, lastName].filter(Boolean).join(' ').trim();
    return name || fallback || 'Unknown User';
  };

  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center space-x-4 p-4">
            <div className="w-10 h-10 bg-gray-200 rounded-full animate-pulse" />
            <div className="flex-1 space-y-2">
              <div className="h-4 bg-gray-200 rounded animate-pulse w-1/4" />
              <div className="h-3 bg-gray-200 rounded animate-pulse w-1/6" />
            </div>
            <div className="h-8 bg-gray-200 rounded animate-pulse w-20" />
            <div className="h-8 bg-gray-200 rounded animate-pulse w-8" />
          </div>
        ))}
      </div>
    );
  }

  if (users.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground">No users found</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-md border overflow-x-auto">
        <Table className="min-w-[800px] w-full">
          <TableHeader>
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((user) => (
              <TableRow key={user.id}>
                <TableCell>
                  <div className="flex items-center space-x-3">
                    <Avatar>
                      <AvatarFallback>
                        {getInitials(user.firstName, user.lastName, user.email)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <div className="font-medium">
                        {getDisplayName(user.firstName, user.lastName, user.email)}
                      </div>
                      <div className="text-sm text-muted-foreground truncate max-w-[140px] sm:max-w-[220px]">
                        {user.email}
                      </div>
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant={getRoleBadgeVariant(user.role)}>
                    {user.role}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Badge
                    variant={user.isActive ? 'default' : 'secondary'}
                    className={user.isActive ? 'bg-green-100 text-green-800 hover:bg-green-100' : ''}
                  >
                    {user.isActive ? 'Active' : 'Inactive'}
                  </Badge>
                </TableCell>
                <TableCell>
                  <span className="text-sm text-muted-foreground">
                    {formatDate(user.createdAt)}
                  </span>
                </TableCell>
                <TableCell className="text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" className="h-8 w-8 p-0">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {canUpdate('USERS') && (
                        <DropdownMenuItem onClick={() => onEdit(user)}>
                          <Edit className="mr-2 h-4 w-4" />
                          Edit User
                        </DropdownMenuItem>
                      )}
                      {canUpdate('USERS') && (
                        <DropdownMenuItem onClick={() => handleManagePermissions(user)}>
                          <Shield className="mr-2 h-4 w-4" />
                          Manage Permissions
                        </DropdownMenuItem>
                      )}
                      {canUpdate('USERS') && (
                        <>
                          <DropdownMenuItem onClick={async () => {
                            try {
                              const resp = await api.requestPasswordReset(user.email);
                              if (resp.success) toast.success('Reset link sent successfully');
                              else toast.error(resp.error || 'Failed to send reset link');
                            } catch (e: any) {
                              toast.error(e?.message || 'Failed to send reset link');
                            }
                          }}>
                            <Key className="mr-2 h-4 w-4" />
                            Send Reset Link
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => {
                            setSelectedUser(user);
                            setChangePasswordDialogOpen(true);
                          }}>
                            <Key className="mr-2 h-4 w-4" />
                            Change Password
                          </DropdownMenuItem>
                        </>
                      )}
                      {canDelete('USERS') && (
                        <>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => handleDeactivateClick(user)}
                            className="text-orange-600"
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Deactivate
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleDeleteClick(user)}
                            className="text-red-600"
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete Permanently
                          </DropdownMenuItem>
                        </>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-4 sm:px-0 py-2">
          <div className="text-xs sm:text-sm text-muted-foreground order-2 sm:order-1">
            Page {currentPage} of {totalPages}
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto justify-center sm:justify-end order-1 sm:order-2">
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={onPageChange}
            />
          </div>
        </div>
      )}

      {/* Deactivate Confirmation Dialog */}
      <AlertDialog open={deactivateDialogOpen} onOpenChange={setDeactivateDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deactivate User?</AlertDialogTitle>
            <AlertDialogDescription>
              This will deactivate the user account. The user will no longer be able to access the system, but their data will be preserved. You can reactivate them later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeactivateConfirm} className="bg-orange-600 hover:bg-orange-700">
              Deactivate
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Permanently Delete User?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the user and all associated data from the database. Are you absolutely sure?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm} className="bg-red-600 hover:bg-red-700">
              Delete Permanently
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Permissions Dialog */}
      <ManagePermissionsDialog
        user={selectedUser}
        open={permissionsDialogOpen}
        onOpenChange={setPermissionsDialogOpen}
        onSuccess={handlePermissionsSuccess}
      />

      <ChangePasswordDialog
        open={changePasswordDialogOpen}
        onOpenChange={setChangePasswordDialogOpen}
        onConfirm={(newPassword) => api.resetUserPassword(selectedUser?.id || '', newPassword)}
        title={`Change Password: ${selectedUser?.firstName} ${selectedUser?.lastName}`}
        entityName="user"
      />
    </div>
  );
}