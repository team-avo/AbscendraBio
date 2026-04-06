"use client";

import Link from "next/link";

export function AnnouncementBanner() {

  return (
    <div className="sticky top-0 z-50 w-full bg-black text-white">
      <style>{`
        @keyframes depthPulse {
          0%, 100% {
            transform: scale(1);
            opacity: 1;
          }
          50% {
            transform: scale(1.08);
            opacity: 0.85;
          }
        }
        .animate-depth-pulse {
          animation: depthPulse 2s ease-in-out infinite;
        }
      `}</style>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-8 py-2 sm:py-3">
          <span className="text-sm sm:text-sm font-semibold text-center animate-depth-pulse">
            Exclusive Black Friday Sale - Get 15% Flat On All Orders
          </span>
          <Link
            href="/landing/products"
            className="flex-shrink-0 px-2.5 py-1 sm:px-3 sm:py-1.5 bg-white text-black rounded text-xs font-semibold hover:bg-gray-100 transition-colors duration-200 whitespace-nowrap"
          >
            Shop Now
          </Link>
        </div>
      </div>
    </div>
  );
}
