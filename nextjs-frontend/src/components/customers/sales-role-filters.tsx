'use client';

import { useState, useEffect } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { api } from '@/lib/api';
import { Loader2 } from 'lucide-react';
import logger from '@/lib/logger';
import { useAuth } from '@/contexts/auth-context';

interface SalesRoleFiltersProps {
    onSalesRepChange: (id: string) => void;
    onSalesManagerChange: (id: string) => void;
    selectedSalesRepId: string;
    selectedSalesManagerId: string;
}

interface SalesPerson {
    id: string;
    user: {
        firstName: string;
        lastName: string;
    };
}

export function SalesRoleFilters({
    onSalesRepChange,
    onSalesManagerChange,
    selectedSalesRepId,
    selectedSalesManagerId
}: SalesRoleFiltersProps) {
    const { user } = useAuth();
    const [salesReps, setSalesReps] = useState<SalesPerson[]>([]);
    const [salesManagers, setSalesManagers] = useState<SalesPerson[]>([]);
    const [loadingReps, setLoadingReps] = useState(false);
    const [loadingManagers, setLoadingManagers] = useState(false);

    const isSalesRep = user?.role === 'SALES_REP';
    const isSalesManager = user?.role === 'SALES_MANAGER';

    // Decide what to show
    const showSalesRepFilter = !isSalesRep;
    const showSalesManagerFilter = !isSalesRep && !isSalesManager;

    useEffect(() => {
        const fetchRoles = async () => {
            if (showSalesRepFilter) {
                try {
                    setLoadingReps(true);
                    const repsRes = await api.get('/sales-reps');
                    if (repsRes.success && repsRes.data) {
                        setSalesReps(repsRes.data);
                    }
                } catch (error) {
                    logger.error('Failed to fetch sales reps:', { error });
                } finally {
                    setLoadingReps(false);
                }
            }

            if (showSalesManagerFilter) {
                try {
                    setLoadingManagers(true);
                    const managersRes = await api.getSalesManagers();
                    if (managersRes.success && managersRes.data) {
                        setSalesManagers(managersRes.data);
                    }
                } catch (error) {
                    logger.error('Failed to fetch sales managers:', { error });
                } finally {
                    setLoadingManagers(false);
                }
            }
        };

        if (user) {
            fetchRoles();
        }
    }, [user, showSalesRepFilter, showSalesManagerFilter]);

    return (
        <>
            {showSalesRepFilter && (
                <Select value={selectedSalesRepId} onValueChange={onSalesRepChange}>
                    <SelectTrigger className="w-full sm:w-[200px]">
                        {loadingReps ? (
                            <div className="flex items-center gap-2">
                                <Loader2 className="h-4 w-4 animate-spin" />
                                <span>Loading Reps...</span>
                            </div>
                        ) : (
                            <SelectValue placeholder="Filter by Sales Rep" />
                        )}
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All Sales Reps</SelectItem>
                        <SelectItem value="unassigned">Show Unassigned</SelectItem>
                        {salesReps.map((rep) => (
                            <SelectItem key={rep.id} value={rep.id}>
                                {rep.user.firstName} {rep.user.lastName}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            )}

            {showSalesManagerFilter && (
                <Select value={selectedSalesManagerId} onValueChange={onSalesManagerChange}>
                    <SelectTrigger className="w-full sm:w-[200px]">
                        {loadingManagers ? (
                            <div className="flex items-center gap-2">
                                <Loader2 className="h-4 w-4 animate-spin" />
                                <span>Loading Managers...</span>
                            </div>
                        ) : (
                            <SelectValue placeholder="Filter by Sales Manager" />
                        )}
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All Sales Managers</SelectItem>
                        <SelectItem value="unassigned">Show Unassigned</SelectItem>
                        {salesManagers.map((manager) => (
                            <SelectItem key={manager.id} value={manager.id}>
                                {manager.user.firstName} {manager.user.lastName}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            )}
        </>
    );
}
