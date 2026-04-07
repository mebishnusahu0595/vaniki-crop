import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import AuthShell from '../components/common/AuthShell';
import { storefrontApi } from '../utils/api';

const ForgotPassword: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [mobile, setMobile] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsSubmitting(true);
    try {
      const response = await storefrontApi.forgotPassword(mobile);
      toast.success(response.message);
      navigate(`/reset-password?mobile=${mobile}`);
    } catch {
      toast.error(t('authPages.forgotFailed'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthShell
      title={t('authPages.forgotTitle')}
      subtitle={t('authPages.forgotSubtitle')}
      backTo="/login"
      footer={
        <p className="text-sm font-medium text-primary-900/60">
          {t('authPages.rememberedIt')}{' '}
          <Link to="/login" className="font-black text-primary">
            {t('authPages.backToLogin')}
          </Link>
        </p>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <input
          required
          value={mobile}
          onChange={(event) => setMobile(event.target.value)}
          placeholder={t('authPages.registeredMobile')}
          className="w-full rounded-2xl border border-primary-100 bg-primary-50 px-4 py-3 font-semibold text-primary-900"
        />
        <button
          disabled={isSubmitting}
          className="w-full rounded-full bg-primary px-6 py-3 text-sm font-black uppercase tracking-[0.2em] text-white transition hover:bg-primary-600"
        >
          {isSubmitting ? t('authPages.sendingOtp') : t('authPages.sendOtp')}
        </button>
      </form>
    </AuthShell>
  );
};

export default ForgotPassword;
