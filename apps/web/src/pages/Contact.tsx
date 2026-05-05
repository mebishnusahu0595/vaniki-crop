import React, { useState } from 'react';
import toast from 'react-hot-toast';
import { Clock3, Mail, MapPin, Phone, ChevronDown } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { siteContent } from '../content/site';
import { storefrontApi } from '../utils/api';

const SUBJECT_OPTIONS = [
  { value: 'General Inquiry', labelKey: 'contactPage.generalInquiry' },
  { value: 'Product Query', labelKey: 'contactPage.productQuery' },
  { value: 'Order Issue', labelKey: 'contactPage.orderIssue' },
  { value: 'Dealer Inquiry', labelKey: 'contactPage.dealerInquiry' },
  { value: 'Other', labelKey: 'contactPage.other' },
] as const;

type ContactSubject = (typeof SUBJECT_OPTIONS)[number]['value'];

interface ContactFormValues {
  name: string;
  email: string;
  mobile: string;
  subject: ContactSubject;
  message: string;
}

type ContactFormErrors = Partial<Record<keyof ContactFormValues, string>>;

const initialFormValues: ContactFormValues = {
  name: '',
  email: '',
  mobile: '',
  subject: SUBJECT_OPTIONS[0].value,
  message: '',
};

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const indianMobileRegex = /^[6-9]\d{9}$/;

