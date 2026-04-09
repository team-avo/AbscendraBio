"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";
import LandingPage from "@/components/landing/LandingPage";
import { LoadingSpinner } from "@/components/ui/loading-spinner";

export default function Home() {
  const router = useRouter();
  const { isAuthenticated, isLoading, hasRole } = useAuth();
  const [mounted, setMounted] = useState(false);

  // All hooks MUST be called unconditionally at the top level (Rules of Hooks)
  useEffect(() => {
    setMounted(true);
  }, []);

  // Handle role-based redirects in a single unconditional useEffect
  useEffect(() => {
    if (isLoading || !isAuthenticated) return;

    if (hasRole(["ADMIN", "MANAGER", "STAFF"])) {
      router.replace("/admin-dashboard");
    } else if (hasRole(["SALES_MANAGER"])) {
      router.replace("/sales-manager/analytics");
    } else if (hasRole(["SALES_REP"])) {
      router.replace("/orders");
    } else if (isAuthenticated && hasRole("CUSTOMER")) {
      router.replace("/landing");
    }
  }, [isLoading, isAuthenticated, hasRole, router]);

  // Before mount, render nothing to avoid server/client hydration mismatch
  if (!mounted) {
    return null;
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner size={32} />
      </div>
    );
  }

  // If authenticated with a redirect role, show nothing while redirecting
  if (isAuthenticated && hasRole(["ADMIN", "MANAGER", "STAFF", "SALES_MANAGER", "SALES_REP"])) {
    return null;
  }

  return <LandingPage />;
}
