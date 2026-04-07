export function LoadingBlock({ label = 'Loading...' }: { label?: string }) {
  return (
    <div className="rounded-[1.5rem] border border-primary-100 bg-white p-8 text-center text-sm font-semibold text-slate-500">
      {label}
    </div>
  );
}
