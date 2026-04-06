"use client";

import React from "react";

export default function LandingProductsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="force-light min-h-screen bg-white text-black" suppressHydrationWarning>
      {children}
    </div>
  );
}


