import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Clock,
  Cpu,
  ExternalLink,
  Image as ImageIcon,
  Link2,
  MessageSquare,
  RefreshCw,
  Send,
  Smartphone,
  Sparkles,
  Users,
} from 'lucide-react';
import { PageHeader } from '../components/PageHeader';
import { LoadingBlock } from '../components/LoadingBlock';
import { adminApi } from '../utils/api';
import { formatDate } from '../utils/format';

type Channel = 'ai' | 'whatsapp' | 'push';
type Audience = 'customers' | 'dealers' | 'both';
type WhatsAppAudience = 'customers' | 'dealers' | 'all' | 'custom';
type AiAudience = 'customers' | 'dealers' | 'all';

const AUDIENCE_OPTIONS: { value: Audience; label: string; hint: string }[] = [
  { value: 'customers', label: 'Users', hint: 'Customer app' },
  { value: 'dealers', label: 'Dealers', hint: 'Dealers app' },
  { value: 'both', label: 'Both', hint: 'Users + Dealers' },
];

const WA_AUDIENCE_OPTIONS: { value: WhatsAppAudience; label: string; hint: string }[] = [
  { value: 'customers', label: 'All Farmers', hint: 'Registered users' },
  { value: 'dealers', label: 'Dealers', hint: 'Store partners' },
  { value: 'all', label: 'Everyone', hint: 'Farmers + Dealers' },
  { value: 'custom', label: 'Custom List', hint: 'Specific numbers' },
];

const defaultForm = {
  title: '',
  body: '',
  link: '',
  imageUrl: 'https://vanikicrop.com/uploads/vaniki/products/1776492631768-c5024e5b-f13a-44fb-b1fd-af9985b93241.png',
  customNumbers: '',
  targetAudience: 'customers' as Audience,
  waAudience: 'customers' as WhatsAppAudience,
  templateMode: 'vaniki' as 'vaniki' | 'custom',
};

function getDeliveryRate(sent: number, total: number) {
  if (!total) return '0%';
  return `${Math.round((sent / total) * 100)}%`;
}

