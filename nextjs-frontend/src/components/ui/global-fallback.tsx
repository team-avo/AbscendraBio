"use client";

import React from "react";

export default function GlobalFallback() {
  return (
    <div className="flex items-center justify-center min-h-[40vh]">
      <div className="flex items-center gap-3 text-sm text-muted-foreground">
        <span className="inline-block h-5 w-5 rounded-full border-2 border-current border-r-transparent animate-spin" />
        Loading…
      </div>
    </div>
  );
}


