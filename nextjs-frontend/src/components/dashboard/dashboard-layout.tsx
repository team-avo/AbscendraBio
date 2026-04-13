"use client";

import { DashboardSidebar } from "./dashboard-sidebar";
import { DashboardHeader } from "./dashboard-header";
import { cn } from "@/lib/utils";
import { useDashboard } from "@/contexts/dashboard-context";

interface DashboardLayoutProps {
    children: React.ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
    const { isSidebarOpen, setSidebarOpen } = useDashboard();

    return (
        <div className="min-h-screen bg-slate-50 flex overflow-x-hidden">
            {/* Sidebar */}
            <DashboardSidebar open={isSidebarOpen} onOpenChange={setSidebarOpen} />

            {/* Main column */}
            <div className={cn(
                "flex-1 flex flex-col min-h-screen max-w-full transition-all duration-300 ease-in-out",
                "lg:pl-72"
            )}>
                {/* Sticky top header */}
                <DashboardHeader />

                {/* Page content */}
                <main className="flex-1 p-4 sm:p-6 lg:p-8 w-full max-w-full overflow-x-hidden">
                    {children}
                </main>
            </div>

            {/* Mobile sidebar overlay */}
            {isSidebarOpen && (
                <div
                    className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40 lg:hidden"
                    onClick={() => setSidebarOpen(false)}
                />
            )}
        </div>
    );
}
