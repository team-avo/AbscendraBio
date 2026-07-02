"use client";

import React, { useEffect } from "react";
import "../landing/theme.css";

export default function BlueLandingLayout({ children }: { children: React.ReactNode }) {
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
        document.body.style.color = "#10233b";
      }
    } catch { }
  }, []);
  return (
    <div className="force-light min-h-screen bg-white text-ink landing-theme pt-20 sm:pt-28" suppressHydrationWarning>
      {children}
    </div>
  );
}
