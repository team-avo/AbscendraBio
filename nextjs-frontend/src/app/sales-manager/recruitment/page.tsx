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
                    <div className="bg-white rounded-2xl border border-gray-200/80 shadow-sm p-5">
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

    return (
        <DashboardLayout>
            <div className="space-y-0">
                {/* ════════ DARK HERO STRIP ════════ */}
                <div className="relative bg-[#070B14] rounded-2xl mx-1 sm:mx-0 overflow-hidden">
                  <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'linear-gradient(rgba(77,125,242,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(77,125,242,0.6) 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
                  <div className="absolute top-0 right-0 w-[400px] h-[200px] bg-[#4D7DF2]/8 rounded-full blur-[100px] pointer-events-none" />
                  <div className="relative z-10 px-6 py-6 sm:px-8 sm:py-7">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                      <div>
                        <h1 className="text-xl font-black text-white tracking-tight">Recruitment</h1>
                        <p className="text-xs text-gray-500 mt-0.5">Assign available sales representatives to your team</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-2.5 bg-white/[0.06] border border-white/[0.08] rounded-xl px-4 py-2">
                          <Users className="h-4 w-4 text-[#4D7DF2]" />
                          <div>
                            <p className="text-[9px] text-gray-500 font-medium uppercase tracking-widest leading-none">Available</p>
                            <p className="text-base font-black text-white tabular-nums leading-tight">{salesReps.length}</p>
                          </div>
                        </div>
                        <button
                          onClick={() => setIsCreateOpen(true)}
                          className="flex items-center gap-1.5 h-9 px-3 bg-white text-[#070B14] rounded-xl text-xs font-black uppercase tracking-widest hover:bg-gray-100 transition-colors"
                        >
                          <Plus className="h-3.5 w-3.5" />
                          ADD REP
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Search Filter */}
                <div className="mt-4 bg-white rounded-2xl border border-gray-200/80 shadow-sm p-5">
                    <div className="flex items-center gap-3 mb-3">
                        <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-slate-100">
                            <Search className="h-4 w-4 text-slate-600" />
                        </div>
                        <div>
                            <h2 className="text-sm font-semibold text-slate-900">Search Available Reps</h2>
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
                <div className="bg-white rounded-2xl border border-gray-200/80 shadow-sm overflow-hidden">
                    <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-3">
                        <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-slate-100">
                            <Users className="h-4 w-4 text-slate-600" />
                        </div>
                        <div>
                            <h2 className="text-sm font-semibold text-slate-900">Available Representatives</h2>
                            <p className="text-xs text-muted-foreground">
                                {loading ? 'Loading...' : `Showing ${filteredReps.length} of ${salesReps.length} available representatives`}
                            </p>
                        </div>
                    </div>
                    <div className="p-5">
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
                                                        className="h-9 px-4 bg-[#1B2D4F] hover:bg-[#243d6b] text-white rounded-xl text-sm font-medium"
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
                    </div>
                </div>
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
