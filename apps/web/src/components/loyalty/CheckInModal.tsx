import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Star, CheckCircle2 } from 'lucide-react';
import { useAuthStore } from '../../store/useAuthStore';
import { storefrontApi } from '../../utils/api';
import { cn } from '../../utils/cn';

export const CheckInModal: React.FC = () => {
  const { user, isAuthenticated, updateUser } = useAuthStore();
  const [isOpen, setIsOpen] = useState(false);
  const [isClaiming, setIsClaiming] = useState(false);
  const [isClaimed, setIsClaimed] = useState(false);

  useEffect(() => {
    if (!isAuthenticated || !user) return;

    const today = new Date().toISOString().split('T')[0];
    const lastCheckIn = user.lastCheckIn ? user.lastCheckIn.split('T')[0] : '';

    if (lastCheckIn !== today) {
      // Small delay to ensure layout is ready
      const timer = setTimeout(() => setIsOpen(true), 1500);
      return () => clearTimeout(timer);
    }
  }, [isAuthenticated, user]);

  const handleClaim = async () => {
    setIsClaiming(true);
    try {
      const response = await storefrontApi.dailyCheckIn();
      if (response.success) {
        updateUser({
          loyaltyPoints: response.data.loyaltyPoints,
          checkInHistory: response.data.checkInHistory,
          lastCheckIn: new Date().toISOString(),
        });
        setIsClaimed(true);
        setTimeout(() => {
          setIsOpen(false);
        }, 2000);
      }
    } catch (error) {
      console.error('Check-in failed:', error);
    } finally {
      setIsClaiming(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => setIsOpen(false)}
          className="absolute inset-0 bg-primary-900/40 backdrop-blur-md"
        />

        <motion.div
          initial={{ scale: 0.9, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.9, opacity: 0, y: 20 }}
          className="relative w-full max-w-lg overflow-hidden rounded-[2.5rem] border border-white/20 bg-white shadow-2xl"
        >
          {/* Header Image/Background */}
          <div className="relative h-40 bg-gradient-to-br from-primary-600 to-primary-800">
            <div className="absolute inset-0 opacity-10">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_120%,rgba(255,255,255,1),transparent)]" />
            </div>
            
            <button
              onClick={() => setIsOpen(false)}
              className="absolute right-4 top-4 rounded-full bg-white/20 p-2 text-white transition hover:bg-white/30"
            >
              <X size={20} />
            </button>

            <div className="flex h-full flex-col items-center justify-center text-center">
              <motion.div
                animate={{ rotate: [0, -10, 10, -10, 10, 0] }}
                transition={{ duration: 0.5, delay: 0.5, repeat: Infinity, repeatDelay: 3 }}
                className="mb-3 flex h-16 w-16 items-center justify-center rounded-2xl bg-white shadow-lg"
              >
                <img src="/coin.png" alt="Loyalty" className="h-10 w-10" />
              </motion.div>
              <h2 className="text-2xl font-black text-white">Daily Rewards</h2>
              <p className="text-sm font-bold text-white/80">Collect points every day!</p>
            </div>
          </div>

          <div className="p-6 sm:p-8">
            <div className="mb-6 flex items-center justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.2em] text-primary-500">Weekly Progress</p>
                <h3 className="mt-1 text-lg font-black text-slate-900">Your Streak</h3>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-50 text-amber-600">
                <Star size={20} fill="currentColor" />
              </div>
            </div>

            <div className="grid grid-cols-7 gap-2">
              {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((day, i) => {
                const isToday = i === (new Date().getDay() + 6) % 7; // Adjusted for Monday start
                return (
                  <div key={i} className="flex flex-col items-center gap-2">
                    <div
                      className={cn(
                        "flex h-10 w-10 items-center justify-center rounded-xl border-2 transition",
                        isToday 
                          ? "border-primary bg-primary-50 text-primary animate-pulse" 
                          : "border-slate-100 bg-slate-50 text-slate-400"
                      )}
                    >
                      {i < 3 ? <CheckCircle2 size={16} className="text-emerald-500" /> : <span className="text-xs font-black">{day}</span>}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-8">
              {!isClaimed ? (
                <button
                  onClick={handleClaim}
                  disabled={isClaiming}
                  className="group relative w-full overflow-hidden rounded-[1.5rem] bg-primary-900 py-4 text-sm font-black uppercase tracking-[0.2em] text-white shadow-lg shadow-primary-900/20 transition hover:-translate-y-1 hover:bg-primary"
                >
                  <span className="relative z-10 flex items-center justify-center gap-2">
                    {isClaiming ? 'Claiming...' : 'Claim 1 Point'}
                  </span>
                  <div className="absolute inset-0 z-0 bg-gradient-to-r from-transparent via-white/10 to-transparent transition-transform duration-1000 group-hover:translate-x-full" />
                </button>
              ) : (
                <motion.div
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="flex flex-col items-center justify-center gap-3 rounded-[1.5rem] bg-emerald-50 py-4 text-emerald-700"
                >
                  <CheckCircle2 size={32} />
                  <p className="text-sm font-black uppercase tracking-[0.15em]">Point Claimed Successfully!</p>
                </motion.div>
              )}
            </div>

            <p className="mt-6 text-center text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">
              * Points can be redeemed for discounts during checkout.
            </p>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
