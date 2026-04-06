"use client";

import { useEffect, useRef } from "react";
import { motion } from "motion/react";
import { Barlow } from "next/font/google";

const barlow = Barlow({ subsets: ["latin"], weight: ["400", "500", "600", "700", "800", "900"] });
import { Button } from "@/components/ui/button";
import ImageWithFallback from "./figma/ImageWithFallback";
import { Play, ArrowRight, Zap, Award, Globe } from "lucide-react";
import { useRouter } from "next/navigation";

export function HeroSection() {
  const router = useRouter();

  return (
    <section className="relative min-h-screen flex items-start justify-start overflow-hidden bg-background">
      <div className="absolute inset-0">
        <ImageWithFallback
          src="https://images.unsplash.com/photo-1717501218003-3c89682cfb3b?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxzY2llbnRpZmljJTIwbW9sZWN1bGUlMjBzdHJ1Y3R1cmUlMjBsYWJvcmF0b3J5fGVufDF8fHx8MTc1NTY3Njg2OHww&ixlib=rb-4.1.0&q=80&w=1080"
          alt="Molecular structure background"
          className="w-full h-full object-cover opacity-3"
        />
        <div className="absolute inset-0 bg-background/70" />
      </div>

      <div className="w-full px-6 pl-8 md:pl-16 relative z-10 flex items-center min-h-screen pt-1 pb-16">
        <motion.div
          initial={{ opacity: 0, x: -50 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 1, ease: "easeOut" }}
          className="space-y-10 text-left w-full lg:w-[55%] xl:w-[55%]"
        >
  

          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, delay: 0.4 }}
            className="space-y-6"
          >
            <h1 className={`text-6xl md:text-7xl lg:text-8xl font-black leading-[0.9] ${barlow.className}`}>
              <span className="lg:whitespace-nowrap">
                <span className="text-foreground lg:mr-4">Physician</span>
                <br className="lg:hidden" />
                <motion.span
                  className="inline text-foreground"
                  animate={{ backgroundPosition: ["0%", "100%", "0%"] }}
                  transition={{ duration: 3, repeat: Infinity }}
                  style={{ backgroundSize: "200% 200%" }}
                >
                   Grade
                </motion.span>
              </span>
              <br />
              <span className="text-foreground">Peptides</span>
            </h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.6 }}
              className="text-lg md:text-xl text-muted-foreground max-w-lg lg:max-w-none leading-relaxed"
            >
              Peptides made in America with the highest quality control standards possible.
            </motion.p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.8 }}
            className="flex flex-wrap items-center gap-6 lg:gap-8 justify-start"
          >
            {[
              { icon: Award, label: "99% purity, backed by COA's", color: "text-yellow-600" },
              { icon: Zap, label: "24hr Shipping", color: "text-green-600" },
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-card border border-border flex items-center justify-center shadow-sm">
                  <item.icon className={`w-5 h-5 ${item.color}`} />
                </div>
                <span className="text-base font-medium text-foreground">{item.label}</span>
              </div>
            ))}
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 1 }}
            className="flex flex-col sm:flex-row gap-4 justify-start pt-2"
          >
            <Button
              size="lg"
              className="relative px-10 py-5 text-lg bg-foreground text-background border-0 rounded-full shadow-2xl hover:opacity-90 transition-all duration-300 group overflow-hidden font-semibold" 
              onClick={() => router.push("/landing/products")}
            >
              <span className="relative z-10 flex items-center gap-3">
                Shop Now
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform duration-300" />
              </span>
            </Button>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 1.2 }}
            className="flex flex-wrap items-center gap-8 lg:gap-12 justify-start pt-4"
          >
            {[
              { value: "30+", label: "Peptides" },
              { value: "100+", label: "Doctors" },
            ].map((stat, i) => (
              <div key={i} className="text-left">
                <motion.div
                  className="text-4xl font-bold text-foreground"
                  animate={{ scale: [1, 1.05, 1] }}
                  transition={{ duration: 2, repeat: Infinity, delay: i * 0.3 }}
                >
                  {stat.value}
                </motion.div>
                <div className="text-base text-muted-foreground font-medium">{stat.label}</div>
              </div>
            ))}
          </motion.div>
        </motion.div>

        {/* Right side constellation animation (desktop only) */}
        <div className="hidden lg:flex w-[45%] items-center justify-center relative min-h-[520px] z-0 overflow-hidden">
          <ConstellationCanvas />
        </div>
      </div>
    </section>
  );
}

export default HeroSection;

