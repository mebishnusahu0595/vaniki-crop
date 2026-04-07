import React from 'react';
import { Link } from 'react-router-dom';
import { MessageCircle, Phone, Mail, MapPin } from 'lucide-react';
import { siteContent } from '../../content/site';
import { useTranslation } from 'react-i18next';
import { openSupportWhatsApp } from '../../utils/whatsapp';

const Footer: React.FC = () => {
  const { t } = useTranslation();

  return (
    <footer className="overflow-hidden border-t border-primary-800 bg-primary-900 pt-20 pb-28 text-white lg:pb-12">
      <div className="container mx-auto px-6">
        <div className="grid grid-cols-2 gap-12 sm:gap-16 md:grid-cols-4">
          <div className="col-span-2 md:col-span-1">
            <Link to="/" className="group mb-8 flex items-center space-x-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-2xl font-black text-white shadow-lg shadow-primary/20 ring-4 ring-primary/5 transition-transform group-hover:rotate-12">
                V
              </div>
              <div className="flex flex-col">
                <span className="font-heading text-3xl leading-none text-white">{siteContent.brand.name}</span>
                <span className="mt-1 text-[10px] font-bold uppercase tracking-widest text-primary-400">
                  {t('footer.premiumSolutions')}
                </span>
              </div>
            </Link>
            <p className="mb-10 max-w-xs text-sm font-medium leading-relaxed text-primary-100/55">
              {t('aboutPage.story')}
            </p>
            <div className="space-y-3 text-sm font-semibold text-primary-100/70">
              <div className="flex items-center gap-3">
                <Phone size={16} className="text-primary-300" />
                <span>{siteContent.brand.supportPhone}</span>
              </div>
              <div className="flex items-center gap-3">
                <Mail size={16} className="text-primary-300" />
                <span>{siteContent.brand.supportEmail}</span>
              </div>
              <div className="flex items-center gap-3">
                <MessageCircle size={16} className="text-primary-300" />
                <button type="button" onClick={() => openSupportWhatsApp()} className="hover:text-white">
                  {t('footer.whatsappSupport')}
                </button>
              </div>
            </div>
          </div>

          <div>
            <h3 className="mb-8 text-xs font-black uppercase tracking-[0.2em] text-primary-400">{t('footer.products')}</h3>
            <ul className="space-y-5">
              {[
                { label: t('footer.insecticides'), href: '/products?category=insecticides' },
                { label: t('footer.fungicides'), href: '/products?category=fungicides' },
                { label: t('footer.herbicides'), href: '/products?category=herbicides' },
                { label: t('footer.categories'), href: '/categories' },
              ].map((link) => (
                <li key={link.href}>
                  <Link
                    to={link.href}
                    className="text-sm font-bold uppercase tracking-widest text-primary-100 transition-colors hover:text-primary-300"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="mb-8 text-xs font-black uppercase tracking-[0.2em] text-primary-400">{t('footer.company')}</h3>
            <ul className="space-y-5">
              {[
                { label: t('footer.aboutUs'), href: '/about' },
                { label: t('footer.contact'), href: '/contact' },
                { label: t('footer.myAccount'), href: '/account' },
                { label: t('footer.orderTracking'), href: '/account' },
              ].map((link) => (
                <li key={link.href + link.label}>
                  <Link
                    to={link.href}
                    className="text-sm font-bold uppercase tracking-widest text-primary-100 transition-colors hover:text-primary-300"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="mb-8 text-xs font-black uppercase tracking-[0.2em] text-primary-400">{t('footer.support')}</h3>
            <div className="space-y-5 text-sm font-medium text-primary-100/70">
              <div className="flex items-start gap-3">
                <MapPin size={16} className="mt-1 shrink-0 text-primary-300" />
                <p>{t('footer.supportDesc')}</p>
              </div>
              <p>{t('contactPage.intro')}</p>
              <Link
                to="/contact"
                className="inline-flex items-center rounded-full bg-primary px-5 py-2 text-xs font-black uppercase tracking-[0.2em] text-white"
              >
                {t('footer.contactUs')}
              </Link>
            </div>
          </div>
        </div>

        <div className="mt-20 flex flex-col items-center justify-between space-y-4 border-t border-primary-800 pt-8 sm:flex-row sm:space-y-0">
          <p className="text-[10px] font-bold uppercase tracking-widest text-primary-100/25">
            © 2026 {siteContent.brand.name}. {t('footer.rightsReserved')}
          </p>
          <div className="flex items-center space-x-6">
            <Link
              to="/about"
              className="text-[10px] font-bold uppercase tracking-widest text-primary-100/25 transition-colors hover:text-primary-300"
            >
              {t('footer.about')}
            </Link>
            <Link
              to="/contact"
              className="text-[10px] font-bold uppercase tracking-widest text-primary-100/25 transition-colors hover:text-primary-300"
            >
              {t('footer.supportLink')}
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
