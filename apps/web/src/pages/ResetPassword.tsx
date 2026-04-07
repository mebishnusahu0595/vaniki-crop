import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import AuthShell from '../components/common/AuthShell';
import { storefrontApi } from '../utils/api';

const ResetPassword: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [formData, setFormData] = useState({
    mobile: searchParams.get('mobile') || '',
    otp: '',
    newPassword: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsSubmitting(true);
    try {
      const response = await storefrontApi.resetPassword(formData);
      toast.success(response.message);
      navigate('/login');
    } catch {
      toast.error(t('authPages.resetFailed'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthShell
      title={t('authPages.resetTitle')}
      subtitle={t('authPages.resetSubtitle')}
      backTo="/forgot-password"
      footer={
        <p className="text-sm font-medium text-primary-900/60">
          {t('authPages.needNewOtp')}{' '}
          <Link to="/forgot-password" className="font-black text-primary">
            {t('authPages.startOver')}
          </Link>
        </p>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <input
          required
          value={formData.mobile}
          onChange={(event) => setFormData((current) => ({ ...current, mobile: event.target.value }))}
          placeholder={t('authPages.mobileNumber')}
          className="w-full rounded-2xl border border-primary-100 bg-primary-50 px-4 py-3 font-semibold text-primary-900"
        />
        <input
          required
          value={formData.otp}
          onChange={(event) => setFormData((current) => ({ ...current, otp: event.target.value }))}
          placeholder={t('authPages.otp')}
          className="w-full rounded-2xl border border-primary-100 bg-primary-50 px-4 py-3 font-semibold text-primary-900"
        />
        <input
          required
          type="password"
          value={formData.newPassword}
          onChange={(event) => setFormData((current) => ({ ...current, newPassword: event.target.value }))}
          placeholder={t('accountPage.newPassword')}
          className="w-full rounded-2xl border border-primary-100 bg-primary-50 px-4 py-3 font-semibold text-primary-900"
        />
        <button
          disabled={isSubmitting}
          className="w-full rounded-full bg-primary px-6 py-3 text-sm font-black uppercase tracking-[0.2em] text-white transition hover:bg-primary-600"
        >
          {isSubmitting ? t('authPages.resetting') : t('authPages.resetPassword')}
        </button>
      </form>
    </AuthShell>
  );
};

export default ResetPassword;
