"use client";

import React from "react";
import { useEffect } from "react";
import "./theme.css";
import { ProtectedRoute } from "@/contexts/auth-context";

export default function LandingLayout({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    try {
      const root = document.documentElement;
      root.classList.remove("dark");
      root.setAttribute("data-theme", "light");
      root.style.backgroundColor = "#ffffff";
      if (document.body) {
        document.body.classList.remove("dark");
        document.body.setAttribute("data-theme", "light");
        document.body.style.backgroundColor = "#ffffff";
        document.body.style.color = "#000000";
      }
    } catch { }
  }, []);
  return (
    <ProtectedRoute>
      <div className="force-light min-h-screen bg-white text-black landing-theme" suppressHydrationWarning>
        {children}
      </div>
    </ProtectedRoute>
  );
}


