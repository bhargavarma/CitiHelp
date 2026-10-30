import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Activity,
  AlertCircle,
  ArrowRight,
  BarChart3,
  CheckCircle2,
  Clock3,
  FileText,
  Inbox,
  Layers,
  RefreshCw,
  SearchCheck,
  Timer,
  XCircle,
} from 'lucide-react';
import { adminApi } from '../../services/api';
import type { AdminStats } from '../../types';
import { StatusBadge } from '../../components/StatusBadge';
import { AdminPageHeader } from '../../components/admin/AdminPageHeader';

const STATUS_META = [
  { key: 'submitted', label: 'Submitted', color: 'bg-blue-500', text: 'text-blue-700', soft: 'bg-blue-50' },
  { key: 'under_review', label: 'Under Review', color: 'bg-amber-500', text: 'text-amber-700', soft: 'bg-amber-50' },
  { key: 'in_progress', label: 'In Progress', color: 'bg-violet-500', text: 'text-violet-700', soft: 'bg-violet-50' },
  { key: 'resolved', label: 'Resolved', color: 'bg-emerald-500', text: 'text-emerald-700', soft: 'bg-emerald-50' },
  { key: 'rejected', label: 'Rejected', color: 'bg-rose-500', text: 'text-rose-700', soft: 'bg-rose-50' },
] as const;

function formatDate(value?: string): string {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString();
}

const DashboardSkeleton: React.FC = () => (
  <div className="space-y-6" aria-busy="true" aria-label="Loading dashboard">
    <div className="h-9 w-64 animate-pulse rounded-lg bg-slate-200" />
    <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
      {Array.from({ length: 6 }).map((_, index) => (
        <div key={index} className="h-28 animate-pulse rounded-xl border border-slate-200 bg-white" />
      ))}
    </div>
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <div className="h-72 animate-pulse rounded-xl border border-slate-200 bg-white" />
      <div className="h-72 animate-pulse rounded-xl border border-slate-200 bg-white" />
    </div>
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <div className="h-80 animate-pulse rounded-xl border border-slate-200 bg-white" />
      <div className="h-80 animate-pulse rounded-xl border border-slate-200 bg-white" />
    </div>
  </div>
);

