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
import { Search, Users, UserPlus, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { SalesRepManagerDialogs } from '../my-team/sales-rep-manager-dialogs';

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

export default function SalesManagerRecruitmentPage() {
    const { user, hasRole } = useAuth();
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [salesReps, setSalesReps] = useState<SalesRep[]>([]);
    const [isCreateOpen, setIsCreateOpen] = useState(false);

    const isSalesManager = hasRole('SALES_MANAGER');

    const fetchUnassignedReps = async () => {
        try {
            setLoading(true);
            const response = await api.get('/sales-managers/unassigned-sales-reps');

            if (response.success && response.data) {
                setSalesReps(response.data);
            }
        } catch (error) {
            logger.error('Failed to fetch unassigned reps:', { error });
            toast.error('Failed to load available sales representatives');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (!isSalesManager) return;
        fetchUnassignedReps();
    }, [isSalesManager]);

    const handleRecruit = async (rep: SalesRep) => {
        try {
            const response = await api.post('/sales-managers/recruit-sales-rep', {
                salesRepId: rep.id
            });
            if (response.success) {
                toast.success(`Successfully assigned ${rep.user.firstName} ${rep.user.lastName} to your team`);
                // Remove from the list
                setSalesReps(prev => prev.filter(r => r.id !== rep.id));
            }
        } catch (error: any) {
            logger.error('Failed to assign rep:', { error });
            toast.error(error.message || 'Failed to assign sales representative');
        }
    };

    if (isSalesManager) {
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

    return (
        <DashboardLayout>
            <div className="space-y-4 sm:space-y-6">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Assign Sales Representatives</h1>
                        <p className="text-muted-foreground text-sm sm:text-base">
                            Browse sales representatives who are not currently assigned to a manager and assign them to your team
                        </p>
                    </div>
                    <Button onClick={() => setIsCreateOpen(true)}>
                        <Plus className="h-4 w-4 mr-2" />
                        Add Sales Rep
                    </Button>
                </div>

                {/* Search Filter */}
                <Card>
                    <CardHeader>
                        <CardTitle>Search Available Reps</CardTitle>
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
                        <CardTitle>Available Representatives</CardTitle>
                        <CardDescription>
                            {loading ? 'Loading...' : `Showing ${filteredReps.length} of ${salesReps.length} available representatives`}
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        {loading ? (
                            <div className="text-center py-8 text-muted-foreground">Loading...</div>
                        ) : filteredReps.length === 0 ? (
                            <div className="text-center py-8 text-muted-foreground">
                                {salesReps.length === 0 ? 'No unassigned sales representatives found at the moment' : 'No results found'}
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Name</TableHead>
                                            <TableHead>Email</TableHead>
                                            <TableHead>Status</TableHead>
                                            <TableHead className="text-right">Actions</TableHead>
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
                                                    <Badge variant={rep.user?.isActive ? 'default' : 'secondary'}>
                                                        {rep.user?.isActive ? 'Active' : 'Inactive'}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <Button
                                                        size="sm"
                                                        onClick={() => handleRecruit(rep)}
                                                        className="bg-primary hover:bg-primary/90"
                                                    >
                                                        <UserPlus className="mr-2 h-4 w-4" />
                                                        Assign to My Team
                                                    </Button>
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
                isEditOpen={false}
                setIsEditOpen={() => { }}
                isPasswordOpen={false}
                setIsPasswordOpen={() => { }}
                isDeleteOpen={false}
                setIsDeleteOpen={() => { }}
                editingRep={null}
                refreshData={() => {
                    // No need to refresh the unassigned list if we just created a new rep 
                    // (the creation logic automatically assigns them to the manager)
                    // But we could refresh just in case
                    fetchUnassignedReps();
                }}
            />
        </DashboardLayout>
    );
}
