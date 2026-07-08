"use client";

import { ProtectedRoute } from "@/contexts/auth-context";
import { DashboardLayout } from "@/components/dashboard/dashboard-layout";

// The Margin & Markup Forecaster is Peter's self-contained internal pricing
// tool. It is rendered in an iframe so its styles, scripts and localStorage stay
// isolated from the app. Access is limited to admins (it exposes cost and margin
// data); the sidebar also hides the item for non-admin roles.
export default function MarginForecasterPage() {
  return (
    <ProtectedRoute requiredRoles={["ADMIN", "SUPER_ADMIN"]}>
      <DashboardLayout>
        <div className="space-y-3">
          <div>
            <h1 className="text-xl font-bold tracking-tight">Margin &amp; Markup Forecaster</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Internal pricing, cost and margin modelling. Data is saved in this browser only.
            </p>
          </div>
          <div
            className="w-full rounded-xl border border-gray-200/80 overflow-hidden bg-white shadow-sm"
            style={{ height: "calc(100vh - 12rem)" }}
          >
            <iframe
              src="/margin-forecaster/tool"
              title="Margin & Markup Forecaster"
              className="w-full h-full border-0 block"
            />
          </div>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