function ConstellationCanvas() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let rafId = 0;
    const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
    const formulas = [
      "C₄₃H₆₆N₁₂O₁₂S₂",
      "Phe-Val-Asn-Gln",
      "Gly-Pro-Lys",
      "Ala-Gly-Ser",
      "Arg-Lys",
      "C₅₀H₇₉N₁₃O₁₅",
    ];
    // Match hero heading accent colors: red and green
    const palette = [
      { hex: "#ef4444", rgba: [239, 68, 68] as [number, number, number] }, // red-500
      { hex: "#22c55e", rgba: [34, 197, 94] as [number, number, number] },  // green-500
    ];

    const clamp = (v: number, min: number, max: number) => (v < min ? min : v > max ? max : v);

    const state = {
      width: 0,
      height: 0,
      nodes: [] as any[],
    };

    const resize = () => {
      const parent = canvas.parentElement;
      if (!parent) return;
      const rect = parent.getBoundingClientRect();
      state.width = Math.floor(rect.width);
      state.height = Math.floor(rect.height);
      canvas.width = Math.floor(state.width * dpr);
      canvas.height = Math.floor(state.height * dpr);
      canvas.style.width = `${state.width}px`;
      canvas.style.height = `${state.height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      // Reinitialize nodes based on area for consistent density
      const area = state.width * state.height;
      const density = 1 / 12000; // nodes per px^2
      const targetCount = Math.max(12, Math.min(60, Math.floor(area * density)));
      const labelChance = 0.25;
      const padding = 24;
      state.nodes = Array.from({ length: targetCount }, () => {
        const hasLabel = Math.random() < labelChance;
        const label = hasLabel ? formulas[Math.floor(Math.random() * formulas.length)] : null;
        const offsetMag = 14 + Math.random() * 12;
        const angle = Math.random() * Math.PI * 2;
        return {
          x: padding + Math.random() * Math.max(1, state.width - padding * 2),
          y: padding + Math.random() * Math.max(1, state.height - padding * 2),
          vx: (Math.random() - 0.5) * 0.6,
          vy: (Math.random() - 0.5) * 0.6,
          label,
          labelOffsetX: Math.cos(angle) * offsetMag,
          labelOffsetY: Math.sin(angle) * offsetMag,
          labelPhase: Math.random() * Math.PI * 2,
          color: palette[Math.floor(Math.random() * palette.length)],
        };
      });
    };

    const padding = 24; // keep animation inside visible window
    const labelMargin = 14;
    const lineMaxDist = 160; // px
    const labelTextColor = "#000000"; // solid black labels (per request)
    const start = performance.now();
    const loadingDurationSec = 1.6; // reveal duration for dots and lines

    const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

    const drawPill = (x: number, y: number, text: string) => {
      // Render label as plain text (no background), centered at (x,y)
      ctx.font = "13px ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto";
      ctx.fillStyle = labelTextColor as any;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(text, x, y);
    };

    const step = () => {
      const time = (performance.now() - start) / 1000;
      const reveal = easeOutCubic(Math.min(1, time / loadingDurationSec));
      const { width, height, nodes } = state;
      ctx.clearRect(0, 0, width, height);

      // Update positions with gentle motion and bounce within padded bounds
      for (const n of nodes) {
        n.x += n.vx;
        n.y += n.vy;
        if (n.x < padding) { n.x = padding; n.vx *= -1; }
        if (n.x > width - padding) { n.x = width - padding; n.vx *= -1; }
        if (n.y < padding) { n.y = padding; n.vy *= -1; }
        if (n.y > height - padding) { n.y = height - padding; n.vy *= -1; }
      }

      // Draw lines based on distance (blend red/green between nodes)
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const dx = nodes[i].x - nodes[j].x;
          const dy = nodes[i].y - nodes[j].y;
          const dist = Math.hypot(dx, dy);
          if (dist < lineMaxDist) {
            const t = 1 - dist / lineMaxDist; // closeness factor
            const alpha = (0.12 + t * 0.38) * reveal; // fade-in during loading
            const grad = ctx.createLinearGradient(nodes[i].x, nodes[i].y, nodes[j].x, nodes[j].y);
            const [r1, g1, b1] = nodes[i].color.rgba;
            const [r2, g2, b2] = nodes[j].color.rgba;
            grad.addColorStop(0, `rgba(${r1}, ${g1}, ${b1}, ${alpha})`);
            grad.addColorStop(1, `rgba(${r2}, ${g2}, ${b2}, ${alpha})`);
            ctx.strokeStyle = grad as any;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(nodes[i].x, nodes[i].y);
            // During loading, draw partial line that grows towards the target
            const x2 = nodes[i].x + (nodes[j].x - nodes[i].x) * reveal;
            const y2 = nodes[i].y + (nodes[j].y - nodes[i].y) * reveal;
            ctx.lineTo(x2, y2);
            ctx.stroke();
          }
        }
      }

      // Draw dots on top
      (ctx as any).globalAlpha = 1;
      for (let idx = 0; idx < nodes.length; idx++) {
        const n = nodes[idx];
        const r = 2.2 * (0.6 + 0.4 * reveal); // grow-in
        ctx.fillStyle = n.color.hex as any;
        ctx.beginPath();
        ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
        ctx.fill();

        // Subtle sparkle during reveal
        if (reveal < 1) {
          const sparkle = Math.max(0, Math.sin(time * 5 + idx * 0.7));
          if (sparkle > 0.85) {
            ctx.strokeStyle = `rgba(255,255,255,${(sparkle - 0.85) * 3})` as any;
            ctx.lineWidth = 0.8;
            ctx.beginPath();
            ctx.arc(n.x, n.y, r + 2 + sparkle * 3, 0, Math.PI * 2);
            ctx.stroke();
          }
        }

        if (n.label) {
          const bob = Math.sin(time * 1.6 + n.labelPhase) * 2;
          const lx = clamp(n.x + n.labelOffsetX, padding + labelMargin, width - padding - labelMargin);
          const ly = clamp(n.y + n.labelOffsetY + bob, padding + labelMargin, height - padding - labelMargin);
          drawPill(lx, ly, n.label);
        }
      }

      rafId = requestAnimationFrame(step);
    };

    resize();
    rafId = requestAnimationFrame(step);
    const onResize = () => resize();
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      cancelAnimationFrame(rafId);
    };
  }, []);

  return (
    <div className="relative w-[70%] mx-auto h-[420px] md:h-[480px] lg:h-[520px] xl:h-[560px] pointer-events-none">
      <canvas ref={canvasRef} className="w-full h-full" aria-hidden="true" />
    </div>
  );
}