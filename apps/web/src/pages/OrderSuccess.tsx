import React from 'react';
import { Link, useParams } from 'react-router-dom';
import { CheckCircle2, PackageCheck } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const OrderSuccess: React.FC = () => {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const shortOrder = id ? id.slice(-6).toUpperCase() : 'ORDER';

  return (
    <div className="container mx-auto flex min-h-[70vh] items-center justify-center px-4 py-10 sm:px-6">
      <div className="surface-card max-w-2xl p-8 text-center sm:p-12">
        <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-primary text-white ring-8 ring-primary-50 shadow-xl shadow-primary/35">
          <CheckCircle2 size={44} />
        </div>
        <p className="section-kicker mt-6">{t('orderSuccessPage.orderConfirmed')}</p>
        <h1 className="mt-3 font-heading text-5xl text-primary-900">{t('orderSuccessPage.thankYou')}</h1>
        <p className="mt-4 text-base font-medium leading-8 text-primary-900/60">
          {t('orderSuccessPage.orderPlaced', { id: shortOrder })}{' '}
          {t('orderSuccessPage.trackFromAccount')}
        </p>

        <div className="mt-8 rounded-[2rem] bg-primary-50 px-6 py-5 text-left">
          <div className="flex items-start gap-4">
            <PackageCheck size={22} className="mt-1 text-primary" />
            <div>
              <p className="text-sm font-black uppercase tracking-[0.18em] text-primary-500">{t('orderSuccessPage.whatHappensNext')}</p>
              <p className="mt-2 text-sm font-medium leading-7 text-primary-900/65">
                {t('orderSuccessPage.nextDescription')}
              </p>
            </div>
          </div>
        </div>

        <div className="mx-auto mt-8 flex w-full max-w-xs flex-col gap-3">
          <Link
            to="/account"
            className="inline-flex items-center justify-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-black uppercase tracking-[0.2em] text-white transition hover:bg-primary-600"
          >
            <span>{t('orderSuccessPage.myOrder')}</span>
          </Link>
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-full border border-primary-100 bg-white px-6 py-3 text-sm font-black uppercase tracking-[0.2em] text-primary-900"
          >
            {t('orderSuccessPage.backToHome')}
          </Link>
        </div>
      </div>
    </div>
  );
};

export default OrderSuccess;
