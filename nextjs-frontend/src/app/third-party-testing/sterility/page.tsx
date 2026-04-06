"use client";

import { DashboardLayout } from "@/components/dashboard/dashboard-layout";
import { ProtectedRoute } from "@/contexts/auth-context";
import { ThirdPartyReportsManager } from "@/components/third-party-testing/reports-manager";

export default function ThirdPartyTestingSterilityPage() {
  return (
    <ProtectedRoute requiredRoles={["ADMIN", "MANAGER", "STAFF"]}>
      <DashboardLayout>
        <ThirdPartyReportsManager category="STERILITY" backHref="/third-party-testing" />
      </DashboardLayout>
    </ProtectedRoute>
  );
}
