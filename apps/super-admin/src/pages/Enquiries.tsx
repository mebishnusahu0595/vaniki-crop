import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, ClipboardList, Search, Calendar, Eye, EyeOff } from 'lucide-react';
import { PageHeader } from '../components/PageHeader';
import { LoadingBlock } from '../components/LoadingBlock';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { adminApi } from '../utils/api';
import { formatDateTime } from '../utils/format';

function exportEnquiriesCsv(rows: any[]) {
  if (!rows || !rows.length) return;

  const headers = [
    'Enquiry ID',
    'Name',
    'Mobile Number',
    'Dynamic Category Interested',
    'Client IP Address',
    'Submitted Date & Time',
  ];

  const csvRows = rows.map((row) => [
    row.id || row._id || '',
    row.name || '',
    row.mobile || '',
    row.category || '',
    row.ipAddress || 'Unknown',
    row.createdAt ? formatDateTime(row.createdAt) : '',
  ]);

  const csv = [headers, ...csvRows]
    .map((line) =>
      line
        .map((value) => `"${String(value ?? '').replaceAll('"', '""')}"`)
        .join(','),
    )
    .join('\n');

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `enquiry-responses-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export default function EnquiriesPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, 350);
  const queryClient = useQueryClient();

  const enquiriesQuery = useQuery({
    queryKey: ['super-admin-enquiries', page, debouncedSearch],
    queryFn: () => adminApi.enquiries({ page, search: debouncedSearch, limit: 15 }),
    placeholderData: (previousData) => previousData,
  });

  const toggleStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'seen' | 'unseen' }) =>
      adminApi.updateEnquiryStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['super-admin-enquiries'] });
    },
  });

  const handleToggleStatus = (id: string, currentStatus: string) => {
    const nextStatus = currentStatus === 'seen' ? 'unseen' : 'seen';
    toggleStatusMutation.mutate({ id, status: nextStatus });
  };

  if (enquiriesQuery.isLoading && !enquiriesQuery.data) {
    return <LoadingBlock label="Loading enquiry responses..." />;
  }

  const enquiries = enquiriesQuery.data?.data || [];
  const pagination = enquiriesQuery.data?.pagination;
  const totalPages = pagination?.totalPages || 1;

  const handlePrevPage = () => {
    setPage((prev) => Math.max(prev - 1, 1));
  };

  const handleNextPage = () => {
    setPage((prev) => Math.min(prev + 1, totalPages));
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Enquiry Responses"
        subtitle="Manage dynamic website popup submissions, customer categories interest, and geolocation logging."
        action={
          <button
            onClick={() => exportEnquiriesCsv(enquiries)}
            disabled={!enquiries.length}
            className="rounded-2xl border border-primary-100 bg-white px-4 py-2 text-xs font-black uppercase tracking-[0.16em] text-primary-700 hover:bg-primary-50 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Export CSV
          </button>
        }
      />

      {/* Filter and Search Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-[1.5rem] border border-primary-100 bg-white p-4 shadow-[0_12px_40px_rgba(15,23,42,0.03)]">
        <div className="relative flex-grow max-w-md">
          <input
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1); // Reset to page 1 on new search
            }}
            placeholder="Search by name, mobile, or category..."
            className="w-full rounded-2xl border border-primary-100 bg-primary-50 pl-11 pr-4 py-3 text-sm focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition"
          />
          <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
        </div>

        <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.16em] text-primary-700">
          <ClipboardList size={16} />
          <span>Total Responses: {pagination?.total || enquiries.length}</span>
        </div>
      </div>

      {enquiriesQuery.isFetching ? (
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500 animate-pulse">Refreshing list...</p>
      ) : null}

      {/* Data Table */}
      <div className="hidden overflow-hidden rounded-[1.75rem] border border-primary-100 bg-white lg:block shadow-sm">
        <table className="min-w-full">
          <thead className="bg-primary-50/70 text-left text-xs font-black uppercase tracking-[0.16em] text-slate-500">
            <tr>
              <th className="px-6 py-4">Name</th>
              <th className="px-6 py-4">Mobile Number</th>
              <th className="px-6 py-4">Dynamic Category</th>
              <th className="px-6 py-4">Client IP Address</th>
              <th className="px-6 py-4">Date & Time</th>
              <th className="px-6 py-4">Status</th>
              <th className="px-6 py-4">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-primary-100">
            {enquiries.map((enquiry: any) => (
              <tr key={enquiry.id} className="hover:bg-primary-50/30 transition">
                <td className="px-6 py-4 text-sm font-black text-slate-900">{enquiry.name}</td>
                <td className="px-6 py-4 text-sm font-semibold text-slate-600">
                  <a href={`tel:${enquiry.mobile}`} className="hover:text-primary transition">
                    {enquiry.mobile}
                  </a>
                </td>
                <td className="px-6 py-4 text-sm">
                  <span className="rounded-full bg-primary-100 px-3 py-1 text-xs font-black uppercase tracking-[0.14em] text-primary-700">
                    {enquiry.category}
                  </span>
                </td>
                <td className="px-6 py-4 text-sm font-mono text-slate-500">{enquiry.ipAddress || '127.0.0.1'}</td>
                <td className="px-6 py-4 text-sm text-slate-500">{formatDateTime(enquiry.createdAt)}</td>
                <td className="px-6 py-4 text-sm">
                  {enquiry.status === 'seen' ? (
                    <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-black uppercase tracking-[0.14em] text-emerald-700">
                      Seen
                    </span>
                  ) : (
                    <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-black uppercase tracking-[0.14em] text-amber-700 animate-pulse">
                      Unseen
                    </span>
                  )}
                </td>
                <td className="px-6 py-4 text-sm">
                  <button
                    onClick={() => handleToggleStatus(enquiry.id, enquiry.status)}
                    disabled={toggleStatusMutation.isPending}
                    className="flex items-center gap-1.5 rounded-xl border border-primary-100 bg-white px-3 py-1.5 text-xs font-black uppercase tracking-[0.12em] text-primary-700 hover:bg-primary-50 transition disabled:opacity-50"
                  >
                    {enquiry.status === 'seen' ? (
                      <>
                        <EyeOff size={13} />
                        <span>Unread</span>
                      </>
                    ) : (
                      <>
                        <Eye size={13} />
                        <span>Read</span>
                      </>
                    )}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        
        {enquiries.length === 0 && (
          <div className="py-12 text-center">
            <ClipboardList size={40} className="mx-auto text-slate-300 mb-2" />
            <p className="text-lg font-black text-slate-400">No enquiry responses found</p>
          </div>
        )}
      </div>

      {/* Mobile Card Layout */}
      <div className="grid gap-4 lg:hidden">
        {enquiries.map((enquiry: any) => (
          <div key={enquiry.id} className="rounded-3xl border border-primary-100 bg-white p-5 space-y-3 shadow-sm">
            <div className="flex items-center justify-between border-b border-primary-50 pb-2.5">
              <div className="flex flex-col gap-1">
                <span className="text-sm font-black text-slate-900">{enquiry.name}</span>
                <div>
                  {enquiry.status === 'seen' ? (
                    <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-[9px] font-black uppercase tracking-[0.14em] text-emerald-700 border border-emerald-100">
                      Seen
                    </span>
                  ) : (
                    <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-[9px] font-black uppercase tracking-[0.14em] text-amber-700 animate-pulse border border-amber-100">
                      Unseen
                    </span>
                  )}
                </div>
              </div>
              <span className="rounded-full bg-primary-100 px-3 py-0.5 text-[10px] font-black uppercase tracking-[0.14em] text-primary-700">
                {enquiry.category}
              </span>
            </div>
            
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <span className="block font-semibold text-slate-400 uppercase tracking-wider text-[10px]">Mobile</span>
                <a href={`tel:${enquiry.mobile}`} className="font-bold text-slate-700 hover:text-primary transition">
                  {enquiry.mobile}
                </a>
              </div>
              <div>
                <span className="block font-semibold text-slate-400 uppercase tracking-wider text-[10px]">IP Address</span>
                <span className="font-mono text-slate-600">{enquiry.ipAddress || '127.0.0.1'}</span>
              </div>
              <div className="col-span-2 pt-1 flex items-center justify-between gap-1.5 text-[10px] text-slate-400">
                <div className="flex items-center gap-1">
                  <Calendar size={12} />
                  <span>{formatDateTime(enquiry.createdAt)}</span>
                </div>
                <button
                  onClick={() => handleToggleStatus(enquiry.id, enquiry.status)}
                  disabled={toggleStatusMutation.isPending}
                  className="flex items-center gap-1 rounded-xl border border-primary-100 bg-white px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-primary-700 hover:bg-primary-50 transition"
                >
                  {enquiry.status === 'seen' ? (
                    <>
                      <EyeOff size={11} />
                      <span>Unread</span>
                    </>
                  ) : (
                    <>
                      <Eye size={11} />
                      <span>Read</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        ))}

        {enquiries.length === 0 && (
          <div className="py-12 text-center rounded-3xl border border-dashed border-slate-200 bg-white">
            <ClipboardList size={32} className="mx-auto text-slate-300 mb-2" />
            <p className="text-sm font-bold text-slate-400">No enquiry responses found</p>
          </div>
        )}
      </div>

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between rounded-[1.5rem] border border-primary-100 bg-white p-4 shadow-sm">
          <button
            onClick={handlePrevPage}
            disabled={page === 1}
            className="flex items-center gap-2 rounded-xl border border-primary-100 bg-white px-4 py-2.5 text-xs font-black uppercase tracking-[0.16em] text-slate-600 hover:bg-primary-50 transition disabled:opacity-45 disabled:cursor-not-allowed"
          >
            <ChevronLeft size={16} />
            <span>Prev</span>
          </button>

          <span className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">
            Page {page} of {totalPages}
          </span>

          <button
            onClick={handleNextPage}
            disabled={page === totalPages}
            className="flex items-center gap-2 rounded-xl border border-primary-100 bg-white px-4 py-2.5 text-xs font-black uppercase tracking-[0.16em] text-slate-600 hover:bg-primary-50 transition disabled:opacity-45 disabled:cursor-not-allowed"
          >
            <span>Next</span>
            <ChevronRight size={16} />
          </button>
        </div>
      )}
    </div>
  );
}
