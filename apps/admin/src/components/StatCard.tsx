import type { ReactNode } from 'react';

export function StatCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: ReactNode;
}) {
  return (
    <div className="rounded-[1.5rem] border border-primary-100 bg-white p-5 shadow-[0_16px_50px_rgba(15,23,42,0.05)]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.22em] text-primary-500">{label}</p>
          <p className="mt-3 text-3xl font-black text-slate-900">{value}</p>
        </div>
        <div className="rounded-2xl bg-primary-50 p-3 text-primary-600">{icon}</div>
      </div>
    </div>
  );
}
