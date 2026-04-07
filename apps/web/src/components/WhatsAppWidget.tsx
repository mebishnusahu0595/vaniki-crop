import React from 'react';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { openSupportWhatsApp } from '../utils/whatsapp';

const WhatsAppWidget: React.FC = () => {
  const { t } = useTranslation();

  const handleOpenWhatsApp = () => {
    openSupportWhatsApp(t('whatsapp.defaultMessage'));
  };

  return (
    <motion.div
      className="group fixed right-4 bottom-[calc(env(safe-area-inset-bottom)+6.4rem)] lg:right-6 lg:bottom-6"
      style={{ zIndex: 9999 }}
      initial={{ opacity: 0, scale: 0 }}
      animate={{ opacity: 1, scale: [0, 1.15, 0.94, 1] }}
      transition={{
        delay: 3,
        duration: 0.9,
        ease: 'easeOut',
        times: [0, 0.5, 0.8, 1],
      }}
    >
      <span className="pointer-events-none absolute right-full top-1/2 mr-3 -translate-y-1/2 whitespace-nowrap rounded-xl bg-primary-900 px-3 py-2 text-xs font-black uppercase tracking-[0.12em] text-white opacity-0 transition duration-300 group-hover:opacity-100">
        {t('whatsapp.chatWithUs')}
      </span>

      <button
        type="button"
        aria-label={t('whatsapp.openChat')}
        onClick={handleOpenWhatsApp}
        className="whatsapp-pulse flex h-12 w-12 items-center justify-center rounded-full bg-[#25D366] text-white shadow-[0_16px_30px_rgba(37,211,102,0.45)] transition duration-300 hover:scale-105 active:scale-95 lg:h-14 lg:w-14"
      >
        <svg viewBox="0 0 24 24" className="h-6 w-6 fill-current lg:h-7 lg:w-7" aria-hidden="true">
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.966-.273-.099-.471-.148-.67.15-.197.297-.767.965-.94 1.164-.174.198-.347.223-.645.074-.297-.149-1.255-.463-2.39-1.475-.883-.788-1.48-1.76-1.654-2.057-.174-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.372-.025-.521-.075-.149-.669-1.612-.916-2.206-.242-.58-.487-.5-.669-.51-.173-.008-.372-.01-.57-.01-.198 0-.52.074-.792.372-.273.298-1.04 1.016-1.04 2.479 0 1.462 1.065 2.876 1.214 3.074.149.198 2.098 3.2 5.082 4.487.71.306 1.263.489 1.695.626.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.413-.074-.124-.272-.198-.57-.347zm-5.421 7.618h-.004a9.87 9.87 0 01-5.031-1.378L2 21.919l1.324-4.871a9.86 9.86 0 01-1.51-5.26c.001-5.448 4.436-9.884 9.886-9.884 2.64.001 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.993c-.003 5.45-4.437 9.884-9.889 9.884zm8.413-18.296A11.81 11.81 0 0012.013 0C5.495 0 .19 5.305.188 11.824a11.8 11.8 0 001.607 5.929L0 24l6.398-1.673a11.78 11.78 0 005.614 1.431h.005c6.518 0 11.823-5.305 11.826-11.823a11.78 11.78 0 00-3.379-8.231z" />
        </svg>
      </button>
    </motion.div>
  );
};

export default WhatsAppWidget;
