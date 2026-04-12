import { CheckCircle2, Clock3, MessageSquare, Plus, Trash2, XCircle } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { PageHeader } from '../components/PageHeader';
import { LoadingBlock } from '../components/LoadingBlock';
import { StatCard } from '../components/StatCard';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import type { Review } from '../types/admin';
import { adminApi } from '../utils/api';
import { formatDateTime } from '../utils/format';

const EMPTY_SUMMARY = {
  total: 0,
  pending: 0,
  approved: 0,
  rejected: 0,
};

function getReviewStatus(review: Review): 'pending' | 'approved' | 'rejected' {
  if (review.status === 'rejected') {
    return 'rejected';
  }
  if (review.status === 'approved' || review.isApproved) {
    return 'approved';
  }
  return 'pending';
}

function getStoreNames(review: Review): string {
  const stores = review.productId?.storeId ?? [];
  if (!stores.length) return '-';

  const names = stores
    .map((store) => {
      if (typeof store === 'string') return store;
      return store.name || store.id || '';
    })
    .filter((value) => Boolean(value));

  return names.length ? names.join(', ') : '-';
}

function getStatusPillClass(status: 'pending' | 'approved' | 'rejected') {
  if (status === 'approved') return 'bg-emerald-100 text-emerald-700';
  if (status === 'rejected') return 'bg-rose-100 text-rose-700';
  return 'bg-amber-100 text-amber-700';
}

