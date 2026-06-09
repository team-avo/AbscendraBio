"use client";

import React from "react";
import { DashboardLayout } from "@/components/dashboard/dashboard-layout";
import { ProtectedRoute } from "@/contexts/auth-context";
import { LabelSyncLogs } from "@/components/settings/label-sync-logs";

export default function LabelSyncLogsPage() {
  return (
    <ProtectedRoute requiredRoles={["ADMIN", "SUPER_ADMIN", "STAFF"]}>
      <DashboardLayout>
        <div className="space-y-5">
          <div>
            <h1 className="text-xl font-bold tracking-tight">Label Sync Logs</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Historical record of every ShipStation label tracking sync run by the hourly cron.
            </p>
          </div>
          <LabelSyncLogs />
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
