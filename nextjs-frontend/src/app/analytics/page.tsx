'use client';

import { DashboardLayout } from "@/components/dashboard/dashboard-layout";
import { AnalyticsContent } from "@/components/analytics/analytics-content";
import { ProtectedRoute } from "@/contexts/auth-context";

export default function AnalyticsPage() {
    return (
        <ProtectedRoute requiredRoles={['ADMIN', 'MANAGER', 'STAFF', 'SALES_REP']}>
            <DashboardLayout>
                <AnalyticsContent />
            </DashboardLayout>
        </ProtectedRoute>
    );
}
