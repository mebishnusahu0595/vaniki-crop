import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell, Link2, Send, Users } from 'lucide-react';
import { PageHeader } from '../components/PageHeader';
import { LoadingBlock } from '../components/LoadingBlock';
import { adminApi } from '../utils/api';
import { formatDate } from '../utils/format';

type Audience = 'customers' | 'dealers' | 'both';

const AUDIENCE_OPTIONS: { value: Audience; label: string; hint: string }[] = [
  { value: 'customers', label: 'Users', hint: 'Customer app' },
  { value: 'dealers', label: 'Dealers', hint: 'Dealers app' },
  { value: 'both', label: 'Both', hint: 'Users + Dealers' },
];

const defaultForm = {
  title: '',
  body: '',
  link: '',
  targetAudience: 'customers' as Audience,
};

function getDeliveryRate(sent: number, total: number) {
  if (!total) return '0%';
  return `${Math.round((sent / total) * 100)}%`;
}

export default function NotificationsPage() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState(defaultForm);
  const [message, setMessage] = useState('');

  const notificationsQuery = useQuery({
    queryKey: ['super-admin-notifications'],
    queryFn: () => adminApi.notifications({ limit: 50 }),
  });

  const sendMutation = useMutation({
    mutationFn: adminApi.sendNotification,
    onSuccess: (campaign) => {
      setForm(defaultForm);
      setMessage(`Notification sent to ${campaign.sentCount} of ${campaign.totalRecipients} registered devices.`);
      queryClient.invalidateQueries({ queryKey: ['super-admin-notifications'] });
    },
    onError: (error) => {
      setMessage(error instanceof Error ? error.message : 'Unable to send notification.');
    },
  });

  const canSend = useMemo(
    () => form.title.trim().length >= 2 && form.body.trim().length >= 3 && !sendMutation.isPending,
    [form.body, form.title, sendMutation.isPending],
  );

  if (notificationsQuery.isLoading && !notificationsQuery.data) {
    return <LoadingBlock label="Loading notification history..." />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Push Notifications"
        subtitle="Send customer app notifications with an optional destination link and keep a delivery history."
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <form
          className="rounded-[1.5rem] border border-primary-100 bg-white p-5"
          onSubmit={(event) => {
            event.preventDefault();
            setMessage('');
            sendMutation.mutate({
              title: form.title.trim(),
              body: form.body.trim(),
              link: form.link.trim() || undefined,
              targetAudience: form.targetAudience,
            });
          }}
        >
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-primary-50 p-3 text-primary-600">
              <Bell size={20} />
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-900">Compose notification</h2>
              <p className="text-sm text-slate-500">Choose who receives this notification, then compose it.</p>
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
                      onClick={() => setForm((current) => ({ ...current, targetAudience: opt.value }))}
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
              disabled={!canSend}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-primary-500 px-5 py-3 text-sm font-black uppercase tracking-[0.14em] text-white shadow-[0_12px_30px_rgba(45,106,79,0.22)] transition hover:bg-primary-600 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              <Send size={16} />
              {sendMutation.isPending ? 'Sending...' : 'Send notification'}
            </button>
          </div>
        </form>

        <div className="rounded-[1.5rem] border border-primary-100 bg-white p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-black text-slate-900">History</h2>
              <p className="text-sm text-slate-500">Latest customer notification campaigns.</p>
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
  );
}
