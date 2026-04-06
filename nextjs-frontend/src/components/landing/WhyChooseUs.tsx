"use client";

import { motion } from "motion/react";
import { Award, Globe, Shield, Zap } from "lucide-react";
import { Barlow } from "next/font/google";

const barlow = Barlow({ subsets: ["latin"], weight: ["400", "500", "600", "700", "800", "900"] });

const features = [
  { icon: Award, title: "99%+ Purity", description: "All peptides show 99%+ purity, reflected on our COA’s", gradient: "from-yellow-400 to-orange-500" },
  // { icon: Shield, title: "Pharmaceutical-grade peptides", description: "Manufactured in the USA for human consumption- these are NOT research grade peptiedes", gradient: "from-blue-400 to-purple-500" },
  { icon: Globe, title: "Rapid turnaround time", description: "Overnight shipping available on every order", gradient: "from-green-400 to-blue-500" },
  { icon: Zap, title: "Tested & Verified", description: "Endotoxicity, Net Peptide content and Sterility are also tested", gradient: "from-red-400 to-pink-500" },
];

export function WhyChooseUs() {
  return (
    <section className="py-20 bg-background relative overflow-hidden" suppressHydrationWarning>
      <div className="absolute inset-0" />

      <div className="max-w-7xl mx-auto px-6 relative z-10">
        <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} transition={{ duration: 0.8 }} className="text-center mb-16">
          <h2 className={`text-5xl font-bold text-foreground mb-4 ${barlow.className}`}>Why Choose Our Peptides?</h2>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-3 gap-8 justify-items-center max-w-5xl mx-auto">
          {features.map((feature, index) => (
            <motion.div key={index} initial={{ opacity: 0, y: 50 }} whileInView={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: index * 0.1 }} whileHover={{ y: -10, scale: 1.02 }} className="group relative">
              <div className="relative backdrop-blur-lg bg-card/50 border border-border rounded-3xl p-8 h-full transition-all duration-300 group-hover:border-border/50 group-hover:shadow-2xl overflow-hidden">
                <div className="absolute inset-0 opacity-0 group-hover:opacity-5 transition-opacity duration-300 bg-foreground" />
                <div className="relative mb-6">
                  <div className="w-20 h-20 mx-auto rounded-2xl bg-card border border-border p-5 relative overflow-hidden group-hover:shadow-lg transition-all duration-300">
                    <feature.icon className="w-full h-full text-foreground relative z-10" />
                  </div>
                </div>
                <div className="text-center relative z-10">
                  <h3 className={`text-xl font-bold text-foreground mb-3 transition-all duration-300 ${barlow.className}`}>{feature.title}</h3>
                  <p className="text-muted-foreground group-hover:text-foreground/80 transition-colors duration-300">{feature.description}</p>
                </div>
                <div className="absolute inset-0 opacity-0 group-hover:opacity-5 pointer-events-none" style={{ background: "repeating-linear-gradient(90deg, transparent, transparent 2px, rgba(0, 0, 0, 0.1) 2px, rgba(0, 0, 0, 0.1) 4px)" }} />
              </div>
              <div className="absolute inset-0 rounded-3xl opacity-0 group-hover:opacity-5 transition-opacity duration-300 pointer-events-none bg-foreground" />
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

export default WhyChooseUs;


