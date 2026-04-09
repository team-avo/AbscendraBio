'use client';

import { motion } from 'motion/react';

export function HeroBackground() {
  return (
    <div className="absolute inset-0 z-0 pointer-events-none bg-[#F9FBFF]">
      {/* Moving Gradient Video-Effect */}
      <motion.div 
        animate={{ 
          backgroundPosition: ["0% 0%", "100% 100%"]
        }}
        transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
        className="absolute inset-0 opacity-40 blur-[120px]"
        style={{ 
          background: "radial-gradient(circle at 10% 20%, #4D7DF2 0%, transparent 50%), radial-gradient(circle at 90% 80%, #7EB3D8 0%, transparent 50%)",
          backgroundSize: "150% 150%"
        }}
      />

      {/* Dynamic Molecular Particles */}
      {[...Array(8)].map((_, i) => (
        <motion.div
          key={i}
          initial={{ 
            x: Math.random() * 100 + "%", 
            y: Math.random() * 100 + "%",
            opacity: 0 
          }}
          animate={{ 
            x: [null, Math.random() * 100 + "%"],
            y: [null, Math.random() * 100 + "%"],
            opacity: [0, 0.2, 0],
            rotate: [0, 360],
            scale: [0.5, 1.5, 0.5]
          }}
          transition={{ 
            duration: 25 + Math.random() * 15, 
            repeat: Infinity, 
            ease: "linear",
            delay: i * 1.5
          }}
          className="absolute w-32 h-32 sm:w-64 sm:h-64"
        >
          <svg viewBox="0 0 100 100" className="w-full h-full text-blue-500/10 fill-current">
            <circle cx="50" cy="30" r="8" />
            <circle cx="30" cy="70" r="8" />
            <circle cx="70" cy="70" r="8" />
            <path d="M50 30 L30 70 M50 30 L70 70 M30 70 L70 70" stroke="currentColor" strokeWidth="1" fill="none" />
          </svg>
        </motion.div>
      ))}
    </div>
  );
}
