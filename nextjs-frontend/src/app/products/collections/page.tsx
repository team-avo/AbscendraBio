
'use client';

import { DashboardLayout } from '@/components/dashboard/dashboard-layout';
import { ProtectedRoute } from '@/contexts/auth-context';
import { CollectionsContent } from '@/components/collections/collections-content';

export default function ProductCollectionsPage() {
  return (
    <ProtectedRoute requiredRoles={['ADMIN', 'MANAGER', 'STAFF']}>
      <DashboardLayout>
        <CollectionsContent />
      </DashboardLayout>
    </ProtectedRoute>
  );
} 