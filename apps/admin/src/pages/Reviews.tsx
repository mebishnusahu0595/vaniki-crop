import { useQuery, useQueryClient } from '@tanstack/react-query';
import { PageHeader } from '../components/PageHeader';
import { LoadingBlock } from '../components/LoadingBlock';
import { adminApi } from '../utils/api';
import { formatDateTime } from '../utils/format';

export default function ReviewsPage() {
  const queryClient = useQueryClient();
  const reviewsQuery = useQuery({
    queryKey: ['admin-reviews'],
    queryFn: () => adminApi.reviews({ limit: 100 }),
  });

  if (reviewsQuery.isLoading) return <LoadingBlock label="Loading reviews..." />;

  return (
    <div className="space-y-6">
      <PageHeader title="Reviews" subtitle="Approve or remove pending reviews for products in your store." />
      <div className="grid gap-4">
        {reviewsQuery.data?.data.map((review) => (
          <div key={review.id} className="rounded-[1.5rem] border border-primary-100 bg-white p-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div>
                <p className="text-lg font-black text-slate-900">{review.productId?.name || 'Product review'}</p>
                <p className="mt-1 text-sm text-slate-500">
                  {review.userId?.name || 'Customer'} · {review.userId?.mobile || review.userId?.email || '-'}
                </p>
                <p className="mt-3 text-sm leading-7 text-slate-600">{review.comment || 'No comment'}</p>
                <p className="mt-2 text-xs font-semibold uppercase tracking-[0.16em] text-primary-500">
                  {review.rating} / 5 · {formatDateTime(review.createdAt)}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={async () => {
                    await adminApi.approveReview(review.id);
                    queryClient.invalidateQueries({ queryKey: ['admin-reviews'] });
                    queryClient.invalidateQueries({ queryKey: ['admin-shell-analytics'] });
                  }}
                  className="rounded-xl bg-primary-500 px-4 py-2 text-sm font-semibold text-white"
                >
                  Approve
                </button>
                <button
                  onClick={async () => {
                    if (!window.confirm('Delete this review?')) return;
                    await adminApi.deleteReview(review.id);
                    queryClient.invalidateQueries({ queryKey: ['admin-reviews'] });
                    queryClient.invalidateQueries({ queryKey: ['admin-shell-analytics'] });
                  }}
                  className="rounded-xl border border-rose-100 px-4 py-2 text-sm font-semibold text-rose-600"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
