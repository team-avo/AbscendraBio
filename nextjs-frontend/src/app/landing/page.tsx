"use client";

import { motion } from "motion/react";
import { HeroSection } from "@/components/landing/HeroSection";
import { ProductCarousel } from "@/components/landing/ProductCarousel";
import { WhyChooseUs } from "@/components/landing/WhyChooseUs";
import { TestimonialsSection } from "@/components/landing/TestimonialsSection";
import { Footer } from "@/components/landing/Footer";
import Image from "next/image";

export default function LandingPage() {
  return (
    <div className="force-light min-h-screen bg-white text-black">
      <motion.div
        className="fixed inset-0 pointer-events-none z-0"
        style={{
          background:
            "radial-gradient(circle at var(--mouse-x, 50%) var(--mouse-y, 50%), rgba(239, 68, 68, 0.02) 0%, transparent 50%)",
        }}
        onMouseMove={(e) => {
          const { clientX, clientY } = e;
          const x = (clientX / window.innerWidth) * 100;
          const y = (clientY / window.innerHeight) * 100;
          document.documentElement.style.setProperty("--mouse-x", `${x}%`);
          document.documentElement.style.setProperty("--mouse-y", `${y}%`);
        }}
      />

      <main>
        <HeroSection />
        <ProductCarousel />



        <WhyChooseUs />
        {/* TrendingProducts removed as requested */}
        <TestimonialsSection />
        <Footer />
      </main>



      {/* <motion.div
        className="fixed bottom-8 right-8 z-[70]"
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ delay: 2, duration: 0.5 }}
      >
        <motion.button
          className="relative w-16 h-16 rounded-full shadow-2xl flex items-center justify-center text-background bg-foreground hover:opacity-90 transition-all duration-300 group"
          whileHover={{ scale: 1.1, rotate: 5 }}
          whileTap={{ scale: 0.9 }}
        >
          <motion.span
            className="absolute inset-0 rounded-full"
            initial={{ scale: 1, opacity: 0.35 }}
            animate={{ scale: 1.6, opacity: 0 }}
            transition={{ duration: 1.6, repeat: Infinity, ease: "easeOut" }}
            style={{ boxShadow: "0 0 0 6px rgba(34, 197, 94, 0.35)" }}
          />
          <motion.span
            className="absolute inset-0 rounded-full"
            initial={{ scale: 1, opacity: 0.25 }}
            animate={{ scale: 2.1, opacity: 0 }}
            transition={{ duration: 2.4, repeat: Infinity, ease: "easeOut", delay: 0.3 }}
            style={{ boxShadow: "0 0 0 6px rgba(239, 68, 68, 0.28)" }}
          />
          <svg
            className="w-8 h-8 group-hover:scale-110 transition-transform duration-300"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
            />
          </svg>
        </motion.button>
      </motion.div> */}

      <style jsx>{`
        :root { --mouse-x: 50%; --mouse-y: 50%; }
      `}</style>
    </div>
  );
}


