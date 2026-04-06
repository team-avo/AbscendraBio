'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/auth-context';
import { API_BASE_URL } from '@/lib/env';
import logger from '@/lib/logger';

export default function CentreResearchHome() {
  const { isAuthenticated, user } = useAuth?.() || ({} as any);
  const [isContactOpen, setIsContactOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    message: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionStatus, setSubmissionStatus] = useState<'success' | 'error' | null>(null);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmissionStatus(null);

    try {
      const response = await fetch(`${API_BASE_URL}/send-email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        throw new Error('Failed to send message');
      }

      setSubmissionStatus('success');
      setTimeout(() => {
        setIsContactOpen(false);
        setFormData({ name: '', email: '', phone: '', message: '' });
        setSubmissionStatus(null);
      }, 2000);
    } catch (error) {
      logger.error("Failed to send message", { error: error });
      setSubmissionStatus('error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-white font-sans relative">
      {/* Header */}
      <header className="absolute top-0 right-0 p-4 md:p-8 z-10">
        <nav className="hidden md:flex items-center gap-4 md:gap-8">
          {isAuthenticated && (
            <Link
              href="/landing/products"
              className="text-black tracking-wide text-xs md:text-[15px] font-bold hover:opacity-75 transition-opacity bg-transparent border-none cursor-pointer md:-mt-3 md:ml-1"
            >
              PRODUCTS
            </Link>
          )}

          {!isAuthenticated && (
            <>
              <Link
                href="/login"
                className="text-[#3FA9F5] tracking-wide text-xs md:text-[15px] font-bold hover:opacity-75 transition-opacity bg-transparent border-none cursor-pointer md:-mt-3 md:ml-1"
              >
                LOGIN
              </Link>
              <Link
                href="/admin/login"
                className="text-[#3FA9F5] tracking-wide text-xs md:text-[15px] font-bold hover:opacity-75 transition-opacity bg-transparent border-none cursor-pointer md:-mt-3 md:ml-1"
              >
                ADMIN LOGIN
              </Link>
              <Link
                href="/login?tab=signup"
                className="text-[#3FA9F5] tracking-wide text-xs md:text-[15px] font-bold hover:opacity-75 transition-opacity bg-transparent border-none cursor-pointer md:-mt-3 md:ml-1"
              >
                SIGN UP
              </Link>
            </>
          )}

          <button
            onClick={() => setIsContactOpen(true)}
            className="text-black tracking-wide text-xs md:text-[16px] font-bold hover:opacity-75 transition-opacity bg-transparent border-none cursor-pointer md:-mt-3 md:ml-1"
          >
            INQUIRE
          </button>
        </nav>
      </header>

      {/* Main Content */}
      <main className="flex-grow flex items-center justify-center p-4 sm:p-6 md:p-8 relative">

        {/* Center Logo Container */}
        <div className="absolute inset-0 flex justify-center items-start pt-[18vh] sm:items-center sm:pt-0">
          <div className="relative w-[95vw] h-[40vh] sm:w-[600px] sm:h-[180px] md:w-[800px] md:h-[240px] lg:w-[1000px] lg:h-[300px] xl:w-[1200px] xl:h-[360px] flex items-center justify-center">
            <img
              src="/logo.png"
              alt="CENTRE LABS"
              className="w-full h-full object-contain"
            />
          </div>
        </div>

        {/* Tagline - Mobile */}
        <div className="md:hidden absolute bottom-24 left-4 right-4 z-30">
          <p className="text-left text-gray-800 font-light leading-snug mb-12" style={{
            fontFamily: 'Barlow',
            fontWeight: 300,
            fontStyle: 'normal',
            fontSize: '27px',
            lineHeight: '1.2',
            letterSpacing: '0%'
          }}>
            Providing science backed solutions for medical providers.
          </p>
          {/* Mobile bottom row: PRODUCTS | LOGIN | INQUIRE | SIGN UP (or PRODUCTS | INQUIRE if logged in) */}
          <div className="flex items-center justify-center gap-4">
            {!isAuthenticated ? (
              <>
                <Link
                  href="/login"
                  className="text-[#3FA9F5] tracking-wide text-sm font-bold hover:opacity-75 transition-opacity bg-transparent border-none cursor-pointer font-barlow"
                >
                  LOGIN
                </Link>

                <Link
                  href="/admin/login"
                  className="text-[#3FA9F5] tracking-wide text-sm font-bold hover:opacity-75 transition-opacity bg-transparent border-none cursor-pointer font-barlow"
                >
                  ADMIN LOGIN
                </Link>

                <button
                  onClick={() => setIsContactOpen(true)}
                  className="text-black tracking-wide text-sm font-bold hover:opacity-75 transition-opacity bg-transparent border-none cursor-pointer font-barlow"
                >
                  INQUIRE
                </button>

                <Link
                  href="/login?tab=signup"
                  className="text-[#3FA9F5] tracking-wide text-sm font-bold hover:opacity-75 transition-opacity bg-transparent border-none cursor-pointer font-barlow"
                >
                  SIGN UP
                </Link>
              </>
            ) : (
              <>
                <Link
                  href="/landing/products"
                  className="text-[#3FA9F5] tracking-wide text-sm font-bold hover:opacity-75 transition-opacity bg-transparent border-none cursor-pointer font-barlow"
                >
                  PRODUCTS
                </Link>

                <button
                  onClick={() => setIsContactOpen(true)}
                  className="text-black tracking-wide text-sm font-bold hover:opacity-75 transition-opacity bg-transparent border-none cursor-pointer font-barlow"
                >
                  INQUIRE
                </button>
              </>
            )}
          </div>
        </div>

      </main>

      {/* Tagline at bottom - Desktop only */}
      <footer className="hidden md:block pb-8 -mt-1 pt-3 px-8">
        <div className="text-left w-full mx-auto max-w-7xl">
          <p className="text-[20px] lg:text-[22px] xl:text-[26px] 2xl:text-[32px] text-gray-800 font-light leading-snug m-0 px-2">
            Providing science backed solutions for medical providers.
          </p>
        </div>
      </footer>

      {/* Contact Dialog */}
      {isContactOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999] p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-[509px] mx-4">
            {/* Dialog Header */}
            <div className="flex justify-between items-center px-4 pt-4 pb-2">
              <h2 className="text-2xl font-medium text-black">Contact us</h2>
              <button
                onClick={() => setIsContactOpen(false)}
                className="text-gray-500 hover:text-gray-700 text-2xl font-bold bg-transparent border-none cursor-pointer"
              >
                ×
              </button>
            </div>

            {/* Dialog Content */}
            <div className="px-4 pt-2 pb-4">
              <form onSubmit={handleSubmit} className="space-y-3">
                {/* Name Field */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Name
                  </label>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    placeholder="Full Name"
                    className="w-full px-3 py-2 border border-black rounded focus:outline-none focus:ring-1 focus:ring-black"
                  />
                </div>

                {/* Email and Phone Row */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Email <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="email"
                      name="email"
                      value={formData.email}
                      onChange={handleInputChange}
                      placeholder="Email"
                      required
                      className="w-full px-3 py-2 border border-black rounded focus:outline-none focus:ring-1 focus:ring-black"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Phone
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-2 text-red-500">📞</span>
                      <input
                        type="tel"
                        name="phone"
                        value={formData.phone}
                        onChange={handleInputChange}
                        placeholder="Phone"
                        className="w-full pl-10 pr-3 py-2 border border-black rounded focus:outline-none focus:ring-1 focus:ring-black"
                      />
                    </div>
                  </div>
                </div>

                {/* Message Field */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Message <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    name="message"
                    value={formData.message}
                    onChange={handleInputChange}
                    placeholder="Message"
                    required
                    rows={3}
                    className="w-full px-3 py-2 border border-black rounded focus:outline-none focus:ring-1 focus:ring-black resize-vertical"
                  ></textarea>
                </div>

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full bg-blue-500 text-white py-3 px-4 rounded-md hover:bg-blue-600 transition-colors font-medium disabled:bg-gray-400"
                >
                  {isSubmitting ? 'Submitting...' : 'Submit'}
                </button>

                {submissionStatus === 'success' && (
                  <p className="text-green-600 text-center">Thanks for submitting - you will receive an email with your login credentials shortly.</p>
                )}
                {submissionStatus === 'error' && (
                  <p className="text-red-500 text-center">Failed to send message. Please try again.</p>
                )}
              </form>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