const Contact: React.FC = () => {
  const { t } = useTranslation();
  const [formData, setFormData] = useState<ContactFormValues>(initialFormValues);
  const [errors, setErrors] = useState<ContactFormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const validateForm = (): boolean => {
    const nextErrors: ContactFormErrors = {};

    if (formData.name.trim().length < 2) {
      nextErrors.name = t('contactPage.validationName');
    }

    if (!emailRegex.test(formData.email.trim())) {
      nextErrors.email = t('contactPage.validationEmail');
    }

    const mobileValue = formData.mobile.trim();
    if (mobileValue && !indianMobileRegex.test(mobileValue)) {
      nextErrors.mobile = t('contactPage.validationMobile');
    }

    if (!SUBJECT_OPTIONS.some((item) => item.value === formData.subject)) {
      nextErrors.subject = t('contactPage.validationSubject');
    }

    if (formData.message.trim().length < 20) {
      nextErrors.message = t('contactPage.validationMessage');
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!validateForm()) return;

    setIsSubmitting(true);
    try {
      const response = await storefrontApi.contact({
        name: formData.name.trim(),
        email: formData.email.trim(),
        mobile: formData.mobile.trim() || undefined,
        subject: formData.subject,
        message: formData.message.trim(),
      });

      toast.success(response.message || t('contactPage.defaultSentMessage'));
      setFormData(initialFormValues);
      setErrors({});
    } catch {
      toast.error(t('contactPage.sendFailed'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const updateField = <K extends keyof ContactFormValues>(key: K, value: ContactFormValues[K]) => {
    setFormData((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: undefined }));
  };

  return (
    <div className="container mx-auto px-4 py-8 sm:px-6">
      <section className="surface-card overflow-hidden bg-[linear-gradient(135deg,_rgba(20,61,46,1),_rgba(8,32,24,0.96))] px-6 py-10 text-white sm:px-10">
        <p className="section-kicker text-primary-200">{t('contactPage.contact')}</p>
        <h1 className="mt-4 font-heading text-5xl">{t('contactPage.getInTouch')}</h1>
        <p className="mt-5 max-w-3xl text-base font-medium leading-8 text-white/75">
          {t('contactPage.intro')}
        </p>
      </section>

      <div className="mt-8 grid gap-6 lg:grid-cols-[0.58fr_0.42fr]">
        <form onSubmit={handleSubmit} className="surface-card space-y-4 p-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <input
                required
                placeholder={t('contactPage.name')}
                value={formData.name}
                onChange={(event) => updateField('name', event.target.value)}
                className="w-full rounded-2xl border border-primary-100 bg-primary-50 px-4 py-3 font-semibold text-primary-900"
              />
              {errors.name ? <p className="mt-2 text-sm font-semibold text-rose-600">{errors.name}</p> : null}
            </div>

            <div>
              <input
                required
                type="email"
                placeholder={t('contactPage.email')}
                value={formData.email}
                onChange={(event) => updateField('email', event.target.value)}
                className="w-full rounded-2xl border border-primary-100 bg-primary-50 px-4 py-3 font-semibold text-primary-900"
              />
              {errors.email ? <p className="mt-2 text-sm font-semibold text-rose-600">{errors.email}</p> : null}
            </div>
          </div>

          <div>
            <input
              placeholder={t('contactPage.mobileOptional')}
              value={formData.mobile}
              onChange={(event) => updateField('mobile', event.target.value)}
              className="w-full rounded-2xl border border-primary-100 bg-primary-50 px-4 py-3 font-semibold text-primary-900"
            />
            {errors.mobile ? <p className="mt-2 text-sm font-semibold text-rose-600">{errors.mobile}</p> : null}
          </div>

          <div className="relative">
            <select
              value={formData.subject}
              onChange={(event) => updateField('subject', event.target.value as ContactSubject)}
              className="w-full appearance-none rounded-2xl border border-primary-100 bg-primary-50 py-3 pl-4 pr-10 font-semibold text-primary-900"
            >
              {SUBJECT_OPTIONS.map((subjectOption) => (
                <option key={subjectOption.value} value={subjectOption.value}>
                  {t(subjectOption.labelKey)}
                </option>
              ))}
            </select>
            <ChevronDown size={16} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-primary-900/40" />
            {errors.subject ? <p className="mt-2 text-sm font-semibold text-rose-600">{errors.subject}</p> : null}
          </div>

          <div>
            <textarea
              required
              rows={6}
              placeholder={t('contactPage.message')}
              value={formData.message}
              onChange={(event) => updateField('message', event.target.value)}
              className="w-full rounded-[1.5rem] border border-primary-100 bg-primary-50 px-4 py-3 font-semibold text-primary-900"
            />
            {errors.message ? <p className="mt-2 text-sm font-semibold text-rose-600">{errors.message}</p> : null}
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="rounded-full bg-primary px-6 py-3 text-sm font-black uppercase tracking-[0.2em] text-white transition hover:bg-primary-600 disabled:cursor-not-allowed disabled:bg-primary-100"
          >
            {isSubmitting ? t('contactPage.sending') : t('contactPage.submitMessage')}
          </button>
        </form>

        <div className="space-y-6">
          <div className="surface-card space-y-5 p-6">
            <h2 className="font-heading text-3xl text-primary-900">{t('contactPage.contactInformation')}</h2>

            <div className="flex items-start gap-4">
              <Phone className="mt-1 text-primary" size={18} />
              <div>
                <p className="text-sm font-black uppercase tracking-[0.2em] text-primary-500">{t('contactPage.phone')}</p>
                <p className="mt-2 text-base font-semibold text-primary-900">{siteContent.brand.supportPhone}</p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <Mail className="mt-1 text-primary" size={18} />
              <div>
                <p className="text-sm font-black uppercase tracking-[0.2em] text-primary-500">{t('contactPage.email')}</p>
                <p className="mt-2 text-base font-semibold text-primary-900">{siteContent.brand.supportEmail}</p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <MapPin className="mt-1 text-primary" size={18} />
              <div>
                <p className="text-sm font-black uppercase tracking-[0.2em] text-primary-500">{t('contactPage.address')}</p>
                <p className="mt-2 text-base font-semibold text-primary-900">{siteContent.contact.address}</p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <Clock3 className="mt-1 text-primary" size={18} />
              <div>
                <p className="text-sm font-black uppercase tracking-[0.2em] text-primary-500">{t('contactPage.workingHours')}</p>
                <p className="mt-2 text-base font-semibold text-primary-900">{siteContent.contact.workingHours}</p>
              </div>
            </div>
          </div>

          <div className="surface-card overflow-hidden p-2">
            <iframe
              title="Vaniki Crop location"
              src={siteContent.contact.mapEmbedUrl}
              width="600"
              height="450"
              style={{ border: 0, maxWidth: '100%' }}
              allowFullScreen
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Contact;
