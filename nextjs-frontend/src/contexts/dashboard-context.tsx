"use client";

import React, { createContext, useContext, useState } from 'react';

interface DashboardContextType {
    isSidebarOpen: boolean;
    setSidebarOpen: (open: boolean) => void;
    toggleSidebar: () => void;
}

const DashboardContext = createContext<DashboardContextType | undefined>(undefined);

export function DashboardProvider({ children }: { children: React.ReactNode }) {
    const [isSidebarOpen, setSidebarOpen] = useState(false);

    const toggleSidebar = () => setSidebarOpen(prev => !prev);

    return (
        <DashboardContext.Provider value={{ isSidebarOpen, setSidebarOpen, toggleSidebar }}>
            {children}
        </DashboardContext.Provider>
    );
}

export function useDashboard() {
    const context = useContext(DashboardContext);
    if (context === undefined) {
        // Return a dummy context to prevent crashes on non-dashboard pages
        return {
            isSidebarOpen: false,
            setSidebarOpen: () => {},
            toggleSidebar: () => {}
        };
    }
    return context;
}
