import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  AlertCircle,
  ArrowRight,
  ArrowUpDown,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Eye,
  Filter,
  RefreshCw,
  RotateCcw,
  Search,
} from 'lucide-react';
import { adminApi, grievancesApi } from '../../services/api';
import { StatusBadge } from '../../components/StatusBadge';
import { AdminPageHeader } from '../../components/admin/AdminPageHeader';
import { useToast } from '../../context/ToastContext';
import type { AdminSortOption, Grievance } from '../../types';

const ALL_STATUSES = ['Submitted', 'Under Review', 'In Progress', 'Resolved', 'Rejected'];

interface AdminGrievancesProps {
  title?: string;
  description?: string;
  section?: string;
  /** Comma-separated group applied when the administrator has not picked one status. */
  statusGroup?: string;
  statusOptions?: string[];
  emptyTitle?: string;
  emptyMessage?: string;
}

function formatDate(value?: string): string {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString();
}

const TableSkeleton: React.FC = () => (
  <div className="divide-y divide-slate-100" aria-busy="true" aria-label="Loading grievances">
    {Array.from({ length: 7 }).map((_, index) => (
      <div key={index} className="flex items-center gap-4 px-6 py-4">
        <div className="h-4 w-28 animate-pulse rounded bg-slate-200" />
        <div className="h-4 w-36 animate-pulse rounded bg-slate-200" />
        <div className="h-4 flex-1 animate-pulse rounded bg-slate-200" />
        <div className="h-4 w-24 animate-pulse rounded bg-slate-200" />
        <div className="h-6 w-20 animate-pulse rounded-full bg-slate-200" />
      </div>
    ))}
  </div>
);