export default function ReviewsPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
  const [storeId, setStoreId] = useState('');
  const [productId, setProductId] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newReviewProductId, setNewReviewProductId] = useState('');
  const [newReviewRating, setNewReviewRating] = useState(5);
  const [newReviewComment, setNewReviewComment] = useState('');
  const [approveImmediately, setApproveImmediately] = useState(false);
  const [actioningReviewId, setActioningReviewId] = useState<string | null>(null);

  const debouncedSearch = useDebouncedValue(search, 350);

  const invalidateReviewQueries = () => {
    queryClient.invalidateQueries({ queryKey: ['super-admin-reviews'] });
    queryClient.invalidateQueries({ queryKey: ['admin-shell-analytics'] });
  };

  const storesQuery = useQuery({
    queryKey: ['super-admin-review-stores'],
    queryFn: () => adminApi.stores({ limit: 200 }),
  });

  const productsQuery = useQuery({
    queryKey: ['super-admin-review-products', storeId],
    queryFn: () => {
      const params: Record<string, unknown> = { limit: 200 };
      if (storeId) {
        params.storeId = storeId;
      }
      return adminApi.products(params);
    },
    placeholderData: (previousData) => previousData,
  });

  const reviewsQuery = useQuery({
    queryKey: ['super-admin-reviews', debouncedSearch, status, storeId, productId],
    queryFn: () =>
      adminApi.reviews({
        limit: 100,
        search: debouncedSearch || undefined,
        status: status === 'all' ? undefined : status,
        storeId: storeId || undefined,
        productId: productId || undefined,
      }),
    placeholderData: (previousData) => previousData,
  });

  const approveMutation = useMutation({
    mutationFn: (id: string) => adminApi.approveReview(id),
    onSuccess: invalidateReviewQueries,
    onError: (error) => {
      window.alert(error instanceof Error ? error.message : 'Unable to approve review.');
    },
    onSettled: () => {
      setActioningReviewId(null);
    },
  });

  const rejectMutation = useMutation({
    mutationFn: (id: string) => adminApi.rejectReview(id),
    onSuccess: invalidateReviewQueries,
    onError: (error) => {
      window.alert(error instanceof Error ? error.message : 'Unable to reject review.');
    },
    onSettled: () => {
      setActioningReviewId(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => adminApi.deleteReview(id),
    onSuccess: invalidateReviewQueries,
    onError: (error) => {
      window.alert(error instanceof Error ? error.message : 'Unable to delete review.');
    },
    onSettled: () => {
      setActioningReviewId(null);
    },
  });

  const createReviewMutation = useMutation({
    mutationFn: async () => {
      const createdReview = await adminApi.createReview({
        productId: newReviewProductId,
        rating: newReviewRating,
        comment: newReviewComment.trim() || undefined,
      });

      if (approveImmediately) {
        await adminApi.approveReview(createdReview.id);
      }

      return createdReview;
    },
    onSuccess: () => {
      setIsAddModalOpen(false);
      setNewReviewProductId('');
      setNewReviewRating(5);
      setNewReviewComment('');
      setApproveImmediately(false);
      invalidateReviewQueries();
    },
    onError: (error) => {
      window.alert(error instanceof Error ? error.message : 'Unable to add review.');
    },
  });

  if (reviewsQuery.isLoading && !reviewsQuery.data) return <LoadingBlock label="Loading reviews..." />;

  const reviewSummary = reviewsQuery.data?.summary ?? EMPTY_SUMMARY;
  const reviews = reviewsQuery.data?.data ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reviews"
        subtitle="Track product reviews by status, store, and product with complete moderation controls."
        action={
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="inline-flex items-center gap-2 rounded-2xl bg-primary-500 px-5 py-3 text-sm font-black uppercase tracking-[0.16em] text-white"
          >
            <Plus size={16} />
            Add Review
          </button>
        }
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total Reviews" value={String(reviewSummary.total)} icon={<MessageSquare size={18} />} />
        <StatCard label="Pending" value={String(reviewSummary.pending)} icon={<Clock3 size={18} />} />
        <StatCard label="Approved" value={String(reviewSummary.approved)} icon={<CheckCircle2 size={18} />} />
        <StatCard label="Rejected" value={String(reviewSummary.rejected)} icon={<XCircle size={18} />} />
      </div>

      <div className="grid gap-3 rounded-[1.5rem] border border-primary-100 bg-white p-4 lg:grid-cols-4">
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search by product, customer, mobile, email, or comment"
          className="rounded-2xl border border-primary-100 bg-primary-50 px-4 py-3"
        />

        <select
          value={status}
          onChange={(event) => setStatus(event.target.value as 'all' | 'pending' | 'approved' | 'rejected')}
          className="rounded-2xl border border-primary-100 bg-primary-50 px-4 py-3"
        >
          <option value="all">All statuses</option>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
        </select>

        <select
          value={storeId}
          onChange={(event) => {
            setStoreId(event.target.value);
            setProductId('');
          }}
          className="rounded-2xl border border-primary-100 bg-primary-50 px-4 py-3"
        >
          <option value="">All stores</option>
          {storesQuery.data?.data.map((store) => (
            <option key={store.id} value={store.id}>
              {store.name}
            </option>
          ))}
        </select>

        <select
          value={productId}
          onChange={(event) => setProductId(event.target.value)}
          className="rounded-2xl border border-primary-100 bg-primary-50 px-4 py-3"
        >
          <option value="">All products</option>
          {productsQuery.data?.data.map((product) => (
            <option key={product.id} value={product.id}>
              {product.name}
            </option>
          ))}
        </select>
      </div>

      {reviewsQuery.isFetching ? (
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Refreshing reviews...</p>
      ) : null}

      <div className="hidden overflow-hidden rounded-[1.75rem] border border-primary-100 bg-white lg:block">
        <table className="min-w-full">
          <thead className="bg-primary-50/70 text-left text-xs font-black uppercase tracking-[0.16em] text-slate-500">
            <tr>
              <th className="px-4 py-3">Product</th>
              <th className="px-4 py-3">Store</th>
              <th className="px-4 py-3">Customer</th>
              <th className="px-4 py-3">Rating</th>
              <th className="px-4 py-3">Comment</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {reviews.map((review) => {
              const statusValue = getReviewStatus(review);
              const ratingStars = `${'★'.repeat(review.rating)}${'☆'.repeat(5 - review.rating)}`;
              const productImage = review.productId?.images?.[0]?.url;
              const isActioning = actioningReviewId === review.id;

              return (
                <tr key={review.id} className="border-t border-primary-100 align-top">
                  <td className="px-4 py-3">
                    <div className="flex min-w-0 items-start gap-3">
                      {productImage ? (
                        <img
                          src={productImage}
                          alt={review.productId?.name || 'Product'}
                          className="h-12 w-12 rounded-xl border border-primary-100 object-cover"
                        />
                      ) : (
                        <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-dashed border-primary-200 bg-primary-50 text-[10px] font-black uppercase tracking-[0.12em] text-slate-400">
                          N/A
                        </div>
                      )}

                      <div className="min-w-0">
                        <p className="truncate text-sm font-black text-slate-900">{review.productId?.name || 'Product review'}</p>
                        <p className="mt-1 text-xs text-slate-500">{review.productId?.slug || '-'}</p>
                      </div>
                    </div>
                  </td>

                  <td className="px-4 py-3 text-sm text-slate-600">{getStoreNames(review)}</td>
                  <td className="px-4 py-3 text-sm text-slate-600">
                    <p className="font-semibold text-slate-800">{review.userId?.name || 'Customer'}</p>
                    <p>{review.userId?.mobile || review.userId?.email || '-'}</p>
                  </td>
                  <td className="px-4 py-3 text-sm font-black text-slate-700">{ratingStars}</td>
                  <td className="px-4 py-3 text-sm text-slate-600">{review.comment || '-'}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-3 py-1 text-xs font-black uppercase tracking-[0.14em] ${getStatusPillClass(statusValue)}`}>
                      {statusValue}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-600">{formatDateTime(review.createdAt)}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        onClick={async () => {
                          setActioningReviewId(review.id);
                          try {
                            await approveMutation.mutateAsync(review.id);
                          } catch {
                            // Error is handled in mutation callbacks.
                          }
                        }}
                        disabled={isActioning || statusValue === 'approved'}
                        className="rounded-xl border border-emerald-100 px-3 py-2 text-xs font-black uppercase tracking-[0.14em] text-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Approve
                      </button>

                      <button
                        onClick={async () => {
                          setActioningReviewId(review.id);
                          try {
                            await rejectMutation.mutateAsync(review.id);
                          } catch {
                            // Error is handled in mutation callbacks.
                          }
                        }}
                        disabled={isActioning || statusValue === 'rejected'}
                        className="rounded-xl border border-amber-100 px-3 py-2 text-xs font-black uppercase tracking-[0.14em] text-amber-700 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Reject
                      </button>

                      <button
                        onClick={async () => {
                          if (!window.confirm('Delete this review permanently?')) return;
                          setActioningReviewId(review.id);
                          try {
                            await deleteMutation.mutateAsync(review.id);
                          } catch {
                            // Error is handled in mutation callbacks.
                          }
                        }}
                        disabled={isActioning}
                        className="inline-flex items-center gap-1 rounded-xl border border-rose-100 px-3 py-2 text-xs font-black uppercase tracking-[0.14em] text-rose-600 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <Trash2 size={14} />
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="grid gap-4 lg:hidden">
        {reviews.map((review) => {
          const statusValue = getReviewStatus(review);
          const isActioning = actioningReviewId === review.id;

          return (
            <div key={review.id} className="rounded-[1.5rem] border border-primary-100 bg-white p-4">
              <p className="text-lg font-black text-slate-900">{review.productId?.name || 'Product review'}</p>
              <p className="mt-1 text-sm text-slate-500">Store: {getStoreNames(review)}</p>
              <p className="mt-1 text-sm text-slate-500">
                {review.userId?.name || 'Customer'} · {review.userId?.mobile || review.userId?.email || '-'}
              </p>
              <p className="mt-3 text-sm leading-7 text-slate-600">{review.comment || 'No comment'}</p>
              <p className="mt-2 text-xs font-semibold uppercase tracking-[0.16em] text-primary-500">
                {review.rating}/5 · {formatDateTime(review.createdAt)}
              </p>

              <div className="mt-4 flex flex-wrap items-center gap-2">
                <span className={`rounded-full px-3 py-1 text-xs font-black uppercase tracking-[0.14em] ${getStatusPillClass(statusValue)}`}>
                  {statusValue}
                </span>

                <button
                  onClick={async () => {
                    setActioningReviewId(review.id);
                    try {
                      await approveMutation.mutateAsync(review.id);
                    } catch {
                      // Error is handled in mutation callbacks.
                    }
                  }}
                  disabled={isActioning || statusValue === 'approved'}
                  className="rounded-xl border border-emerald-100 px-3 py-2 text-xs font-black uppercase tracking-[0.14em] text-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Approve
                </button>

                <button
                  onClick={async () => {
                    setActioningReviewId(review.id);
                    try {
                      await rejectMutation.mutateAsync(review.id);
                    } catch {
                      // Error is handled in mutation callbacks.
                    }
                  }}
                  disabled={isActioning || statusValue === 'rejected'}
                  className="rounded-xl border border-amber-100 px-3 py-2 text-xs font-black uppercase tracking-[0.14em] text-amber-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Reject
                </button>

                <button
                  onClick={async () => {
                    if (!window.confirm('Delete this review permanently?')) return;
                    setActioningReviewId(review.id);
                    try {
                      await deleteMutation.mutateAsync(review.id);
                    } catch {
                      // Error is handled in mutation callbacks.
                    }
                  }}
                  disabled={isActioning}
                  className="rounded-xl border border-rose-100 px-3 py-2 text-xs font-black uppercase tracking-[0.14em] text-rose-600 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Delete
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {!reviews.length ? (
        <div className="rounded-[1.5rem] border border-dashed border-primary-200 bg-white p-8 text-center text-sm text-slate-500">
          No reviews found for the selected filters.
        </div>
      ) : null}

      {isAddModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 px-4 py-6">
          <form
            onSubmit={(event) => {
              event.preventDefault();
              if (!newReviewProductId) {
                window.alert('Please select a product.');
                return;
              }
              createReviewMutation.mutate();
            }}
            className="w-full max-w-2xl rounded-[2rem] border border-primary-100 bg-white p-6"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-primary-500">Create Review</p>
                <h2 className="mt-2 text-2xl font-black text-slate-900">Add Product Review</h2>
              </div>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="rounded-2xl border border-primary-100 px-4 py-2 text-sm font-semibold text-slate-600"
              >
                Close
              </button>
            </div>

            <div className="mt-6 grid gap-4">
              <select
                value={newReviewProductId}
                onChange={(event) => setNewReviewProductId(event.target.value)}
                className="w-full rounded-2xl border border-primary-100 bg-primary-50 px-4 py-3"
              >
                <option value="">Select product</option>
                {productsQuery.data?.data.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.name}
                  </option>
                ))}
              </select>

              <select
                value={newReviewRating}
                onChange={(event) => setNewReviewRating(Number(event.target.value))}
                className="w-full rounded-2xl border border-primary-100 bg-primary-50 px-4 py-3"
              >
                {[5, 4, 3, 2, 1].map((value) => (
                  <option key={value} value={value}>
                    {value} Star{value > 1 ? 's' : ''}
                  </option>
                ))}
              </select>

              <textarea
                value={newReviewComment}
                onChange={(event) => setNewReviewComment(event.target.value)}
                placeholder="Review comment (optional)"
                className="min-h-[120px] w-full rounded-2xl border border-primary-100 bg-primary-50 px-4 py-3"
              />

              <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={approveImmediately}
                  onChange={(event) => setApproveImmediately(event.target.checked)}
                  className="h-4 w-4 rounded border-primary-200"
                />
                Approve immediately after adding
              </label>
            </div>

            <button
              type="submit"
              disabled={createReviewMutation.isPending}
              className="mt-6 w-full rounded-2xl bg-primary-500 px-5 py-3 text-sm font-black uppercase tracking-[0.18em] text-white disabled:cursor-not-allowed disabled:bg-primary-200"
            >
              {createReviewMutation.isPending ? 'Saving...' : 'Save Review'}
            </button>
          </form>
        </div>
      ) : null}
    </div>
  );
}
