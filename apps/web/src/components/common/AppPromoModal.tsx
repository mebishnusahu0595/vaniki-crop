import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Smartphone, ExternalLink } from 'lucide-react';

export const PLAY_STORE_URL =
  'https://play.google.com/store/apps/details?id=com.vanikicrop.app&pcampaignid=web_share';

/**
 * App download promo popup. Shows the Play Store QR ("Scan Me") image with a
 * "Go to Play Store" button. It opens after the Quick Enquiry form is closed
 * (via the `vaniki:show-app-promo` event) and on every page refresh (when the
 * enquiry form is no longer due to appear this session). Closes on backdrop
 * click or the X button.
 */
export const AppPromoModal: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const open = () => setIsOpen(true);
    window.addEventListener('vaniki:show-app-promo', open);

    // On refreshes where the enquiry form will NOT auto-open this session,
    // show the promo on its own after a short delay so it appears every refresh.
    const enquiryDone =
      localStorage.getItem('vaniki_enquiry_submitted') === 'true' ||
      sessionStorage.getItem('vaniki_enquiry_dismissed') === 'true';

    let timer: ReturnType<typeof setTimeout> | undefined;
    if (enquiryDone) {
      timer = setTimeout(() => setIsOpen(true), 1500);
    }

    return () => {
      window.removeEventListener('vaniki:show-app-promo', open);
      if (timer) clearTimeout(timer);
    };
  }, []);

  const close = () => setIsOpen(false);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 sm:p-6">
        {/* Backdrop — click outside to close */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={close}
          className="absolute inset-0 bg-emerald-950/70 backdrop-blur-sm"
        />

        <motion.div
          initial={{ scale: 0.9, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.9, opacity: 0, y: 20 }}
          role="dialog"
          aria-label="Download the Vaniki Crop app"
          className="relative w-full max-w-sm overflow-hidden rounded-[2rem] border border-emerald-800/40 bg-white shadow-2xl"
        >
          <button
            type="button"
            onClick={close}
            className="absolute right-3 top-3 z-10 rounded-full bg-emerald-900/5 p-2 text-emerald-900/60 transition hover:bg-emerald-900/10 hover:text-emerald-900"
            aria-label="Close"
          >
            <X size={18} />
          </button>

          <div className="flex flex-col items-center px-5 pt-7 pb-5 text-center sm:px-7">
            <div className="mb-3 flex items-center gap-2 rounded-full bg-emerald-50 px-4 py-1.5 text-emerald-700">
              <Smartphone size={15} />
              <span className="text-[11px] font-black uppercase tracking-[0.18em]">Get the App</span>
            </div>

            <h2 className="text-xl font-black tracking-tight text-emerald-950 sm:text-2xl">
              Download our Play Store app
            </h2>
            <p className="mt-1 text-xs font-semibold text-emerald-900/55 sm:text-sm">
              Scan the QR code or tap below to install Vaniki Crop.
            </p>

            <div className="mt-4 w-full max-w-[260px] overflow-hidden rounded-2xl border border-emerald-100 bg-white p-2 shadow-sm">
              <img
                src="/app_promotion.jpeg"
                alt="Scan to download the Vaniki Crop app from Google Play"
                className="h-auto w-full select-none"
                draggable={false}
              />
            </div>

            <a
              href={PLAY_STORE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-5 py-4 text-xs font-black uppercase tracking-[0.18em] text-white shadow-lg shadow-emerald-600/25 transition hover:bg-emerald-700 sm:text-sm"
            >
              <ExternalLink size={16} />
              <span>Go to Play Store</span>
            </a>

            <p className="mt-3 text-[10px] font-bold uppercase tracking-[0.14em] text-emerald-900/30">
              Crop protection, better tomorrow
            </p>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
