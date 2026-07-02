'use client';

import { motion } from 'motion/react';
import { useEffect, useState } from 'react';

type Particle = {
  id: number;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  duration: number;
  delay: number;
};

export function HeroBackground() {
  // Generate the random particle motion values on the client only, after mount.
  // The server and the first client render both output no particles, so the
  // markup matches and there is no React hydration mismatch. The animated
  // particles then fade in once the effect runs.
  const [particles, setParticles] = useState<Particle[]>([]);

  useEffect(() => {
    setParticles(
      Array.from({ length: 8 }, (_, i) => ({
        id: i,
        startX: Math.random() * 100,
        startY: Math.random() * 100,
        endX: Math.random() * 100,
        endY: Math.random() * 100,
        duration: 25 + Math.random() * 15,
        delay: i * 1.5,
      }))
    );
  }, []);

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
          background: "radial-gradient(circle at 10% 20%, #5A9ADA 0%, transparent 50%), radial-gradient(circle at 90% 80%, #a9cbeb 0%, transparent 50%)",
          backgroundSize: "150% 150%"
        }}
      />

      {/* Dynamic Molecular Particles (client-only to avoid hydration mismatch) */}
      {particles.map((p) => (
        <motion.div
          key={p.id}
          initial={{
            x: `${p.startX}%`,
            y: `${p.startY}%`,
            opacity: 0
          }}
          animate={{
            x: [null, `${p.endX}%`],
            y: [null, `${p.endY}%`],
            opacity: [0, 0.2, 0],
            rotate: [0, 360],
            scale: [0.5, 1.5, 0.5]
          }}
          transition={{
            duration: p.duration,
            repeat: Infinity,
            ease: "linear",
            delay: p.delay
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
