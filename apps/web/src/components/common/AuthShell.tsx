import React from 'react';
import { ArrowLeft } from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

interface AuthShellProps {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  backTo?: string;
  disableHistoryBack?: boolean;
  compactMobile?: boolean;
}

const authRoutes = new Set(['/login', '/signup', '/forgot-password', '/reset-password']);

const AuthShell: React.FC<AuthShellProps> = ({
  title,
  subtitle,
  children,
  footer,
  backTo = '/',
  disableHistoryBack = false,
  compactMobile = false,
}) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();

  const handleBack = () => {
    if (typeof window === 'undefined') {
      navigate(backTo, { replace: true });
      return;
    }

    let referrerPath = '';
    try {
      if (document.referrer) {
        const referrerUrl = new URL(document.referrer);
        if (referrerUrl.origin === window.location.origin) {
          referrerPath = referrerUrl.pathname;
        }
      }
    } catch {
      referrerPath = '';
    }

    const hasHistory = window.history.length > 1;
    const blockedHistoryBack =
      disableHistoryBack ||
      !referrerPath ||
      authRoutes.has(referrerPath) ||
      referrerPath === location.pathname;

    if (hasHistory && !blockedHistoryBack) {
      navigate(-1);
      return;
    }

    navigate(backTo, { replace: true });
  };

  return (
    <div className="flex min-h-[100dvh] items-stretch justify-center px-3 py-3 sm:items-center sm:px-4 sm:py-6">
      <div
        className={`grid w-full max-w-6xl overflow-hidden rounded-[2.2rem] border border-primary-100 bg-white shadow-[0_24px_90px_rgba(8,32,24,0.12)] lg:grid-cols-[0.9fr_1.1fr] ${
          compactMobile ? 'min-h-[calc(100dvh-1.5rem)] sm:min-h-0' : ''
        }`}
      >
        <div className="hidden bg-[radial-gradient(circle_at_top_left,_rgba(82,183,136,0.35),_transparent_35%),linear-gradient(180deg,_#143d2e,_#082018)] p-10 text-white lg:flex lg:flex-col lg:justify-between">
          <div>
            <Link to="/" className="font-heading text-4xl">Vaniki Crop</Link>
            <p className="mt-5 max-w-md text-lg leading-8 text-primary-50/78">
              {t('authShell.sideDescription')}
            </p>
          </div>
          <div className="glass-card p-6">
            <p className="text-xs font-black uppercase tracking-[0.22em] text-primary-200">{t('authShell.whyChoose')}</p>
            <ul className="mt-4 space-y-3 text-sm font-medium text-white/75">
              <li>{t('authShell.point1')}</li>
              <li>{t('authShell.point2')}</li>
              <li>{t('authShell.point3')}</li>
            </ul>
          </div>
        </div>

        <div className={`${compactMobile ? 'p-4 sm:p-8' : 'p-6 sm:p-10'}`}>
          <div className="mx-auto flex h-full max-w-xl flex-col justify-center">
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={handleBack}
                className="inline-flex items-center gap-1 rounded-full border border-primary-100 bg-primary-50 px-3 py-2 text-xs font-black uppercase tracking-[0.16em] text-primary-900 transition hover:bg-primary-100"
              >
                <ArrowLeft size={14} />
                {t('authShell.back')}
              </button>
              <Link to="/" className="font-heading text-2xl text-primary-900 lg:hidden">Vaniki Crop</Link>
            </div>

            <h1 className={`${compactMobile ? 'mt-4 text-3xl' : 'mt-6 text-4xl'} font-heading text-primary-900`}>
              {title}
            </h1>
            <p className={`${compactMobile ? 'mt-2 text-sm leading-6' : 'mt-3 text-base leading-7'} font-medium text-primary-900/60`}>
              {subtitle}
            </p>

            <div className="mt-4 overflow-hidden rounded-2xl border border-primary-100 bg-primary-50 lg:hidden">
              <img
                src="https://images.unsplash.com/photo-1523741543316-beb7fc7023d8?auto=format&fit=crop&w=1200&q=80"
                alt="Crop-protection greenhouse"
                className={`${compactMobile ? 'h-20' : 'h-28'} w-full object-cover`}
              />
            </div>

            <div className={compactMobile ? 'mt-5' : 'mt-8'}>{children}</div>
            {footer ? <div className={compactMobile ? 'mt-5' : 'mt-8'}>{footer}</div> : null}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AuthShell;
