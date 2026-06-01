import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ClipboardList, Send, Loader2, ChevronDown } from 'lucide-react';
import { useAuthStore } from '../../store/useAuthStore';
import { storefrontApi } from '../../utils/api';
import type { Category } from '../../types/storefront';
import { cn } from '../../utils/cn';

export const EnquiryModal: React.FC = () => {
  const { setShowLoyaltyModal } = useAuthStore();
  const [isOpen, setIsOpen] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [name, setName] = useState('');
  const [mobile, setMobile] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [dropdownOpen, setDropdownOpen] = useState(false);

  useEffect(() => {
    // 1. Fetch categories
    const fetchCategories = async () => {
      try {
        const data = await storefrontApi.categories();
        setCategories(data || []);
      } catch (err) {
        console.error('Failed to load categories for enquiry form:', err);
      }
    };
    fetchCategories();

    // 2. Check if already submitted or dismissed in current session
    const isSubmitted = localStorage.getItem('vaniki_enquiry_submitted') === 'true';
    const isDismissed = sessionStorage.getItem('vaniki_enquiry_dismissed') === 'true';

    if (!isSubmitted && !isDismissed) {
      // Open Enquiry Modal after 2 seconds
      const timer = setTimeout(() => {
        setIsOpen(true);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleDismiss = () => {
    sessionStorage.setItem('vaniki_enquiry_dismissed', 'true');
    setIsOpen(false);

    // After closing the enquiry modal, trigger Point Claim after a 10 second delay
    setTimeout(() => {
      // Double check if they didn't complete it in another tab/interaction
      if (localStorage.getItem('vaniki_enquiry_submitted') !== 'true') {
        setShowLoyaltyModal(true);
      }
    }, 10000);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!name.trim()) {
      setError('Please enter your name');
      return;
    }

    if (!mobile.trim() || mobile.trim().length < 10) {
      setError('Please enter a valid 10-digit mobile number');
      return;
    }

    if (!selectedCategory) {
      setError('Please select a category');
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await storefrontApi.submitEnquiry({
        name: name.trim(),
        mobile: mobile.trim(),
        category: selectedCategory,
      });

      if (response.success) {
        localStorage.setItem('vaniki_enquiry_submitted', 'true');
        setIsOpen(false);

        // Instantly trigger Point Claim popup as requested!
        setShowLoyaltyModal(true);
      } else {
        setError(response.message || 'Failed to submit enquiry');
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Something went wrong. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={handleDismiss}
          className="absolute inset-0 bg-emerald-950/60 backdrop-blur-sm"
        />

        {/* Modal Container */}
        <motion.div
          initial={{ scale: 0.9, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.9, opacity: 0, y: 20 }}
          className="relative w-full max-w-md overflow-hidden rounded-[2rem] border border-emerald-800/40 bg-[linear-gradient(135deg,_#09261a,_#020b08)] shadow-2xl text-white"
        >
          {/* Header Banner */}
          <div className="relative p-6 pb-4 flex flex-col items-center justify-center text-center border-b border-emerald-850/40">
            {/* Dismiss Button */}
            <button
              type="button"
              onClick={handleDismiss}
              className="absolute right-4 top-4 rounded-full bg-white/5 p-2 text-emerald-200/80 transition hover:bg-white/10 hover:text-white"
              aria-label="Close modal"
            >
              <X size={18} />
            </button>

            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500 text-white shadow-lg ring-4 ring-emerald-500/20">
              <ClipboardList size={22} />
            </div>
            
            <h2 className="text-xl font-black tracking-wide text-white">Quick Enquiry</h2>
            <p className="mt-1 text-xs font-semibold text-emerald-200/60">
              Share details so our agricultural experts can assist you better!
            </p>
          </div>

          {/* Form Content */}
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            {error && (
              <div className="rounded-xl bg-red-950/50 border border-red-900/50 px-4 py-2.5 text-xs font-bold text-red-300">
                {error}
              </div>
            )}

            <div>
              <label htmlFor="enquiry-name" className="block text-[10px] font-black uppercase tracking-[0.18em] text-emerald-400 mb-1.5">
                Full Name
              </label>
              <input
                id="enquiry-name"
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter your name"
                className="w-full rounded-xl border border-emerald-800/40 bg-emerald-950/20 px-4 py-3 text-sm text-white placeholder-emerald-100/20 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 transition"
              />
            </div>

            <div>
              <label htmlFor="enquiry-mobile" className="block text-[10px] font-black uppercase tracking-[0.18em] text-emerald-400 mb-1.5">
                Mobile Number
              </label>
              <input
                id="enquiry-mobile"
                type="tel"
                required
                maxLength={10}
                value={mobile}
                onChange={(e) => setMobile(e.target.value.replace(/\D/g, ''))}
                placeholder="Enter 10-digit mobile number"
                className="w-full rounded-xl border border-emerald-800/40 bg-emerald-950/20 px-4 py-3 text-sm text-white placeholder-emerald-100/20 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 transition"
              />
            </div>

            <div>
              <label className="block text-[10px] font-black uppercase tracking-[0.18em] text-emerald-400 mb-1.5">
                Category
              </label>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setDropdownOpen(!dropdownOpen)}
                  className="w-full text-left rounded-xl border border-emerald-800/40 bg-emerald-950/20 px-4 py-3 text-sm text-white focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 transition cursor-pointer flex items-center justify-between"
                >
                  <span className={selectedCategory ? "text-white font-semibold" : "text-emerald-100/30"}>
                    {selectedCategory || 'Select Category'}
                  </span>
                  <ChevronDown size={16} className={cn("text-emerald-400 transition-transform duration-200", dropdownOpen && "rotate-180")} />
                </button>

                <AnimatePresence>
                  {dropdownOpen && (
                    <>
                      <div className="fixed inset-0 z-10" onClick={() => setDropdownOpen(false)} />
                      <motion.div
                        initial={{ opacity: 0, y: -8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8 }}
                        className="absolute left-0 right-0 mt-1.5 z-20 max-h-56 overflow-y-auto rounded-xl border border-emerald-800/50 bg-[#061c14] py-1.5 shadow-2xl no-scrollbar"
                      >
                        {categories.map((category) => (
                          <button
                            key={category.id}
                            type="button"
                            onClick={() => {
                              setSelectedCategory(category.name);
                              setDropdownOpen(false);
                            }}
                            className={cn(
                              "w-full text-left px-4 py-2.5 text-sm transition-colors duration-150 font-bold",
                              selectedCategory === category.name
                                ? "bg-emerald-600/90 text-white"
                                : "text-emerald-100 hover:bg-emerald-950 hover:text-white"
                            )}
                          >
                            {category.name}
                          </button>
                        ))}
                      </motion.div>
                    </>
                  )}
                </AnimatePresence>
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="mt-6 w-full flex items-center justify-center gap-2 rounded-xl bg-emerald-500 py-4 text-xs font-black uppercase tracking-[0.2em] text-white shadow-lg shadow-emerald-500/20 transition hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  <span>Submitting...</span>
                </>
              ) : (
                <>
                  <Send size={14} />
                  <span>Submit Enquiry</span>
                </>
              )}
            </button>
          </form>

          {/* Footer Notice */}
          <div className="bg-emerald-950/40 p-4 border-t border-emerald-800/30 text-center">
            <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-emerald-200/30 leading-relaxed">
              * Your privacy is our priority. Submission unlocks instant reward chimes.
            </p>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
