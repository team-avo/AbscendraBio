"use client";

import { DashboardLayout } from "@/components/dashboard/dashboard-layout";

export default function AccountLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="landing-theme min-h-screen bg-background text-foreground">
      <DashboardLayout>
        {children}
      </DashboardLayout>
    </div>
  );
}