export default function NotificationsPage() {
  const queryClient = useQueryClient();
  const [channel, setChannel] = useState<Channel>('ai');
  const [form, setForm] = useState(defaultForm);
  const [message, setMessage] = useState('');
  const [waResult, setWaResult] = useState<{ total?: number; sent?: number; failed?: number } | null>(null);

  // ─── AI Auto-Pilot & Advisory States ───────────────────────────────────
  const [aiEnabled, setAiEnabled] = useState(true);
  const [aiDailyTime, setAiDailyTime] = useState('09:00');
  const [aiChannels, setAiChannels] = useState({ whatsapp: true, push: true });
  const [aiWhatsappInterval, setAiWhatsappInterval] = useState<number>(2);
  const [aiAudience, setAiAudience] = useState<AiAudience>('customers');
  const [aiAdvisory, setAiAdvisory] = useState<any>(null);
  const [aiTemplateMode, setAiTemplateMode] = useState<'custom' | 'vaniki'>('custom');
  const [isTestMode, setIsTestMode] = useState(false);
  const [testNumber, setTestNumber] = useState('9301105706');
  const [dispatchPush, setDispatchPush] = useState(true);
  const [dispatchWhatsApp, setDispatchWhatsApp] = useState(true);
  const [aiFeedback, setAiFeedback] = useState('');

  // ─── Queries ─────────────────────────────────────────────────────────────
  const notificationsQuery = useQuery({
    queryKey: ['super-admin-notifications'],
    queryFn: () => adminApi.notifications({ limit: 50 }),
  });

  const aiSettingsQuery = useQuery({
    queryKey: ['ai-marketing-settings'],
    queryFn: () => adminApi.getAiMarketingSettings(),
  });

  const aiHistoryQuery = useQuery({
    queryKey: ['ai-marketing-history'],
    queryFn: () => adminApi.getAiCampaignHistory({ limit: 15 }),
  });

  useEffect(() => {
    if (aiSettingsQuery.data?.settings) {
      setAiEnabled(aiSettingsQuery.data.settings.enabled);
      setAiDailyTime(aiSettingsQuery.data.settings.dailyTime || '09:00');
      setAiChannels(aiSettingsQuery.data.settings.channels || { whatsapp: true, push: true });
      if ((aiSettingsQuery.data.settings as any).whatsappIntervalDays !== undefined) {
        setAiWhatsappInterval((aiSettingsQuery.data.settings as any).whatsappIntervalDays);
      }
    }
  }, [aiSettingsQuery.data]);

  // ─── Mutations ───────────────────────────────────────────────────────────
  const updateAiSettingsMutation = useMutation({
    mutationFn: adminApi.updateAiMarketingSettings,
    onSuccess: () => {
      setAiFeedback('✅ AI Auto-Pilot settings updated successfully!');
      queryClient.invalidateQueries({ queryKey: ['ai-marketing-settings'] });
      setTimeout(() => setAiFeedback(''), 4000);
    },
    onError: (err: any) => {
      setAiFeedback(`❌ Failed to update settings: ${err.message}`);
    },
  });

  const previewAdvisoryMutation = useMutation({
    mutationFn: adminApi.previewAiAdvisory,
    onSuccess: (data) => {
      setAiAdvisory(data.advisory);
      setAiFeedback('✨ Gemini generated a fresh seasonal crop advisory based on catalog data!');
      setTimeout(() => setAiFeedback(''), 4000);
    },
    onError: (err: any) => {
      setAiFeedback(`❌ Failed to generate advisory: ${err.message}`);
    },
  });

  const triggerAiCampaignMutation = useMutation({
    mutationFn: adminApi.triggerAiCampaign,
    onSuccess: (res) => {
      setAiFeedback(
        `🎉 Campaign Broadcast Complete! In-App Push sent: ${res.stats?.pushSent || 0}, WhatsApp sent: ${
          res.stats?.whatsappSent || 0
        } (Status: ${res.stats?.status}).`,
      );
      queryClient.invalidateQueries({ queryKey: ['ai-marketing-history'] });
      queryClient.invalidateQueries({ queryKey: ['super-admin-notifications'] });
    },
    onError: (err: any) => {
      setAiFeedback(`❌ Campaign broadcast failed: ${err.message}`);
    },
  });

  const sendPushMutation = useMutation({
    mutationFn: adminApi.sendNotification,
    onSuccess: (campaign) => {
      setForm(defaultForm);
      setMessage(`Push notification sent to ${campaign.sentCount} of ${campaign.totalRecipients} devices.`);
      queryClient.invalidateQueries({ queryKey: ['super-admin-notifications'] });
    },
    onError: (error) => {
      setMessage(error instanceof Error ? error.message : 'Unable to send push notification.');
    },
  });

  const sendWaMutation = useMutation({
    mutationFn: adminApi.sendWhatsAppBroadcast,
    onSuccess: (res) => {
      setWaResult(res);
      setMessage(`WhatsApp campaign delivered: ${res.sent} sent out of ${res.total} recipients (${res.failed} failed).`);
      setForm((cur) => ({ ...cur, title: '', body: '', link: '', imageUrl: '' }));
    },
    onError: (error) => {
      setMessage(error instanceof Error ? error.message : 'Unable to send WhatsApp broadcast.');
    },
  });

  const canSendPush = useMemo(
    () => form.title.trim().length >= 2 && form.body.trim().length >= 3 && !sendPushMutation.isPending,
    [form.body, form.title, sendPushMutation.isPending],
  );

  const canSendWa = useMemo(
    () =>
      (form.templateMode === 'vaniki' || form.body.trim().length >= 3) &&
      !sendWaMutation.isPending &&
      (form.waAudience !== 'custom' || form.customNumbers.trim().length >= 10),
    [form.body, form.templateMode, form.waAudience, form.customNumbers, sendWaMutation.isPending],
  );

  if (notificationsQuery.isLoading && !notificationsQuery.data) {
    return <LoadingBlock label="Loading notification history..." />;
  }

  const handlePushSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setMessage('');
    setWaResult(null);
    sendPushMutation.mutate({
      title: form.title.trim(),
      body: form.body.trim(),
      link: form.link.trim() || undefined,
      targetAudience: form.targetAudience,
    });
  };

  const handleWaSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setMessage('');
    setWaResult(null);

    const parsedNumbers =
      form.waAudience === 'custom'
        ? form.customNumbers
            .split(/[\n,]+/)
            .map((n) => n.trim().replace(/\D/g, ''))
            .filter((n) => n.length >= 10)
        : undefined;

    sendWaMutation.mutate({
      title: form.title.trim() || undefined,
      message: form.body.trim(),
      imageUrl: form.imageUrl.trim() || undefined,
      link: form.link.trim() || undefined,
      targetAudience: form.waAudience,
      numbers: parsedNumbers,
      templateName: form.templateMode === 'vaniki' ? 'vaniki' : undefined,
      languageCode: 'en',
    });
  };

  const handleSaveAiSettings = () => {
    updateAiSettingsMutation.mutate({
      enabled: aiEnabled,
      dailyTime: aiDailyTime,
      channels: aiChannels,
      whatsappIntervalDays: Number(aiWhatsappInterval) || 2,
    });
  };

  const handleGenerateAdvisory = () => {
    setAiFeedback('');
    previewAdvisoryMutation.mutate({ targetAudience: aiAudience });
  };

  const handleBroadcastAiCampaign = () => {
    setAiFeedback('');
    triggerAiCampaignMutation.mutate({
      advisory: aiAdvisory,
      targetAudience: aiAudience,
      testNumbers: isTestMode && testNumber ? [testNumber.trim()] : undefined,
      useTemplate: aiTemplateMode === 'vaniki',
      sendPush: dispatchPush,
      sendWhatsApp: dispatchWhatsApp,
    });
  };

  const seasonInfo = aiSettingsQuery.data?.season;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Marketing & Automated Broadcasts"
        subtitle="AI-driven daily crop advisories, promotional WhatsApp broadcasts with images, and mobile push notifications."
      />

      {/* Channel Switcher Tabs */}
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => {
            setChannel('ai');
            setMessage('');
          }}
          className={`flex items-center gap-2.5 rounded-2xl border px-5 py-3 text-sm font-black transition ${
            channel === 'ai'
              ? 'border-indigo-600 bg-gradient-to-r from-indigo-600 to-emerald-600 text-white shadow-[0_8px_20px_rgba(79,70,229,0.3)]'
              : 'border-slate-200 bg-white text-slate-600 hover:border-indigo-400'
          }`}
        >
          <Sparkles size={18} className="text-amber-300 animate-pulse" />
          <span>🤖 Gemini AI Auto-Pilot & Advisory</span>
          <span className="rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-bold text-white uppercase tracking-wider">
            Daily Auto
          </span>
        </button>

        <button
          type="button"
          onClick={() => {
            setChannel('whatsapp');
            setMessage('');
          }}
          className={`flex items-center gap-2 rounded-2xl border px-5 py-3 text-sm font-black transition ${
            channel === 'whatsapp'
              ? 'border-emerald-600 bg-emerald-600 text-white shadow-[0_8px_20px_rgba(5,150,105,0.25)]'
              : 'border-slate-200 bg-white text-slate-600 hover:border-emerald-400'
          }`}
        >
          <MessageSquare size={18} />
          <span>WhatsApp Manual Broadcast</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setChannel('push');
            setMessage('');
          }}
          className={`flex items-center gap-2 rounded-2xl border px-5 py-3 text-sm font-black transition ${
            channel === 'push'
              ? 'border-primary-500 bg-primary-500 text-white shadow-[0_8px_20px_rgba(45,106,79,0.25)]'
              : 'border-slate-200 bg-white text-slate-600 hover:border-primary-400'
          }`}
        >
          <Smartphone size={18} />
          <span>App Push Notification (FCM)</span>
        </button>
      </div>

      {/* ================= CHANNEL 1: GEMINI AI AUTO-PILOT & ADVISORY ================= */}
      {channel === 'ai' && (
        <div className="space-y-6">
          {/* Top Banner: Regional Season & Pest Detection */}
          {seasonInfo ? (
            <div className="rounded-[1.5rem] border border-indigo-100 bg-gradient-to-br from-indigo-50/70 via-white to-emerald-50/40 p-6 shadow-sm space-y-4">
              {/* Header & Controls Row */}
              <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 pb-4 border-b border-indigo-100/80">
                <div className="flex items-center gap-3">
                  <div className="rounded-2xl bg-indigo-600 p-3 text-white shadow-md shrink-0">
                    <Cpu size={24} />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                      🤖 Gemini AI Auto-Pilot Engine
                      <span className={`text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider ${
                        aiEnabled ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'
                      }`}>
                        {aiEnabled ? '● Active' : '○ Paused'}
                      </span>
                    </h3>
                    <p className="text-xs font-semibold text-slate-500">
                      Season-aware crop advisory & automatic farmer/dealer broadcasts
                    </p>
                  </div>
                </div>

                {/* Auto-Pilot Controls Box */}
                <div className="flex flex-wrap items-center gap-3 bg-white/95 backdrop-blur rounded-2xl p-3 border border-indigo-100 shadow-sm">
                  {/* Toggle */}
                  <div className="flex items-center gap-2 pr-2 border-r border-slate-200">
                    <label className="relative inline-flex cursor-pointer items-center">
                      <input
                        type="checkbox"
                        checked={aiEnabled}
                        onChange={(e) => setAiEnabled(e.target.checked)}
                        className="peer sr-only"
                      />
                      <div className="peer h-6 w-11 rounded-full bg-slate-300 after:absolute after:top-0.5 after:left-[2px] after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-all after:content-[''] peer-checked:bg-emerald-600 peer-checked:after:translate-x-full peer-focus:outline-none"></div>
                    </label>
                    <span className="text-xs font-black text-slate-800">
                      {aiEnabled ? 'Auto-Pilot On' : 'Paused'}
                    </span>
                  </div>

                  {/* Daily Time */}
                  <div className="flex items-center gap-1.5 text-xs text-slate-600 pr-2 border-r border-slate-200">
                    <Clock size={14} className="text-indigo-600 shrink-0" />
                    <span className="font-bold text-slate-700">Time:</span>
                    <input
                      type="time"
                      value={aiDailyTime}
                      onChange={(e) => setAiDailyTime(e.target.value)}
                      className="rounded-lg border border-slate-200 px-2 py-1 text-xs font-bold text-slate-800 outline-none focus:border-indigo-500 bg-slate-50"
                    />
                    <span className="text-[10px] text-slate-400 font-bold">IST</span>
                  </div>

                  {/* WhatsApp Interval Selector */}
                  <div className="flex items-center gap-1.5 text-xs text-slate-600">
                    <MessageSquare size={14} className="text-emerald-600 shrink-0" />
                    <span className="font-bold text-slate-700">WhatsApp Interval:</span>
                    <select
                      value={aiWhatsappInterval}
                      onChange={(e) => setAiWhatsappInterval(Number(e.target.value))}
                      className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-bold text-slate-800 outline-none focus:border-indigo-500 shadow-sm"
                    >
                      <option value={1}>Every 1 Day (Daily / रोज़)</option>
                      <option value={2}>Every 2 Days (हर 2 दिन में 1 बार - Recommended)</option>
                      <option value={3}>Every 3 Days (हर 3 दिन में 1 बार)</option>
                      <option value={4}>Every 4 Days (हर 4 दिन में 1 बार)</option>
                      <option value={5}>Every 5 Days (हर 5 दिन में 1 बार)</option>
                      <option value={7}>Every 7 Days (Weekly / साप्ताहिक)</option>
                    </select>
                  </div>

                  {/* Save Button */}
                  <button
                    type="button"
                    onClick={handleSaveAiSettings}
                    disabled={updateAiSettingsMutation.isPending}
                    className="rounded-xl bg-indigo-600 px-4 py-1.5 text-xs font-black text-white hover:bg-indigo-700 transition disabled:opacity-50 shrink-0 shadow-sm ml-auto"
                  >
                    {updateAiSettingsMutation.isPending ? 'Saving...' : 'Save Settings'}
                  </button>
                </div>
              </div>

              {/* Regional Season & Pest Detection Card */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-white/70 backdrop-blur rounded-2xl p-4 border border-indigo-50 shadow-sm">
                <div className="flex items-start gap-2.5">
                  <span className="text-xl">🌦️</span>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="rounded-full bg-indigo-100 px-2.5 py-0.5 text-[11px] font-black text-indigo-700">
                        {seasonInfo.season}
                      </span>
                      <span className="text-xs font-bold text-slate-700">{seasonInfo.month}</span>
                    </div>
                    <p className="mt-1 text-[11px] text-slate-500 font-medium">
                      Region: Central & North India / Chhattisgarh
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-2.5">
                  <span className="text-xl">🌾</span>
                  <div>
                    <span className="text-[11px] font-black text-slate-500 uppercase tracking-wide">
                      प्रमुख फसलें:
                    </span>
                    <p className="text-xs font-bold text-slate-800 leading-snug mt-0.5">
                      {seasonInfo.primaryCrops}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-2.5">
                  <span className="text-xl">⚠️</span>
                  <div>
                    <span className="text-[11px] font-black text-rose-600 uppercase tracking-wide">
                      सक्रिय कीट/रोग जोखिम:
                    </span>
                    <p className="text-xs font-bold text-rose-700 leading-snug mt-0.5">
                      {seasonInfo.majorRisks}
                    </p>
                  </div>
                </div>
              </div>

              {/* Badges Footer */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-[11px]">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 font-bold text-emerald-800 bg-emerald-100/80 px-3 py-1 rounded-xl border border-emerald-200">
                    <Smartphone size={13} className="text-emerald-700" />
                    App Push: Daily at {aiDailyTime} IST (100% Free)
                  </span>
                  <span className="inline-flex items-center gap-1.5 font-bold text-indigo-800 bg-indigo-100/80 px-3 py-1 rounded-xl border border-indigo-200">
                    <MessageSquare size={13} className="text-indigo-700" />
                    WhatsApp Broadcast: {aiWhatsappInterval === 1 ? 'Daily (रोज़ाना)' : `हर ${aiWhatsappInterval} दिन में 1 बार (Meta Cost Saving)`}
                  </span>
                </div>
                {(aiSettingsQuery.data?.settings as any)?.lastWhatsAppRunDate && (
                  <span className="text-slate-500 font-semibold bg-white/80 px-3 py-1 rounded-xl border border-slate-200">
                    Last WhatsApp Sent: <strong className="text-slate-800">{(aiSettingsQuery.data?.settings as any)?.lastWhatsAppRunDate}</strong>
                  </span>
                )}
              </div>
            </div>
          ) : null}

          {/* Feedback message banner */}
          {aiFeedback ? (
            <div className="rounded-2xl border border-indigo-200 bg-indigo-50 p-4 text-sm font-bold text-indigo-900 flex items-center gap-2 shadow-sm">
              <Sparkles size={18} className="text-indigo-600 shrink-0" />
              <span>{aiFeedback}</span>
            </div>
          ) : null}

          <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
            {/* Left: AI Generator & Campaign Dispatcher */}
            <div className="rounded-[1.5rem] border border-slate-200 bg-white p-6 shadow-sm space-y-6">
              <div className="flex items-center justify-between flex-wrap gap-3 border-b border-slate-100 pb-4">
                <div>
                  <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
                    <Sparkles className="text-amber-500" size={20} />
                    Gemini AI Advisory Generator & On-Demand Broadcast
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Gemini inspects real MongoDB catalog products, analyzes seasonal pest attacks, and drafts Hindi crop advice.
                  </p>
                </div>

                {/* Audience selector */}
                <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
                  {(['customers', 'dealers', 'all'] as AiAudience[]).map((aud) => (
                    <button
                      key={aud}
                      type="button"
                      onClick={() => setAiAudience(aud)}
                      className={`px-3 py-1 text-xs font-black rounded-lg transition capitalize ${
                        aiAudience === aud
                          ? 'bg-white text-indigo-700 shadow-sm'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {aud === 'customers' ? 'Farmers' : aud === 'dealers' ? 'Dealers' : 'Everyone'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Generate Button */}
              <div>
                <button
                  type="button"
                  onClick={handleGenerateAdvisory}
                  disabled={previewAdvisoryMutation.isPending}
                  className="w-full flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-indigo-600 via-indigo-700 to-emerald-600 py-3.5 px-6 text-sm font-black uppercase tracking-[0.14em] text-white shadow-[0_10px_25px_rgba(79,70,229,0.25)] transition hover:opacity-95 disabled:opacity-50"
                >
                  <RefreshCw
                    size={18}
                    className={previewAdvisoryMutation.isPending ? 'animate-spin' : ''}
                  />
                  <span>
                    {previewAdvisoryMutation.isPending
                      ? 'Analyzing Catalog & Indian Seasons...'
                      : '⚡ Ask Gemini to Generate Today\'s Advisory'}
                  </span>
                </button>
              </div>

              {/* Advisory Preview & Edit Form */}
              {aiAdvisory ? (
                <div className="space-y-4 pt-2">
                  {/* Recommended Product Banner */}
                  <div className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-4 flex items-center gap-4">
                    <img
                      src={aiAdvisory.productImage}
                      alt={aiAdvisory.productTitle}
                      className="h-16 w-16 rounded-xl object-cover bg-white border border-emerald-200 shrink-0"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="rounded-full bg-emerald-600 text-white text-[10px] font-black px-2 py-0.5 uppercase">
                          AI Chosen Solution
                        </span>
                        <span className="text-xs font-bold text-slate-500">
                          Focal Crop: <strong className="text-slate-800">{aiAdvisory.targetCrop}</strong>
                        </span>
                      </div>
                      <h4 className="font-black text-slate-900 text-sm mt-1 truncate">
                        {aiAdvisory.productTitle}
                      </h4>
                      <p className="text-xs text-emerald-800 font-semibold truncate">
                        🎯 Target Issue: {aiAdvisory.targetIssue}
                      </p>
                    </div>
                    {aiAdvisory.productLink ? (
                      <a
                        href={aiAdvisory.productLink}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-xl border border-emerald-300 bg-white p-2 text-emerald-700 hover:bg-emerald-50 transition shrink-0"
                      >
                        <ExternalLink size={16} />
                      </a>
                    ) : null}
                  </div>

                  {/* Push Notification Fields */}
                  <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50/50 p-4">
                    <span className="text-xs font-black uppercase tracking-[0.14em] text-indigo-700 flex items-center gap-1.5">
                      <Smartphone size={14} /> In-App Push Notification (Editable)
                    </span>
                    <div>
                      <label className="text-[11px] font-bold text-slate-500">Push Title (Max 45 chars)</label>
                      <input
                        type="text"
                        value={aiAdvisory.pushTitle}
                        onChange={(e) =>
                          setAiAdvisory({ ...aiAdvisory, pushTitle: e.target.value })
                        }
                        className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-900 outline-none focus:border-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-bold text-slate-500">Push Body (Max 95 chars)</label>
                      <input
                        type="text"
                        value={aiAdvisory.pushBody}
                        onChange={(e) =>
                          setAiAdvisory({ ...aiAdvisory, pushBody: e.target.value })
                        }
                        className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-800 outline-none focus:border-indigo-500"
                      />
                    </div>
                  </div>

                  {/* WhatsApp Copy Field */}
                  <div className="space-y-2 rounded-2xl border border-slate-200 bg-slate-50/50 p-4">
                    <span className="text-xs font-black uppercase tracking-[0.14em] text-emerald-700 flex items-center gap-1.5">
                      <MessageSquare size={14} /> WhatsApp Crop Advisory Copy (Pure Respectful Hindi)
                    </span>
                    <textarea
                      rows={5}
                      value={aiAdvisory.whatsappMessage}
                      onChange={(e) =>
                        setAiAdvisory({ ...aiAdvisory, whatsappMessage: e.target.value })
                      }
                      className="w-full resize-none rounded-xl border border-slate-300 bg-white p-3 text-xs font-medium text-slate-800 outline-none focus:border-emerald-500"
                    />
                  </div>

                  {/* Dispatch Controls */}
                  <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-4">
                        <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-700">
                          <input
                            type="checkbox"
                            checked={dispatchPush}
                            onChange={(e) => setDispatchPush(e.target.checked)}
                            className="rounded text-indigo-600 focus:ring-indigo-500 h-4 w-4"
                          />
                          <span>Send In-App Push</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-700">
                          <input
                            type="checkbox"
                            checked={dispatchWhatsApp}
                            onChange={(e) => setDispatchWhatsApp(e.target.checked)}
                            className="rounded text-emerald-600 focus:ring-emerald-500 h-4 w-4"
                          />
                          <span>Send WhatsApp</span>
                        </label>
                      </div>

                      {/* Test Mode Switch */}
                      <label className="flex items-center gap-2 cursor-pointer text-xs font-black text-amber-700">
                        <input
                          type="checkbox"
                          checked={isTestMode}
                          onChange={(e) => setIsTestMode(e.target.checked)}
                          className="rounded text-amber-600 focus:ring-amber-500 h-4 w-4"
                        />
                        <span>🧪 Send Test First</span>
                      </label>
                    </div>

                    {/* Delivery mode switcher for WhatsApp */}
                    {dispatchWhatsApp && (
                      <div className="rounded-xl bg-slate-50 p-2.5 border border-slate-200">
                        <span className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">
                          WhatsApp Message Format
                        </span>
                        <div className="mt-1.5 grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={() => setAiTemplateMode('custom')}
                            className={`rounded-xl border p-2 text-left transition flex items-center gap-2 ${
                              aiTemplateMode === 'custom'
                                ? 'border-emerald-600 bg-emerald-50 text-emerald-950 font-black shadow-xs'
                                : 'border-slate-200 bg-white text-slate-600'
                            }`}
                          >
                            <span className="text-emerald-600 font-bold">💬</span>
                            <div>
                              <span className="block text-xs">Direct Message (Not Template)</span>
                              <span className="block text-[10px] text-slate-500 font-normal">Full Hindi advice + Photo header</span>
                            </div>
                          </button>
                          <button
                            type="button"
                            onClick={() => setAiTemplateMode('vaniki')}
                            className={`rounded-xl border p-2 text-left transition flex items-center gap-2 ${
                              aiTemplateMode === 'vaniki'
                                ? 'border-emerald-600 bg-emerald-50 text-emerald-950 font-black shadow-xs'
                                : 'border-slate-200 bg-white text-slate-600'
                            }`}
                          >
                            <span className="text-emerald-600 font-bold">🌟</span>
                            <div>
                              <span className="block text-xs">Approved Template (vaniki)</span>
                              <span className="block text-[10px] text-slate-500 font-normal">100% delivery outside 24h window</span>
                            </div>
                          </button>
                        </div>
                      </div>
                    )}

                    {isTestMode && (
                      <div className="flex items-center gap-2 bg-amber-50 p-2.5 rounded-xl border border-amber-200">
                        <span className="text-xs font-bold text-amber-900 shrink-0">Test Mobile:</span>
                        <input
                          type="text"
                          value={testNumber}
                          onChange={(e) => setTestNumber(e.target.value)}
                          placeholder="e.g. 9301105706"
                          className="rounded-lg border border-amber-300 px-3 py-1 text-xs font-bold text-slate-900 bg-white outline-none focus:border-amber-500 min-w-0 flex-1"
                        />
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={handleBroadcastAiCampaign}
                      disabled={
                        triggerAiCampaignMutation.isPending || (!dispatchPush && !dispatchWhatsApp)
                      }
                      className="w-full flex items-center justify-center gap-2 rounded-2xl bg-emerald-600 py-3.5 px-6 text-sm font-black uppercase tracking-[0.14em] text-white shadow-[0_10px_25px_rgba(5,150,105,0.25)] transition hover:bg-emerald-700 disabled:opacity-50"
                    >
                      <Send
                        size={16}
                        className={triggerAiCampaignMutation.isPending ? 'animate-pulse' : ''}
                      />
                      <span>
                        {triggerAiCampaignMutation.isPending
                          ? 'Dispatching AI Broadcast...'
                          : isTestMode
                            ? `🚀 Send Test Broadcast to ${testNumber}`
                            : `🚀 Broadcast to All ${
                                aiAudience === 'customers'
                                  ? 'Farmers'
                                  : aiAudience === 'dealers'
                                    ? 'Dealers'
                                    : 'Recipients'
                              }`}
                      </span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-slate-500 text-xs font-semibold">
                  Click <strong>"⚡ Ask Gemini to Generate Today's Advisory"</strong> to let AI inspect today's catalog and generate the campaign.
                </div>
              )}
            </div>

            {/* Right: Live Preview & AI Campaign History */}
            <div className="space-y-6">
              {/* WhatsApp Live Preview */}
              <div className="rounded-[1.5rem] border border-slate-200 bg-white p-6 shadow-sm">
                <h3 className="text-xs font-black uppercase tracking-[0.14em] text-slate-500 flex items-center gap-1.5">
                  <MessageSquare size={14} className="text-emerald-600" />
                  Live WhatsApp Message Preview (Approved Template)
                </h3>

                <div className="mt-3 rounded-2xl bg-[#EFEAE2] p-4 shadow-inner">
                  <div className="max-w-[340px] rounded-2xl rounded-tl-none bg-white p-3 shadow-md">
                    {aiAdvisory?.productImage ? (
                      <img
                        src={aiAdvisory.productImage}
                        alt="Product Header"
                        className="mb-2 max-h-44 w-full rounded-xl object-cover"
                      />
                    ) : (
                      <div className="mb-2 h-32 w-full rounded-xl bg-slate-100 flex items-center justify-center text-slate-400 text-xs font-bold">
                        Product Photo Header
                      </div>
                    )}
                    <p className="text-xs font-black text-slate-900">
                      🌾 {aiAdvisory?.productTitle || 'Vaniki Crop Science Advisory'}
                    </p>
                    <p className="mt-1 whitespace-pre-wrap text-[11px] font-medium text-slate-800 leading-relaxed">
                      {aiAdvisory?.whatsappMessage ||
                        'Crop Care Special: Vaniki Crop Science brings certified agrochemical solutions directly to your farm.'}
                    </p>
                    <div className="mt-2.5 border-t border-slate-100 pt-2 text-center">
                      <span className="inline-block text-[11px] font-black text-emerald-700">
                        🔗 Visit Vaniki Portal ➔
                      </span>
                    </div>
                    <div className="mt-1 text-right text-[9px] text-slate-400">08:30 AM ✓✓</div>
                  </div>
                </div>

                {/* In-App Notification pill preview */}
                <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3 shadow-xs">
                  <div className="flex items-center gap-2">
                    <div className="h-4 w-4 rounded bg-primary-600 text-center text-[9px] font-bold text-white leading-4">
                      V
                    </div>
                    <span className="text-[10px] font-bold text-slate-500">Vaniki Crop App • Just Now</span>
                  </div>
                  <p className="mt-1 text-xs font-black text-slate-900">
                    {aiAdvisory?.pushTitle || '🌾 धान में कीट सुरक्षा ऑफर'}
                  </p>
                  <p className="text-[11px] text-slate-600">
                    {aiAdvisory?.pushBody || 'Vaniki की प्रमाणित दवा से फसल को सुरक्षित रखें। आज ही ऑर्डर करें!'}
                  </p>
                </div>
              </div>

              {/* AI Campaign History Table */}
              <div className="rounded-[1.5rem] border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex items-center justify-between gap-3 mb-4">
                  <div>
                    <h3 className="text-base font-black text-slate-900 flex items-center gap-1.5">
                      <Clock size={16} className="text-indigo-600" />
                      Past AI Broadcast Logs
                    </h3>
                    <p className="text-xs text-slate-500">History of automated & manual AI campaigns.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => aiHistoryQuery.refetch()}
                    className="rounded-xl border border-slate-200 p-1.5 text-slate-600 hover:bg-slate-50"
                  >
                    <RefreshCw size={14} className={aiHistoryQuery.isFetching ? 'animate-spin' : ''} />
                  </button>
                </div>

                <div className="space-y-2.5 max-h-[360px] overflow-y-auto pr-1">
                  {aiHistoryQuery.data?.logs?.length ? (
                    aiHistoryQuery.data.logs.map((log: any) => (
                      <div
                        key={log._id || log.id}
                        className="rounded-xl border border-slate-100 bg-slate-50/70 p-3 hover:bg-slate-100/60 transition"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md">
                              {log.date} • {log.triggerType === 'scheduled' ? '⏰ Auto-Pilot' : '⚡ Manual'}
                            </span>
                            <h5 className="font-black text-slate-900 text-xs mt-1">
                              {log.productTitle} ({log.targetCrop})
                            </h5>
                            <p className="text-[11px] text-slate-500 truncate max-w-[240px]">
                              {log.targetIssue}
                            </p>
                          </div>
                          <div className="text-right shrink-0">
                            <span
                              className={`inline-block rounded-md px-1.5 py-0.5 text-[9px] font-black uppercase ${
                                log.status === 'completed'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : log.status === 'partial'
                                    ? 'bg-amber-100 text-amber-800'
                                    : 'bg-rose-100 text-rose-800'
                              }`}
                            >
                              {log.status}
                            </span>
                            <p className="text-[10px] font-bold text-slate-500 mt-1">
                              WA: {log.waSentCount} | Push: {log.pushSentCount}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="rounded-xl border border-dashed border-slate-200 p-6 text-center text-xs text-slate-400">
                      No AI marketing broadcasts executed yet.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================= CHANNEL 2 & 3: MANUAL WHATSAPP & PUSH ================= */}
      {channel !== 'ai' && (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          {/* ================= CHANNEL: WHATSAPP BROADCAST ================= */}
          {channel === 'whatsapp' ? (
            <form className="rounded-[1.5rem] border border-emerald-100 bg-white p-6 shadow-sm" onSubmit={handleWaSubmit}>
              <div className="flex items-center gap-3">
                <div className="rounded-2xl bg-emerald-50 p-3 text-emerald-600">
                  <MessageSquare size={22} />
                </div>
                <div>
                  <h2 className="text-lg font-black text-slate-900">Compose WhatsApp Broadcast</h2>
                  <p className="text-sm text-slate-500">Send promotional offers with banner image, text, and target page link.</p>
                </div>
              </div>

              <div className="mt-6 space-y-4">
                <div>
                  <span className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">Delivery Mode</span>
                  <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setForm((cur) => ({ ...cur, templateMode: 'vaniki' }))}
                      className={`rounded-2xl border p-3 text-left transition flex items-start gap-2.5 ${
                        form.templateMode === 'vaniki'
                          ? 'border-emerald-600 bg-emerald-50/80 shadow-sm text-emerald-950'
                          : 'border-slate-200 bg-slate-50 text-slate-600 hover:border-emerald-300'
                      }`}
                    >
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white text-xs font-bold mt-0.5">✓</span>
                      <div>
                        <span className="block text-xs font-black text-slate-900">Approved Template (vaniki)</span>
                        <span className="block text-[11px] font-semibold text-emerald-700 mt-0.5">
                          🌟 100% Delivery to everyone outside 24h window (Photo Header)
                        </span>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setForm((cur) => ({ ...cur, templateMode: 'custom' }))}
                      className={`rounded-2xl border p-3 text-left transition flex items-start gap-2.5 ${
                        form.templateMode === 'custom'
                          ? 'border-emerald-600 bg-emerald-50/80 shadow-sm text-emerald-950'
                          : 'border-slate-200 bg-slate-50 text-slate-600 hover:border-emerald-300'
                      }`}
                    >
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-400 text-white text-xs font-bold mt-0.5">💬</span>
                      <div>
                        <span className="block text-xs font-black text-slate-900">Custom Text / Chat</span>
                        <span className="block text-[11px] font-semibold text-slate-500 mt-0.5">
                          Direct text (only users who messaged in last 24h)
                        </span>
                      </div>
                    </button>
                  </div>
                </div>

                <div>
                  <span className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">Target Audience</span>
                  <div className="mt-2 grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {WA_AUDIENCE_OPTIONS.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => setForm((cur) => ({ ...cur, waAudience: option.value }))}
                        className={`rounded-2xl border p-3 text-left transition ${
                          form.waAudience === option.value
                            ? 'border-emerald-600 bg-emerald-50 text-emerald-900 shadow-sm'
                            : 'border-slate-200 bg-slate-50 text-slate-600 hover:border-emerald-300'
                        }`}
                      >
                        <span className="block text-xs font-black">{option.label}</span>
                        <span className="block text-[10px] text-slate-500">{option.hint}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {form.waAudience === 'custom' && (
                  <label className="block">
                    <span className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">
                      Specific Mobile Numbers (comma or newline separated)
                    </span>
                    <textarea
                      value={form.customNumbers}
                      rows={3}
                      onChange={(e) => setForm((cur) => ({ ...cur, customNumbers: e.target.value }))}
                      className="mt-2 w-full resize-none rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm font-semibold text-slate-900 outline-none focus:border-emerald-400"
                      placeholder="9301105706, 9407963966, 6266838334"
                    />
                  </label>
                )}

                <label className="block">
                  <span className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">Banner Image URL (Product or Promo Poster)</span>
                  <div className="mt-2 flex items-center gap-2 rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3">
                    <ImageIcon size={16} className="text-emerald-600" />
                    <input
                      value={form.imageUrl}
                      onChange={(e) => setForm((cur) => ({ ...cur, imageUrl: e.target.value }))}
                      className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-slate-900 outline-none"
                      placeholder="https://vanikicrop.com/uploads/.../banner.jpg"
                    />
                  </div>
                </label>

                {form.templateMode === 'custom' && (
                  <>
                    <label className="block">
                      <span className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">Headline / Title (Optional)</span>
                      <input
                        value={form.title}
                        onChange={(e) => setForm((cur) => ({ ...cur, title: e.target.value }))}
                        className="mt-2 w-full rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm font-semibold text-slate-900 outline-none focus:border-emerald-400"
                        placeholder="🔥 मानसून स्पेशल बंपर ऑफर!"
                      />
                    </label>

                    <label className="block">
                      <span className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">Message Text</span>
                      <textarea
                        value={form.body}
                        rows={4}
                        onChange={(e) => setForm((cur) => ({ ...cur, body: e.target.value }))}
                        className="mt-2 w-full resize-none rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm font-semibold text-slate-900 outline-none focus:border-emerald-400"
                        placeholder="अपनी धान व सब्जी की फसलों को रोगों से बचाएं। Vaniki Crop पर पाएं भारी छूट!"
                      />
                    </label>
                  </>
                )}

                <label className="block">
                  <span className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">Target Link</span>
                  <div className="mt-2 flex items-center gap-2 rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3">
                    <Link2 size={16} className="text-emerald-600" />
                    <input
                      value={form.link}
                      onChange={(e) => setForm((cur) => ({ ...cur, link: e.target.value }))}
                      className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-slate-900 outline-none"
                      placeholder="/products or https://vanikicrop.com/products"
                    />
                  </div>
                </label>

                {waResult ? (
                  <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-bold text-emerald-900 flex items-center justify-between">
                    <span>Campaign Delivery:</span>
                    <span>Total: {waResult.total || 0} | Sent: {waResult.sent || 0} | Failed: {waResult.failed || 0}</span>
                  </div>
                ) : null}

                {message ? (
                  <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-800">
                    {message}
                  </div>
                ) : null}

                <button
                  type="submit"
                  disabled={!canSendWa}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-black uppercase tracking-[0.14em] text-white shadow-[0_12px_30px_rgba(5,150,105,0.22)] transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                >
                  <Send size={16} />
                  {sendWaMutation.isPending ? 'Sending WhatsApp Campaign...' : 'Broadcast to WhatsApp'}
                </button>
              </div>
            </form>
          ) : (
            /* ================= CHANNEL: PUSH NOTIFICATION ================= */
            <form className="rounded-[1.5rem] border border-primary-100 bg-white p-6 shadow-sm" onSubmit={handlePushSubmit}>
              <div className="flex items-center gap-3">
                <div className="rounded-2xl bg-primary-50 p-3 text-primary-600">
                  <Smartphone size={22} />
                </div>
                <div>
                  <h2 className="text-lg font-black text-slate-900">Send Mobile Push Notification</h2>
                  <p className="text-sm text-slate-500">Push to farmers and dealers via FCM / Expo.</p>
                </div>
              </div>

              <div className="mt-6 space-y-4">
                <div>
                  <span className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">Target Audience</span>
                  <div className="mt-2 grid grid-cols-3 gap-2">
                    {AUDIENCE_OPTIONS.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => setForm((current) => ({ ...current, targetAudience: option.value }))}
                        className={`rounded-2xl border p-3 text-left transition ${
                          form.targetAudience === option.value
                            ? 'border-primary-500 bg-primary-50 text-primary-900 shadow-sm'
                            : 'border-slate-200 bg-slate-50 text-slate-600 hover:border-primary-200'
                        }`}
                      >
                        <span className="block text-xs font-black">{option.label}</span>
                        <span className="block text-[10px] text-slate-500">{option.hint}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <label className="block">
                  <span className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">Title</span>
                  <input
                    value={form.title}
                    maxLength={100}
                    onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
                    className="mt-2 w-full rounded-2xl border border-primary-100 bg-primary-50 px-4 py-3 text-sm font-semibold text-slate-900 outline-none focus:border-primary-400"
                    placeholder="🌾 Special Crop Advisory"
                  />
                </label>

                <label className="block">
                  <span className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">Message</span>
                  <textarea
                    value={form.body}
                    maxLength={220}
                    rows={5}
                    onChange={(event) => setForm((current) => ({ ...current, body: event.target.value }))}
                    className="mt-2 w-full resize-none rounded-2xl border border-primary-100 bg-primary-50 px-4 py-3 text-sm font-semibold text-slate-900 outline-none focus:border-primary-400"
                    placeholder="Tap to view recommended products for your crop."
                  />
                </label>

                <label className="block">
                  <span className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">Open link on tap</span>
                  <div className="mt-2 flex items-center gap-2 rounded-2xl border border-primary-100 bg-primary-50 px-4 py-3">
                    <Link2 size={16} className="text-primary-600" />
                    <input
                      value={form.link}
                      maxLength={500}
                      onChange={(event) => setForm((current) => ({ ...current, link: event.target.value }))}
                      className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-slate-900 outline-none"
                      placeholder="/products or https://vanikicrop.com/products"
                    />
                  </div>
                </label>

                {message ? (
                  <div className="rounded-2xl border border-primary-100 bg-primary-50 px-4 py-3 text-sm font-bold text-primary-800">
                    {message}
                  </div>
                ) : null}

                <button
                  type="submit"
                  disabled={!canSendPush}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl bg-primary-500 px-5 py-3 text-sm font-black uppercase tracking-[0.14em] text-white shadow-[0_12px_30px_rgba(45,106,79,0.22)] transition hover:bg-primary-600 disabled:cursor-not-allowed disabled:bg-slate-300"
                >
                  <Send size={16} />
                  {sendPushMutation.isPending ? 'Sending...' : 'Send notification'}
                </button>
              </div>
            </form>
          )}

          {/* ================= RIGHT COLUMN: LIVE PREVIEW & RECENT STATS ================= */}
          <div className="space-y-6">
            {/* Live Preview Card */}
            <div className="rounded-[1.5rem] border border-slate-200 bg-white p-6 shadow-sm">
              <h3 className="text-sm font-black uppercase tracking-[0.14em] text-slate-500">
                Live {channel === 'whatsapp' ? 'WhatsApp Message' : 'Push Notification'} Preview
              </h3>

              {channel === 'whatsapp' ? (
                <div className="mt-4 rounded-2xl bg-[#EFEAE2] p-4 shadow-inner">
                  <div className="max-w-[340px] rounded-2xl rounded-tl-none bg-white p-3 shadow-md">
                    {form.imageUrl ? (
                      <img
                        src={form.imageUrl}
                        alt="Campaign Banner"
                        className="mb-2 max-h-48 w-full rounded-xl object-cover"
                        onError={(e) => ((e.target as HTMLElement).style.display = 'none')}
                      />
                    ) : null}
                    {form.title ? (
                      <p className="text-sm font-black text-slate-900">{form.title}</p>
                    ) : null}
                    <p className="mt-1 whitespace-pre-wrap text-xs font-medium text-slate-800">
                      {form.body || 'Type your message on the left to see live preview...'}
                    </p>
                    {form.link ? (
                      <div className="mt-3 border-t border-slate-100 pt-2 text-center">
                        <span className="inline-block text-xs font-bold text-emerald-700">
                          🔗 यहाँ क्लिक करके ऑफर देखें ➔
                        </span>
                      </div>
                    ) : null}
                    <div className="mt-1 text-right text-[10px] text-slate-400">12:00 PM ✓✓</div>
                  </div>
                </div>
              ) : (
                <div className="mt-4 rounded-2xl bg-slate-100 p-4">
                  <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                    <div className="flex items-center gap-2">
                      <div className="h-5 w-5 rounded bg-primary-600 text-center text-[10px] font-bold text-white">V</div>
                      <span className="text-xs font-bold text-slate-500">Vaniki Crop • Now</span>
                    </div>
                    <p className="mt-2 text-sm font-black text-slate-900">{form.title || 'Notification Title'}</p>
                    <p className="mt-1 text-xs text-slate-600">{form.body || 'Notification message body...'}</p>
                    {form.link ? <p className="mt-2 text-[10px] font-bold text-primary-700">{form.link}</p> : null}
                  </div>
                </div>
              )}
            </div>

            {/* History Column */}
            <div className="rounded-[1.5rem] border border-primary-100 bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-black text-slate-900">Campaign History</h2>
                  <p className="text-sm text-slate-500">Recent customer notification broadcasts.</p>
                </div>
                <div className="rounded-2xl bg-primary-50 p-3 text-primary-600">
                  <Users size={20} />
                </div>
              </div>

              <div className="mt-5 space-y-3">
                {notificationsQuery.data?.data.length ? (
                  notificationsQuery.data.data.map((campaign) => (
                    <div key={campaign.id} className="rounded-2xl border border-primary-100 bg-primary-50/50 p-4">
                      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                        <div>
                          <p className="text-base font-black text-slate-900">{campaign.title}</p>
                          <p className="mt-1 text-sm leading-6 text-slate-600">{campaign.body}</p>
                          {campaign.link ? (
                            <p className="mt-2 text-xs font-bold text-primary-700">{campaign.link}</p>
                          ) : null}
                        </div>
                        <div className="shrink-0 rounded-2xl bg-white px-3 py-2 text-right">
                          <p className="text-sm font-black text-primary-700">
                            {getDeliveryRate(campaign.sentCount, campaign.totalRecipients)}
                          </p>
                          <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">sent</p>
                        </div>
                      </div>
                      <div className="mt-4 grid gap-2 text-xs font-bold text-slate-500 md:grid-cols-4">
                        <span>Total: {campaign.totalRecipients}</span>
                        <span>Sent: {campaign.sentCount}</span>
                        <span>Failed: {campaign.failedCount}</span>
                        <span>{formatDate(campaign.createdAt)}</span>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="rounded-2xl border border-dashed border-primary-100 bg-primary-50/40 p-6 text-center text-sm font-semibold text-slate-500">
                    No notification history yet.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
