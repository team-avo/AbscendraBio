"use client";

import React from "react";

export default function LandingProductsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="force-light min-h-screen bg-[#F7F9FC] text-black" suppressHydrationWarning>
      {children}
    </div>
  );
}


