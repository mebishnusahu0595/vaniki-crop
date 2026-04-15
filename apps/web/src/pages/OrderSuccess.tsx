import React from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2 } from 'lucide-react';

const OrderSuccess: React.FC = () => {
  return (
    <div className="container mx-auto flex min-h-[70vh] items-center justify-center px-4 py-10 sm:px-6">
      <div className="surface-card max-w-2xl p-8 text-center sm:p-12">
        <div className="mx-auto flex h-28 w-28 items-center justify-center rounded-full bg-emerald-500 text-white ring-8 ring-emerald-50 shadow-xl shadow-emerald-300/60">
          <CheckCircle2 size={54} />
        </div>
        <p className="section-kicker mt-6 text-emerald-600">Order Confirmed</p>
        <h1 className="mt-3 font-heading text-5xl text-primary-900">Order Placed Successfully</h1>
        <p className="mt-4 text-base font-medium leading-8 text-primary-900/60">
          Your order is confirmed. We will start processing it right away.
        </p>

        <div className="mx-auto mt-8 flex w-full max-w-xs flex-col gap-3">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-full bg-primary px-6 py-3 text-sm font-black uppercase tracking-[0.2em] text-white transition hover:bg-primary-600"
          >
            Go to Home
          </Link>
        </div>
      </div>
    </div>
  );
};

export default OrderSuccess;