export const AdminGrievances: React.FC<AdminGrievancesProps> = ({
  title = 'All Grievances',
  description = 'Search, filter and inspect every grievance lodged across all departments.',
  section = 'All Grievances',
  statusGroup,
  statusOptions = ALL_STATUSES,
  emptyTitle = 'No grievances found',
  emptyMessage = 'No complaint matches the current search or filters.',
}) => {
  const [searchParams] = useSearchParams();
  const toast = useToast();

  const initialStatus = statusGroup ? '' : searchParams.get('status') || '';
  const [grievances, setGrievances] = useState<Grievance[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [statusFilter, setStatusFilter] = useState(initialStatus);
  const [categoryFilter, setCategoryFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [sort, setSort] = useState<AdminSortOption>('newest');
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [totalPages, setTotalPages] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  // Keep the status filter in sync when the dashboard links to ?status=...
  useEffect(() => {
    if (statusGroup) return;
    setStatusFilter(searchParams.get('status') || '');
    setPage(1);
  }, [searchParams, statusGroup]);

  useEffect(() => {
    let active = true;
    grievancesApi
      .getCategories()
      .then((list) => {
        if (active) setCategories(list);
      })
      .catch(() => {
        // Category filter stays empty; the register itself can still load.
        if (active) setCategories([]);
      });
    return () => {
      active = false;
    };
  }, []);

  const effectiveStatus = statusFilter || statusGroup || undefined;

  const fetchGrievances = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await adminApi.getGrievances({
        page,
        page_size: pageSize,
        status: effectiveStatus,
        category: categoryFilter || undefined,
        search: searchQuery.trim() || undefined,
        date_from: dateFrom || undefined,
        date_to: dateTo || undefined,
        sort,
      });
      setGrievances(response.items);
      setTotalPages(response.total_pages);
      setTotalCount(response.total);
    } catch {
      setError('Unable to load grievances from the server. Please try again.');
      toast.error('Grievance register unavailable', 'The backend API could not be reached.');
    } finally {
      setIsLoading(false);
    }
  }, [page, pageSize, effectiveStatus, categoryFilter, searchQuery, dateFrom, dateTo, sort, toast]);

  useEffect(() => {
    const timer = window.setTimeout(fetchGrievances, 250);
    return () => window.clearTimeout(timer);
  }, [fetchGrievances, reloadKey]);

  const hasActiveFilters = useMemo(
    () =>
      Boolean(
        searchQuery.trim() ||
          categoryFilter ||
          dateFrom ||
          dateTo ||
          sort !== 'newest' ||
          statusFilter
      ),
    [searchQuery, categoryFilter, dateFrom, dateTo, sort, statusFilter]
  );

  const resetFilters = () => {
    setSearchQuery('');
    setCategoryFilter('');
    setStatusFilter('');
    setDateFrom('');
    setDateTo('');
    setSort('newest');
    setPage(1);
  };

  const fromRecord = totalCount === 0 ? 0 : (page - 1) * pageSize + 1;
  const toRecord = Math.min(page * pageSize, totalCount);

  return (
    <div className="space-y-5">
      <AdminPageHeader
        section={section}
        title={title}
        description={description}
        actions={
          <button
            type="button"
            onClick={() => setReloadKey((key) => key + 1)}
            disabled={isLoading}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
          >
            <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
            Refresh
          </button>
        }
      />

      {/* Filters */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 xl:flex-row">
          <div className="relative flex-1">
            <Search size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              value={searchQuery}
              onChange={(event) => {
                setSearchQuery(event.target.value);
                setPage(1);
              }}
              placeholder="Search reference, citizen name, subject, category or location..."
              aria-label="Search grievances"
              className="w-full rounded-lg border border-slate-300 py-2.5 pl-10 pr-4 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-transparent focus:ring-2 focus:ring-blue-600"
            />
          </div>

          {statusOptions.length > 1 && (
            <div className="flex items-center gap-2 xl:w-52">
              <Filter size={16} className="hidden shrink-0 text-slate-400 sm:block" />
              <select
                value={statusFilter}
                onChange={(event) => {
                  setStatusFilter(event.target.value);
                  setPage(1);
                }}
                aria-label="Filter by status"
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm font-medium text-slate-700 outline-none transition focus:border-transparent focus:ring-2 focus:ring-blue-600"
              >
                <option value="">{statusGroup ? 'All in this queue' : 'All statuses'}</option>
                {statusOptions.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="xl:w-60">
            <select
              value={categoryFilter}
              onChange={(event) => {
                setCategoryFilter(event.target.value);
                setPage(1);
              }}
              aria-label="Filter by category"
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm font-medium text-slate-700 outline-none transition focus:border-transparent focus:ring-2 focus:ring-blue-600"
            >
              <option value="">All categories</option>
              {categories.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-3 flex flex-col gap-3 border-t border-slate-100 pt-3 lg:flex-row lg:items-center">
          <div className="flex items-center gap-2">
            <CalendarDays size={16} className="shrink-0 text-slate-400" />
            <label className="sr-only" htmlFor="admin-date-from">
              Submitted from
            </label>
            <input
              id="admin-date-from"
              type="date"
              value={dateFrom}
              onChange={(event) => {
                setDateFrom(event.target.value);
                setPage(1);
              }}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700 outline-none transition focus:border-transparent focus:ring-2 focus:ring-blue-600 sm:w-auto"
            />
            <span className="text-xs text-slate-400">to</span>
            <label className="sr-only" htmlFor="admin-date-to">
              Submitted to
            </label>
            <input
              id="admin-date-to"
              type="date"
              value={dateTo}
              min={dateFrom || undefined}
              onChange={(event) => {
                setDateTo(event.target.value);
                setPage(1);
              }}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700 outline-none transition focus:border-transparent focus:ring-2 focus:ring-blue-600 sm:w-auto"
            />
          </div>

          <div className="flex items-center gap-2 lg:ml-auto">
            <ArrowUpDown size={16} className="shrink-0 text-slate-400" />
            <label className="sr-only" htmlFor="admin-sort">
              Sort grievances
            </label>
            <select
              id="admin-sort"
              value={sort}
              onChange={(event) => {
                setSort(event.target.value as AdminSortOption);
                setPage(1);
              }}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 outline-none transition focus:border-transparent focus:ring-2 focus:ring-blue-600"
            >
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
              <option value="status">Status order</option>
            </select>

            <button
              type="button"
              onClick={resetFilters}
              disabled={!hasActiveFilters}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-40"
            >
              <RotateCcw size={14} />
              Reset
            </button>
          </div>
        </div>
      </div>

      {/* Register */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3.5 sm:px-6">
          <div className="flex items-center gap-2">
            <ClipboardList size={17} className="text-blue-600" />
            <h2 className="text-sm font-bold text-slate-900">Grievance Register</h2>
          </div>
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600">
            {totalCount} record{totalCount === 1 ? '' : 's'}
          </span>
        </div>

        {isLoading ? (
          <TableSkeleton />
        ) : error ? (
          <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
            <AlertCircle size={34} className="mb-3 text-rose-500" />
            <p className="text-sm font-semibold text-slate-900">Could not load the register</p>
            <p className="mt-1 max-w-sm text-xs text-slate-500">{error}</p>
            <button
              type="button"
              onClick={() => setReloadKey((key) => key + 1)}
              className="mt-4 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-blue-700"
            >
              <RefreshCw size={14} />
              Try again
            </button>
          </div>
        ) : grievances.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
              <ClipboardList size={23} />
            </div>
            <p className="text-sm font-semibold text-slate-900">{emptyTitle}</p>
            <p className="mt-1 max-w-sm text-xs text-slate-500">{emptyMessage}</p>
            {hasActiveFilters && (
              <button
                type="button"
                onClick={resetFilters}
                className="mt-4 inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3.5 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                <RotateCcw size={14} />
                Clear filters
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-100 text-left text-sm">
              <thead className="bg-slate-50 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                <tr>
                  <th scope="col" className="px-5 py-3.5 sm:px-6">Reference</th>
                  <th scope="col" className="px-5 py-3.5 sm:px-6">Citizen</th>
                  <th scope="col" className="px-5 py-3.5 sm:px-6">Subject</th>
                  <th scope="col" className="hidden px-5 py-3.5 lg:table-cell">Category</th>
                  <th scope="col" className="hidden px-5 py-3.5 xl:table-cell">Location</th>
                  <th scope="col" className="px-5 py-3.5 sm:px-6">Status</th>
                  <th scope="col" className="hidden px-5 py-3.5 md:table-cell">Submitted</th>
                  <th scope="col" className="px-5 py-3.5 text-right sm:px-6">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {grievances.map((grievance) => (
                  <tr key={grievance.id} className="transition hover:bg-slate-50/80">
                    <td className="whitespace-nowrap px-5 py-3.5 sm:px-6">
                      <span className="rounded border border-blue-200 bg-blue-50 px-1.5 py-0.5 font-mono text-[11px] font-bold text-blue-700">
                        {grievance.reference_number}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 sm:px-6">
                      <p className="max-w-[160px] truncate text-xs font-semibold text-slate-900">
                        {grievance.citizen_name || 'Citizen'}
                      </p>
                      <p className="max-w-[160px] truncate text-[11px] text-slate-400">
                        {grievance.citizen_email || '—'}
                      </p>
                    </td>
                    <td className="px-5 py-3.5 sm:px-6">
                      <p className="max-w-[260px] truncate text-xs font-semibold text-slate-900">
                        {grievance.subject}
                      </p>
                      <p className="mt-0.5 max-w-[260px] truncate text-[11px] text-slate-400 lg:hidden">
                        {grievance.category}
                      </p>
                    </td>
                    <td className="hidden whitespace-nowrap px-5 py-3.5 text-xs text-slate-600 lg:table-cell">
                      {grievance.category}
                    </td>
                    <td className="hidden px-5 py-3.5 text-xs text-slate-600 xl:table-cell">
                      <span className="block max-w-[180px] truncate">{grievance.location}</span>
                    </td>
                    <td className="whitespace-nowrap px-5 py-3.5 sm:px-6">
                      <StatusBadge status={grievance.current_status} size="sm" />
                    </td>
                    <td className="hidden whitespace-nowrap px-5 py-3.5 text-xs text-slate-500 md:table-cell">
                      {formatDate(grievance.created_at)}
                    </td>
                    <td className="whitespace-nowrap px-5 py-3.5 text-right sm:px-6">
                      <Link
                        to={`/admin/grievances/${grievance.id}`}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-[11px] font-semibold text-blue-700 transition hover:border-blue-300 hover:bg-blue-50"
                      >
                        <Eye size={14} />
                        View
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!isLoading && !error && totalCount > 0 && (
          <div className="flex flex-col gap-3 border-t border-slate-100 bg-white px-5 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <p className="text-xs text-slate-500">
              Showing <span className="font-semibold text-slate-800">{fromRecord}</span>–
              <span className="font-semibold text-slate-800">{toRecord}</span> of{' '}
              <span className="font-semibold text-slate-800">{totalCount}</span>
            </p>
            <div className="flex items-center gap-2">
              <span className="mr-1 text-xs text-slate-500">
                Page {page} of {Math.max(totalPages, 1)}
              </span>
              <button
                type="button"
                onClick={() => setPage((current) => Math.max(current - 1, 1))}
                disabled={page <= 1}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-300 text-slate-600 transition hover:bg-slate-50 disabled:opacity-40"
                aria-label="Previous page"
              >
                <ChevronLeft size={16} />
              </button>
              <button
                type="button"
                onClick={() => setPage((current) => Math.min(current + 1, totalPages))}
                disabled={page >= totalPages}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-300 text-slate-600 transition hover:bg-slate-50 disabled:opacity-40"
                aria-label="Next page"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>

      {!isLoading && !error && grievances.length > 0 && (
        <p className="flex items-center justify-end gap-1 text-[11px] text-slate-400">
          Open a record to review the full complaint and update its status
          <ArrowRight size={12} />
        </p>
      )}
    </div>
  );
};
