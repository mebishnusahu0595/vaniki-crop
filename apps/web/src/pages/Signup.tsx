import React, { useCallback, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Eye, EyeOff } from 'lucide-react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import AuthShell from '../components/common/AuthShell';
import { storefrontApi } from '../utils/api';
import { getApiErrorMessage } from '../utils/error';
import { useAuthStore } from '../store/useAuthStore';
import { useServiceModeStore } from '../store/useServiceModeStore';
import { useStoreStore } from '../store/useStoreStore';
import type { AuthUser } from '../types/storefront';

const Signup: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const setAuth = useAuthStore((state) => state.setAuth);
  const setMode = useServiceModeStore((state) => state.setMode);
  const setAddress = useServiceModeStore((state) => state.setAddress);
  const setStore = useStoreStore((state) => state.setStore);

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    mobile: '',
    password: '',
    referralCode: searchParams.get('ref') || '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const applySession = useCallback(async (nextUser: AuthUser, accessToken: string) => {
    setAuth(nextUser, accessToken);
    const session = await storefrontApi.me();
    setAuth(session, accessToken);
    setMode(session.serviceMode);
    setAddress(session.savedAddress || null);
    if (session.serviceMode === 'pickup' && session.selectedStore && typeof session.selectedStore !== 'string') {
      setStore(session.selectedStore);
    } else {
      setStore(null);
    }
    navigate('/account');
  }, [navigate, setAddress, setAuth, setMode, setStore]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsSubmitting(true);
    try {
      const result = await storefrontApi.signup({
        ...formData,
        referralCode: formData.referralCode || undefined,
      });
      await applySession(result.user, result.accessToken);
    } catch (error) {
      toast.error(getApiErrorMessage(error, t('authPages.signupFailed')));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthShell
      title={t('authPages.signupTitle')}
      subtitle={t('authPages.signupSubtitle')}
      backTo="/login"
      footer={
        <p className="text-sm font-medium text-primary-900/60">
          {t('authPages.alreadyRegistered')}{' '}
          <Link to="/login" className="font-black text-primary">
            {t('authPages.loginHere')}
          </Link>
        </p>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <input
          required
          value={formData.name}
          onChange={(event) => setFormData((current) => ({ ...current, name: event.target.value }))}
          placeholder={t('authPages.fullName')}
          className="w-full rounded-2xl border border-primary-100 bg-primary-50 px-4 py-3 font-semibold text-primary-900"
        />
        <input
          type="email"
          value={formData.email}
          onChange={(event) => setFormData((current) => ({ ...current, email: event.target.value }))}
          placeholder={t('authPages.emailOptional')}
          className="w-full rounded-2xl border border-primary-100 bg-primary-50 px-4 py-3 font-semibold text-primary-900"
        />
        <input
          required
          value={formData.mobile}
          onChange={(event) => setFormData((current) => ({ ...current, mobile: event.target.value }))}
          placeholder={t('authPages.mobileNumber')}
          className="w-full rounded-2xl border border-primary-100 bg-primary-50 px-4 py-3 font-semibold text-primary-900"
        />
        <div className="relative">
          <input
            required
            type={showPassword ? 'text' : 'password'}
            value={formData.password}
            onChange={(event) => setFormData((current) => ({ ...current, password: event.target.value }))}
            placeholder={t('authPages.createPassword')}
            className="w-full rounded-2xl border border-primary-100 bg-primary-50 px-4 py-3 pr-11 font-semibold text-primary-900"
          />
          <button
            type="button"
            onClick={() => setShowPassword((current) => !current)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-primary-900/55 transition hover:text-primary-900"
            aria-label={showPassword ? t('authPages.hidePassword') : t('authPages.showPassword')}
          >
            {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>
        <input
          value={formData.referralCode}
          onChange={(event) => setFormData((current) => ({ ...current, referralCode: event.target.value.toUpperCase() }))}
          placeholder={t('authPages.referralCodeOptional')}
          className="w-full rounded-2xl border border-primary-100 bg-primary-50 px-4 py-3 font-semibold uppercase tracking-[0.12em] text-primary-900"
        />
        <button
          disabled={isSubmitting}
          className="w-full rounded-full bg-primary px-6 py-3 text-sm font-black uppercase tracking-[0.2em] text-white transition hover:bg-primary-600 disabled:cursor-not-allowed disabled:bg-primary-100"
        >
          {isSubmitting ? t('authPages.creatingAccount') : t('authPages.createAccountButton')}
        </button>
      </form>
    </AuthShell>
  );
};

export default Signup;
