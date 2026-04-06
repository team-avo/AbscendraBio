"use client";

import React from "react";
import { DashboardLayout } from "@/components/dashboard/dashboard-layout";
import { DashboardContent } from "@/components/dashboard/dashboard-content";
import { useRouter } from "next/navigation";
import { ProtectedRoute, useAuth } from "@/contexts/auth-context";
import { LoadingSpinner } from "@/components/ui/loading-spinner";

export default function AdminDashboard() {
  const { isAuthenticated, isLoading, hasRole, user } = useAuth();
  const router = useRouter();
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);

  const isSalesRep = isAuthenticated && user?.role === "SALES_REP";
  const isSalesManager = isAuthenticated && user?.role === "SALES_MANAGER";

  React.useEffect(() => {
    if (isSalesRep) {
      router.replace("/orders");
    } else if (isSalesManager) {
      router.replace("/sales-manager/my-team");
    }
  }, [isSalesRep, isSalesManager, router]);

  // Redirect to admin login if not authenticated (ensure hooks are declared before any early returns)
  React.useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace("/admin/login");
    }
  }, [isAuthenticated, isLoading, router]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner size={32} />
      </div>
    );
  }

  // If not authenticated or doesn't have required roles, let the useEffects handle redirection
  if (!isAuthenticated || !user) {
    if (!isLoading && mounted) return null; // Logic in useEffect will redirect
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner size={32} />
      </div>
    );
  }

  // Handle specific redirects for sales roles (extra safety if useEffect didn't trigger yet)
  if (isSalesRep || isSalesManager) return null;

  // Render for authorized administrative roles
  if (["ADMIN", "MANAGER", "STAFF"].includes(user.role)) {
    return (
      <DashboardLayout>
        <DashboardContent />
      </DashboardLayout>
    );
  }

  // Fallback for unauthorized roles
  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h2>
        <p className="text-gray-600">You don't have the required role to access the admin dashboard.</p>
      </div>
    </div>
  );
}
