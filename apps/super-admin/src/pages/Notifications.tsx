import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell, Image as ImageIcon, Link2, MessageSquare, Send, Smartphone, Users } from 'lucide-react';
import { PageHeader } from '../components/PageHeader';
import { LoadingBlock } from '../components/LoadingBlock';
import { adminApi } from '../utils/api';
import { formatDate } from '../utils/format';

type Channel = 'push' | 'whatsapp';
type Audience = 'customers' | 'dealers' | 'both';
type WhatsAppAudience = 'customers' | 'dealers' | 'all' | 'custom';

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
  imageUrl: '',
  customNumbers: '',
  targetAudience: 'customers' as Audience,
  waAudience: 'customers' as WhatsAppAudience,
};

function getDeliveryRate(sent: number, total: number) {
  if (!total) return '0%';
  return `${Math.round((sent / total) * 100)}%`;
}

export default function NotificationsPage() {
  const queryClient = useQueryClient();
  const [channel, setChannel] = useState<Channel>('whatsapp');
  const [form, setForm] = useState(defaultForm);
  const [message, setMessage] = useState('');
  const [waResult, setWaResult] = useState<{ total?: number; sent?: number; failed?: number } | null>(null);

  const notificationsQuery = useQuery({
    queryKey: ['super-admin-notifications'],
    queryFn: () => adminApi.notifications({ limit: 50 }),
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
      form.body.trim().length >= 3 &&
      !sendWaMutation.isPending &&
      (form.waAudience !== 'custom' || form.customNumbers.trim().length >= 10),
    [form.body, form.waAudience, form.customNumbers, sendWaMutation.isPending],
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
    });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Marketing & Notifications"
        subtitle="Broadcast promotional messages with images and links via WhatsApp or send Mobile App Push Notifications."
      />

      {/* Channel Switcher Tabs */}
      <div className="flex items-center gap-3">
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
          <span>WhatsApp Broadcast (Promotions + Images)</span>
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
                <span className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">Send to Audience</span>
                <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {WA_AUDIENCE_OPTIONS.map((opt) => {
                    const active = form.waAudience === opt.value;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setForm((cur) => ({ ...cur, waAudience: opt.value }))}
                        className={`rounded-2xl border px-3 py-2.5 text-center transition ${
                          active
                            ? 'border-emerald-600 bg-emerald-600 text-white shadow-sm'
                            : 'border-slate-200 bg-slate-50 text-slate-700 hover:border-emerald-300'
                        }`}
                      >
                        <span className="block text-xs font-black">{opt.label}</span>
                        <span className={`block text-[10px] font-bold ${active ? 'text-white/80' : 'text-slate-400'}`}>
                          {opt.hint}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {form.waAudience === 'custom' && (
                <label className="block">
                  <span className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">
                    Mobile Numbers (Comma or Newline separated)
                  </span>
                  <textarea
                    rows={2}
                    value={form.customNumbers}
                    onChange={(e) => setForm((cur) => ({ ...cur, customNumbers: e.target.value }))}
                    placeholder="9407963966, 9876543210..."
                    className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-semibold text-slate-900 outline-none focus:border-emerald-500"
                  />
                </label>
              )}

              <label className="block">
                <span className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">
                  Campaign Title / Offer Heading (Bold)
                </span>
                <input
                  value={form.title}
                  maxLength={100}
                  onChange={(e) => setForm((cur) => ({ ...cur, title: e.target.value }))}
                  className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-900 outline-none focus:border-emerald-500"
                  placeholder="🌾 खरीफ स्पेशल ऑफर - कीटनाशक पर 20% छूट!"
                />
              </label>

              <label className="block">
                <span className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">
                  Promotional Message Text
                </span>
                <textarea
                  value={form.body}
                  rows={4}
                  onChange={(e) => setForm((cur) => ({ ...cur, body: e.target.value }))}
                  className="mt-2 w-full resize-none rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-900 outline-none focus:border-emerald-500"
                  placeholder="किसान भाइयों, अपनी धान व मक्का की फसल को कीटों से बचाएं। Vaniki Crop पर सभी प्रमाणित दवाएं उपलब्ध हैं। फ्री होम डिलीवरी के साथ आज ही मंगाएं!"
                />
              </label>

              <label className="block">
                <span className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">
                  Promotional Image URL (Optional)
                </span>
                <div className="mt-2 flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <ImageIcon size={18} className="text-emerald-600 shrink-0" />
                  <input
                    value={form.imageUrl}
                    onChange={(e) => setForm((cur) => ({ ...cur, imageUrl: e.target.value }))}
                    className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-slate-900 outline-none"
                    placeholder="https://res.cloudinary.com/vaniki/... or https://..."
                  />
                </div>
              </label>

              <label className="block">
                <span className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">
                  Destination Page Link (Where farmer taps to view offer)
                </span>
                <div className="mt-2 flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <Link2 size={18} className="text-emerald-600 shrink-0" />
                  <input
                    value={form.link}
                    onChange={(e) => setForm((cur) => ({ ...cur, link: e.target.value }))}
                    className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-slate-900 outline-none"
                    placeholder="/products or /product/slug or https://vanikicrop.com/offers"
                  />
                </div>
              </label>

              {message ? (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-900">
                  {message}
                  {waResult?.total ? (
                    <div className="mt-2 flex gap-4 text-xs font-semibold text-emerald-800">
                      <span>Total: {waResult.total}</span>
                      <span>Delivered: {waResult.sent}</span>
                      <span>Failed: {waResult.failed}</span>
                    </div>
                  ) : null}
                </div>
              ) : null}

              <button
                type="submit"
                disabled={!canSendWa}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-5 py-3.5 text-sm font-black uppercase tracking-[0.14em] text-white shadow-[0_8px_20px_rgba(5,150,105,0.25)] transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                <Send size={18} />
                {sendWaMutation.isPending ? 'Sending WhatsApp Broadcast...' : 'Broadcast on WhatsApp'}
              </button>
            </div>
          </form>
        ) : (
          /* ================= CHANNEL: PUSH NOTIFICATION ================= */
          <form className="rounded-[1.5rem] border border-primary-100 bg-white p-6 shadow-sm" onSubmit={handlePushSubmit}>
            <div className="flex items-center gap-3">
              <div className="rounded-2xl bg-primary-50 p-3 text-primary-600">
                <Bell size={22} />
              </div>
              <div>
                <h2 className="text-lg font-black text-slate-900">Compose Push Notification</h2>
                <p className="text-sm text-slate-500">Send customer and dealer mobile app notifications.</p>
              </div>
            </div>

            <div className="mt-6 space-y-4">
              <div>
                <span className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">Send to</span>
                <div className="mt-2 grid grid-cols-3 gap-2">
                  {AUDIENCE_OPTIONS.map((opt) => {
                    const active = form.targetAudience === opt.value;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setForm((cur) => ({ ...cur, targetAudience: opt.value }))}
                        className={`rounded-2xl border px-3 py-3 text-center transition ${
                          active
                            ? 'border-primary-500 bg-primary-500 text-white shadow-[0_10px_24px_rgba(45,106,79,0.22)]'
                            : 'border-primary-100 bg-primary-50 text-slate-600 hover:border-primary-300'
                        }`}
                      >
                        <span className="block text-sm font-black">{opt.label}</span>
                        <span className={`block text-[10px] font-bold uppercase tracking-[0.1em] ${active ? 'text-white/75' : 'text-slate-400'}`}>
                          {opt.hint}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <label className="block">
                <span className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">Title</span>
                <input
                  value={form.title}
                  maxLength={80}
                  onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
                  className="mt-2 w-full rounded-2xl border border-primary-100 bg-primary-50 px-4 py-3 text-sm font-semibold text-slate-900 outline-none focus:border-primary-400"
                  placeholder="Monsoon pesticide offer"
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
                {/* WhatsApp Chat Bubble */}
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
    </div>
  );
}
