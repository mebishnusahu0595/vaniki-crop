import React from 'react';
import { Truck, Phone, Clock } from 'lucide-react';
import { siteContent } from '../../content/site';
import { useTranslation } from 'react-i18next';

const TopNoticeBar: React.FC = () => {
  const { t } = useTranslation();

  return (
    <div className="border-b border-primary-800 bg-primary-900 px-4 py-1.5 text-white">
      <div className="container mx-auto flex items-center justify-center text-[10px] font-bold uppercase tracking-[0.18em] sm:justify-between sm:text-xs">
        <div className="flex items-center space-x-1.5">
          <Truck size={14} className="text-primary-400" />
          <span>{t('topNotice.freeDelivery')}</span>
        </div>
        
        <div className="hidden items-center space-x-6 sm:flex">
          <div className="flex items-center space-x-1.5">
            <Phone size={14} className="text-primary-400" />
            <span>{t('topNotice.call')}: {siteContent.brand.supportPhone}</span>
          </div>
          <div className="hidden md:flex items-center space-x-1.5">
            <Clock size={14} className="text-primary-400" />
            <span>{t('topNotice.workingHoursLabel')}: {t('topNotice.workingHours')}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TopNoticeBar;