export const AdminDashboard: React.FC = () => {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadStats = useCallback(async (refresh = false) => {
    if (refresh) setIsRefreshing(true);
    else setIsLoading(true);
    setError(null);
    try {
      const data = await adminApi.getStats();
      setStats(data);
    } catch {
      setError('Unable to load dashboard statistics. Check that the backend API is running.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  if (isLoading) return <DashboardSkeleton />;

  if (error || !stats) {
    return (
      <div className="rounded-2xl border border-rose-200 bg-white p-8 text-center shadow-sm">
        <AlertCircle size={34} className="mx-auto mb-3 text-rose-500" />
        <h2 className="text-base font-bold text-slate-900">Dashboard unavailable</h2>
        <p className="mx-auto mt-1 max-w-md text-sm text-slate-600">{error}</p>
        <button
          type="button"
          onClick={() => loadStats()}
          className="mt-4 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700"
        >
          <RefreshCw size={16} />
          Retry
        </button>
      </div>
    );
  }

  const statusCounts = STATUS_META.map((meta) => ({
    ...meta,
    count: stats[meta.key],
  }));
  const maxCategory = Math.max(...stats.category_distribution.map((item) => item.count), 1);
  const resolutionRate =
    stats.total_grievances > 0 ? Math.round((stats.resolved / stats.total_grievances) * 100) : 0;

  const statCards = [
    {
      label: 'Total Grievances',
      value: stats.total_grievances,
      icon: Layers,
      tone: 'border-slate-200 bg-white',
      iconTone: 'bg-slate-100 text-slate-700',
      valueTone: 'text-slate-900',
      to: '/admin/grievances',
    },
    {
      label: 'Submitted',
      value: stats.submitted,
      icon: Inbox,
      tone: 'border-blue-200 bg-white',
      iconTone: 'bg-blue-50 text-blue-600',
      valueTone: 'text-blue-700',
      to: '/admin/grievances?status=Submitted',
    },
    {
      label: 'Under Review',
      value: stats.under_review,
      icon: SearchCheck,
      tone: 'border-amber-200 bg-white',
      iconTone: 'bg-amber-50 text-amber-600',
      valueTone: 'text-amber-700',
      to: '/admin/grievances?status=Under%20Review',
    },
    {
      label: 'In Progress',
      value: stats.in_progress,
      icon: Timer,
      tone: 'border-violet-200 bg-white',
      iconTone: 'bg-violet-50 text-violet-600',
      valueTone: 'text-violet-700',
      to: '/admin/grievances?status=In%20Progress',
    },
    {
      label: 'Resolved',
      value: stats.resolved,
      icon: CheckCircle2,
      tone: 'border-emerald-200 bg-white',
      iconTone: 'bg-emerald-50 text-emerald-600',
      valueTone: 'text-emerald-700',
      to: '/admin/grievances/resolved',
    },
    {
      label: 'Rejected',
      value: stats.rejected,
      icon: XCircle,
      tone: 'border-rose-200 bg-white',
      iconTone: 'bg-rose-50 text-rose-600',
      valueTone: 'text-rose-700',
      to: '/admin/grievances/rejected',
    },
  ];

  return (
    <div className="space-y-6">
      <AdminPageHeader
        section="Dashboard"
        title="Grievance Dashboard"
        description="Live operational overview of citizen grievances, departmental queues and administrative action."
        actions={
          <>
            <button
              type="button"
              onClick={() => loadStats(true)}
              disabled={isRefreshing}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
            >
              <RefreshCw size={16} className={isRefreshing ? 'animate-spin' : ''} />
              {isRefreshing ? 'Refreshing' : 'Refresh'}
            </button>
            <Link
              to="/admin/grievances"
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
            >
              <FileText size={16} />
              Manage Grievances
            </Link>
          </>
        }
      />

      {stats.pending > 0 && (
        <div className="flex flex-col gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <Clock3 size={19} className="mt-0.5 shrink-0 text-amber-600" />
            <div>
              <p className="text-sm font-semibold text-amber-900">
                {stats.pending} grievance{stats.pending === 1 ? '' : 's'} awaiting administrative action
              </p>
              <p className="text-xs text-amber-800/80">
                Submitted, under review and in-progress complaints require follow-up.
              </p>
            </div>
          </div>
          <Link
            to="/admin/grievances/pending"
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-amber-600 px-3.5 py-2 text-xs font-semibold text-white transition hover:bg-amber-700"
          >
            Open pending queue
            <ArrowRight size={14} />
          </Link>
        </div>
      )}

      {/* Metric cards */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
        {statCards.map((card) => {
          const Icon = card.icon;
          return (
            <Link
              key={card.label}
              to={card.to}
              className={`group rounded-xl border p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${card.tone}`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${card.iconTone}`}>
                  <Icon size={18} />
                </div>
                <ArrowRight
                  size={14}
                  className="mt-1 text-slate-300 transition group-hover:text-blue-500"
                />
              </div>
              <p className={`mt-3 text-2xl font-bold tracking-tight ${card.valueTone}`}>{card.value}</p>
              <p className="mt-0.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                {card.label}
              </p>
            </Link>
          );
        })}
      </div>

      {/* Distribution panels */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="mb-5 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <BarChart3 size={18} className="text-blue-600" />
              <h2 className="text-base font-bold text-slate-900">Distribution by Status</h2>
            </div>
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600">
              {stats.total_grievances} total
            </span>
          </div>

          {stats.total_grievances === 0 ? (
            <EmptyState
              icon={<BarChart3 size={22} />}
              title="No grievances recorded"
              message="Status distribution will appear once citizens submit grievances."
            />
          ) : (
            <>
              <div className="flex h-3 w-full overflow-hidden rounded-full bg-slate-100">
                {statusCounts.map((item) =>
                  item.count > 0 ? (
                    <div
                      key={item.key}
                      className={item.color}
                      style={{ width: `${(item.count / stats.total_grievances) * 100}%` }}
                      title={`${item.label}: ${item.count}`}
                    />
                  ) : null
                )}
              </div>
              <div className="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-2">
                {statusCounts.map((item) => (
                  <div
                    key={item.key}
                    className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2"
                  >
                    <div className="flex items-center gap-2">
                      <span className={`h-2.5 w-2.5 rounded-full ${item.color}`} />
                      <span className="text-xs font-medium text-slate-600">{item.label}</span>
                    </div>
                    <span className={`text-xs font-bold ${item.text}`}>{item.count}</span>
                  </div>
                ))}
              </div>
              <div className="mt-5 flex items-center justify-between rounded-lg bg-emerald-50 px-3.5 py-2.5">
                <span className="text-xs font-semibold text-emerald-800">Resolution rate</span>
                <span className="text-sm font-bold text-emerald-800">{resolutionRate}%</span>
              </div>
            </>
          )}
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="mb-5 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Layers size={18} className="text-blue-600" />
              <h2 className="text-base font-bold text-slate-900">Distribution by Category</h2>
            </div>
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600">
              {stats.category_distribution.length} categories
            </span>
          </div>

          {stats.category_distribution.length === 0 ? (
            <EmptyState
              icon={<Layers size={22} />}
              title="No category data"
              message="Category statistics are generated from submitted grievances."
            />
          ) : (
            <div className="max-h-[280px] space-y-3.5 overflow-y-auto pr-1">
              {stats.category_distribution.map((item) => (
                <div key={item.category}>
                  <div className="mb-1 flex items-center justify-between gap-3 text-xs">
                    <span className="truncate font-medium text-slate-700">{item.category}</span>
                    <span className="shrink-0 font-semibold text-slate-900">{item.count}</span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-blue-600"
                      style={{ width: `${Math.max((item.count / maxCategory) * 100, 4)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* Recent activity */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 sm:px-6">
            <div className="flex items-center gap-2">
              <Inbox size={18} className="text-blue-600" />
              <h2 className="text-base font-bold text-slate-900">Recent Grievances</h2>
            </div>
            <Link
              to="/admin/grievances"
              className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 transition hover:text-blue-700"
            >
              View all
              <ArrowRight size={14} />
            </Link>
          </div>

          {stats.recent_grievances.length === 0 ? (
            <EmptyState
              icon={<Inbox size={22} />}
              title="No grievances yet"
              message="New citizen submissions will appear here."
            />
          ) : (
            <div className="divide-y divide-slate-100">
              {stats.recent_grievances.map((grievance) => (
                <Link
                  key={grievance.id}
                  to={`/admin/grievances/${grievance.id}`}
                  className="block px-5 py-3.5 transition hover:bg-slate-50 sm:px-6"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded border border-blue-200 bg-blue-50 px-1.5 py-0.5 font-mono text-[10px] font-bold text-blue-700">
                          {grievance.reference_number}
                        </span>
                        <span className="truncate text-[11px] text-slate-500">
                          {grievance.citizen_name || 'Citizen'}
                        </span>
                      </div>
                      <p className="mt-1 truncate text-sm font-semibold text-slate-900">
                        {grievance.subject}
                      </p>
                      <p className="mt-0.5 truncate text-[11px] text-slate-500">
                        {grievance.category} &bull; {grievance.location}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <StatusBadge status={grievance.current_status} size="sm" />
                      <span className="text-[10px] text-slate-400">
                        {formatDate(grievance.created_at)}
                      </span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>

        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 sm:px-6">
            <div className="flex items-center gap-2">
              <Activity size={18} className="text-blue-600" />
              <h2 className="text-base font-bold text-slate-900">Latest Status Updates</h2>
            </div>
            <span className="text-[11px] font-medium text-slate-400">Audit feed</span>
          </div>

          {stats.recent_updates.length === 0 ? (
            <EmptyState
              icon={<Activity size={22} />}
              title="No status updates"
              message="Administrative status changes will be listed here."
            />
          ) : (
            <div className="divide-y divide-slate-100">
              {stats.recent_updates.map((update) => (
                <Link
                  key={update.id}
                  to={`/admin/grievances/${update.grievance_id}`}
                  className="block px-5 py-3.5 transition hover:bg-slate-50 sm:px-6"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusBadge status={update.new_status} size="sm" />
                      {update.old_status && (
                        <span className="text-[10px] text-slate-400">
                          from {update.old_status}
                        </span>
                      )}
                    </div>
                    <span className="shrink-0 text-[10px] text-slate-400">
                      {formatDate(update.created_at)}
                    </span>
                  </div>
                  <p className="mt-1.5 truncate text-xs font-semibold text-slate-800">
                    {update.reference_number} &bull; {update.subject}
                  </p>
                  {update.remarks && (
                    <p className="mt-0.5 line-clamp-2 text-[11px] text-slate-500">{update.remarks}</p>
                  )}
                  <p className="mt-1 text-[10px] font-medium text-slate-400">
                    Logged by {update.changed_by_name || 'System'}
                  </p>
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

const EmptyState: React.FC<{ icon: React.ReactNode; title: string; message: string }> = ({
  icon,
  title,
  message,
}) => (
  <div className="flex flex-col items-center justify-center px-6 py-10 text-center">
    <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-slate-100 text-slate-400">
      {icon}
    </div>
    <p className="text-sm font-semibold text-slate-800">{title}</p>
    <p className="mt-1 max-w-xs text-xs text-slate-500">{message}</p>
  </div>
);
