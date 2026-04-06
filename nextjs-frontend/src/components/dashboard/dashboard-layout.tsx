"use client";

import { useState } from "react";
import { DashboardSidebar } from "./dashboard-sidebar";
import { DashboardHeader } from "./dashboard-header";
import { cn } from "@/lib/utils";

interface DashboardLayoutProps {
    children: React.ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
    const [sidebarOpen, setSidebarOpen] = useState(false);

    return (
        <div className="min-h-screen bg-background flex overflow-x-hidden">
            {/* Sidebar */}
            <DashboardSidebar open={sidebarOpen} onOpenChange={setSidebarOpen} />

            {/* Main content */}
            <div className={cn(
                "flex-1 flex flex-col transition-all duration-300 ease-in-out max-w-full",
                "lg:pl-64" // Always show sidebar on large screens
            )}>
                {/* Header */}
                <DashboardHeader onMenuClick={() => setSidebarOpen(true)} />

                {/* Page content */}
                <main className="flex-1 p-3 sm:p-6 min-h-0 w-full max-w-full overflow-x-hidden">
                    {children}
                </main>
            </div>

            {/* Mobile sidebar overlay */}
            {sidebarOpen && (
                <div
                    className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40 lg:hidden"
                    onClick={() => setSidebarOpen(false)}
                />
            )}
        </div>
    );
}
