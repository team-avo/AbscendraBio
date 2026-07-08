"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { DashboardLayout } from "@/components/dashboard/dashboard-layout";
import { ProtectedRoute } from "@/contexts/auth-context";

const TABS = [
  { href: "/lot-management", label: "Dashboard" },
  { href: "/lot-management/lots", label: "Lots" },
  { href: "/lot-management/coa", label: "COA Log" },
  { href: "/lot-management/registries", label: "Registries" },
  { href: "/lot-management/labels", label: "Labels" },
  { href: "/lot-management/label-studio", label: "Label Studio" },
  { href: "/lot-management/vial-studio", label: "Vial Studio" },
];

export default function LotManagementLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <ProtectedRoute requiredRoles={["ADMIN", "SUPER_ADMIN", "STAFF"]}>
      <DashboardLayout>
        <div className="space-y-5">
          <div>
            <h1 className="text-xl font-bold tracking-tight">Lot Management</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Lots, COAs, QC and labeling for Ascendra Bio and Lineará.
            </p>
          </div>
          <div className="flex gap-1 border-b border-gray-200 overflow-x-auto">
            {TABS.map((t) => {
              const active = t.href === "/lot-management" ? pathname === t.href : pathname.startsWith(t.href);
              return (
                <Link
                  key={t.href}
                  href={t.href}
                  className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px whitespace-nowrap transition-colors ${
                    active ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {t.label}
                </Link>
              );
            })}
          </div>
          {children}
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
