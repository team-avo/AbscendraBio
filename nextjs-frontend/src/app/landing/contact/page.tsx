"use client";

import Link from "next/link";
import { Barlow } from "next/font/google";
import { useState } from "react";
import { API_BASE_URL } from "@/lib/env";
import { ArrowRight } from "lucide-react";

const barlow = Barlow({ subsets: ["latin"], weight: ["400", "500", "600", "700", "800", "900"] });

export default function ContactPage() {
  const [form, setForm] = useState({ name: "", email: "", phone: "", message: "" });
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setStatus("idle");
    try {
      const res = await fetch(`${API_BASE_URL}/send-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error("Failed");
      setStatus("success");
      setForm({ name: "", email: "", phone: "", message: "" });
    } catch {
      setStatus("error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className={`min-h-screen bg-white ${barlow.className}`}>
      {/* Hero */}
      <div className="bg-[#070B14] text-white py-24 px-6">
        <div className="max-w-3xl mx-auto">
          <Link href="/" className="text-[11px] font-bold uppercase tracking-widest text-[#4D7DF2] hover:underline mb-8 block">
            ← Back to Home
          </Link>
          <div className="flex items-center gap-3 mb-6">
            <span className="w-8 h-[1px] bg-[#4D7DF2]" />
            <span className="text-[10px] font-bold tracking-[0.3em] text-[#4D7DF2] uppercase">Clinical Inquiry</span>
          </div>
          <h1 className="text-5xl font-black tracking-tight mb-4">Contact Us</h1>
          <p className="text-lg text-gray-300">Submit a clinical inquiry and our team will respond within 24 hours.</p>
        </div>
      </div>

      {/* Form */}
      <div className="max-w-2xl mx-auto px-6 py-16">
        {status === "success" ? (
          <div className="text-center py-16">
            <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-2xl font-black text-[#070B14] mb-2">Message Sent</h2>
            <p className="text-gray-500 mb-8">We'll get back to you within 24 hours.</p>
            <button
              onClick={() => setStatus("idle")}
              className="text-[#4D7DF2] font-bold text-sm hover:underline"
            >
              Send another message
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-xs font-bold uppercase tracking-widest text-gray-500 mb-2">Name</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                placeholder="Dr. Jane Smith"
                className="w-full px-5 py-4 bg-gray-50 border border-gray-200 rounded-xl text-sm text-[#070B14] placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#4D7DF2]/20 focus:border-[#4D7DF2] transition-all"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-gray-500 mb-2">
                  Email <span className="text-[#4D7DF2]">*</span>
                </label>
                <input
                  type="email"
                  required
                  value={form.email}
                  onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
                  placeholder="email@clinic.com"
                  className="w-full px-5 py-4 bg-gray-50 border border-gray-200 rounded-xl text-sm text-[#070B14] placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#4D7DF2]/20 focus:border-[#4D7DF2] transition-all"
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-gray-500 mb-2">Phone</label>
                <input
                  type="tel"
                  value={form.phone}
                  onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
                  placeholder="+1 (555) 000-0000"
                  className="w-full px-5 py-4 bg-gray-50 border border-gray-200 rounded-xl text-sm text-[#070B14] placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#4D7DF2]/20 focus:border-[#4D7DF2] transition-all"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-widest text-gray-500 mb-2">
                Message <span className="text-[#4D7DF2]">*</span>
              </label>
              <textarea
                required
                value={form.message}
                onChange={(e) => setForm((p) => ({ ...p, message: e.target.value }))}
                placeholder="Tell us about your practice and peptide research needs..."
                rows={5}
                className="w-full px-5 py-4 bg-gray-50 border border-gray-200 rounded-xl text-sm text-[#070B14] placeholder-gray-400 resize-none focus:outline-none focus:ring-2 focus:ring-[#4D7DF2]/20 focus:border-[#4D7DF2] transition-all"
              />
            </div>
            {status === "error" && (
              <p className="text-red-500 text-sm font-medium">Failed to send. Please try again.</p>
            )}
            <button
              type="submit"
              disabled={submitting}
              className="flex items-center gap-3 bg-[#4D7DF2] hover:bg-[#3D6DE2] disabled:opacity-50 text-white px-8 py-4 rounded-xl text-sm font-bold tracking-wide transition-all cursor-pointer"
            >
              {submitting ? "Sending..." : "Submit Inquiry"}
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
