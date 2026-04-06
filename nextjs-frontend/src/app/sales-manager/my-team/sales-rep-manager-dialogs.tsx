'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
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
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { Eye, EyeOff } from 'lucide-react';

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

interface Props {
    isCreateOpen: boolean;
    setIsCreateOpen: (open: boolean) => void;
    isEditOpen: boolean;
    setIsEditOpen: (open: boolean) => void;
    isPasswordOpen: boolean;
    setIsPasswordOpen: (open: boolean) => void;
    isDeleteOpen: boolean;
    setIsDeleteOpen: (open: boolean) => void;
    editingRep: SalesRep | null;
    refreshData: () => void;
}

export function SalesRepManagerDialogs({
    isCreateOpen,
    setIsCreateOpen,
    isEditOpen,
    setIsEditOpen,
    isPasswordOpen,
    setIsPasswordOpen,
    isDeleteOpen,
    setIsDeleteOpen,
    editingRep,
    refreshData
}: Props) {
    const [loading, setLoading] = useState(false);

    // Form states
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isActive, setIsActive] = useState(true);
    const [newPassword, setNewPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [showNewPassword, setShowNewPassword] = useState(false);

    // Reset Edit states when editingRep changes
    useEffect(() => {
        if (editingRep) {
            setFirstName(editingRep.user.firstName);
            setLastName(editingRep.user.lastName);
            setEmail(editingRep.user.email);
            setIsActive(editingRep.user.isActive);
        } else {
            setFirstName('');
            setLastName('');
            setEmail('');
            setPassword('');
            setIsActive(true);
            setNewPassword('');
        }
    }, [editingRep, isCreateOpen]);

    const handleCreate = async () => {
        try {
            setLoading(true);
            const response = await api.post('/sales-managers/my-team/sales-reps', {
                firstName,
                lastName,
                email,
                password
            });

            if (response.success) {
                toast.success('Sales representative created successfully');
                setIsCreateOpen(false);
                refreshData();
            }
        } catch (error: any) {
            toast.error(error.message || 'Failed to create sales representative');
        } finally {
            setLoading(false);
        }
    };

    const handleEdit = async () => {
        if (!editingRep) return;
        try {
            setLoading(true);
            const response = await api.put(`/sales-managers/my-team/sales-reps/${editingRep.id}`, {
                firstName,
                lastName,
                email,
                isActive
            });

            if (response.success) {
                toast.success('Sales representative updated successfully');
                setIsEditOpen(false);
                refreshData();
            }
        } catch (error: any) {
            toast.error(error.message || 'Failed to update sales representative');
        } finally {
            setLoading(false);
        }
    };

    const handleChangePassword = async () => {
        if (!editingRep) return;
        try {
            setLoading(true);
            const response = await api.post(`/sales-managers/my-team/sales-reps/${editingRep.id}/reset-password`, {
                newPassword
            });

            if (response.success) {
                toast.success('Password changed successfully');
                setIsPasswordOpen(false);
                setNewPassword('');
            }
        } catch (error: any) {
            toast.error(error.message || 'Failed to change password');
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async () => {
        if (!editingRep) return;
        try {
            setLoading(true);
            const response = await api.delete(`/sales-managers/my-team/sales-reps/${editingRep.id}`);

            if (response.success) {
                toast.success('Sales representative deleted successfully');
                setIsDeleteOpen(false);
                refreshData();
            }
        } catch (error: any) {
            toast.error(error.message || 'Failed to delete sales representative');
        } finally {
            setLoading(false);
        }
    };

    return (
        <>
            {/* Create Dialog */}
            <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Create New Sales Representative</DialogTitle>
                        <DialogDescription>
                            Fill in the details to create a new sales representative account.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="firstName">First Name</Label>
                                <Input id="firstName" value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="John" />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="lastName">Last Name</Label>
                                <Input id="lastName" value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Doe" />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="email">Email</Label>
                            <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="john.doe@example.com" />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="password">Password</Label>
                            <div className="relative">
                                <Input
                                    id="password"
                                    type={showPassword ? 'text' : 'password'}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="••••••••"
                                    className="pr-10"
                                />
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                                    onClick={() => setShowPassword(!showPassword)}
                                >
                                    {showPassword ? (
                                        <EyeOff className="h-4 w-4 text-muted-foreground" />
                                    ) : (
                                        <Eye className="h-4 w-4 text-muted-foreground" />
                                    )}
                                </Button>
                            </div>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsCreateOpen(false)}>Cancel</Button>
                        <Button onClick={handleCreate} disabled={loading}>
                            {loading ? 'Creating...' : 'Create Sales Rep'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Edit Dialog */}
            <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Edit Sales Representative</DialogTitle>
                        <DialogDescription>
                            Update the profile details for this sales representative.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="edit-firstName">First Name</Label>
                                <Input id="edit-firstName" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="edit-lastName">Last Name</Label>
                                <Input id="edit-lastName" value={lastName} onChange={(e) => setLastName(e.target.value)} />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="edit-email">Email</Label>
                            <Input id="edit-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
                        </div>
                        <div className="flex items-center space-x-2 py-2">
                            <Switch id="isActive" checked={isActive} onCheckedChange={setIsActive} />
                            <Label htmlFor="isActive">Account Active</Label>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsEditOpen(false)}>Cancel</Button>
                        <Button onClick={handleEdit} disabled={loading}>
                            {loading ? 'Saving...' : 'Save Changes'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Change Password Dialog */}
            <Dialog open={isPasswordOpen} onOpenChange={setIsPasswordOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Change Password</DialogTitle>
                        <DialogDescription>
                            Set a new password for {editingRep?.user.firstName} {editingRep?.user.lastName}.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="space-y-2">
                            <Label htmlFor="newPassword">New Password</Label>
                            <div className="relative">
                                <Input
                                    id="newPassword"
                                    type={showNewPassword ? 'text' : 'password'}
                                    value={newPassword}
                                    onChange={(e) => setNewPassword(e.target.value)}
                                    placeholder="••••••••"
                                    className="pr-10"
                                />
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                                    onClick={() => setShowNewPassword(!showNewPassword)}
                                >
                                    {showNewPassword ? (
                                        <EyeOff className="h-4 w-4 text-muted-foreground" />
                                    ) : (
                                        <Eye className="h-4 w-4 text-muted-foreground" />
                                    )}
                                </Button>
                            </div>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsPasswordOpen(false)}>Cancel</Button>
                        <Button onClick={handleChangePassword} disabled={loading || !newPassword}>
                            {loading ? 'Updating...' : 'Update Password'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Delete Confirmation */}
            <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will permanently delete the account for {editingRep?.user.firstName} {editingRep?.user.lastName} and remove all their customer assignments. This action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={loading}>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDelete} disabled={loading} className="bg-red-600 hover:bg-red-700">
                            {loading ? 'Deleting...' : 'Delete Account'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}
