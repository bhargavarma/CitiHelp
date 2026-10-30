import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { grievancesApi } from '../../services/api';
import { StatusBadge } from '../../components/StatusBadge';
import type { Grievance, GrievanceSummary } from '../../types';
import {
  AlertCircle,
  ArrowRight,
  Building2,
  CheckCircle2,
  Clock,
  FileText,
  MessageSquare,
  PlusCircle,
  RefreshCw,
  Search,
  XCircle,
} from 'lucide-react';

function formatDate(value?: string): string {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString();
}

export const CitizenDashboard: React.FC = () => {
  const { user } = useAuth();
  const [grievances, setGrievances] = useState<Grievance[]>([]);
  const [summary, setSummary] = useState<GrievanceSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [trackRef, setTrackRef] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  const loadDashboard = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [res, summaryData] = await Promise.all([
        grievancesApi.getMyGrievances({ page: 1, page_size: 5 }),
        grievancesApi.getSummary(),
      ]);
      setGrievances(res.items);
      setSummary(summaryData);
    } catch {
      setError('Unable to load your grievance dashboard. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard, reloadKey]);

  const totalCount = summary?.total ?? 0;
  const pendingCount = summary
    ? summary.submitted + summary.under_review + summary.in_progress
    : 0;
  const resolvedCount = summary?.resolved ?? 0;
  const rejectedCount = summary?.rejected ?? 0;

  const statCards = [
    {
      label: 'Total Grievances',
      value: totalCount,
      icon: FileText,
      iconTone: 'bg-blue-50 text-blue-600',
      valueTone: 'text-slate-900',
    },
    {
      label: 'Active / Pending',
      value: pendingCount,
      icon: Clock,
      iconTone: 'bg-amber-50 text-amber-600',
      valueTone: 'text-amber-700',
    },
    {
      label: 'Resolved',
      value: resolvedCount,
      icon: CheckCircle2,
      iconTone: 'bg-emerald-50 text-emerald-600',
      valueTone: 'text-emerald-700',
    },
    {
      label: 'Rejected',
      value: rejectedCount,
      icon: XCircle,
      iconTone: 'bg-rose-50 text-rose-600',
      valueTone: 'text-rose-700',
    },
  ];

  const statusSnapshot = [
    { label: 'Submitted', value: summary?.submitted ?? 0, color: 'bg-blue-500' },
    { label: 'Under Review', value: summary?.under_review ?? 0, color: 'bg-amber-500' },
    { label: 'In Progress', value: summary?.in_progress ?? 0, color: 'bg-violet-500' },
    { label: 'Resolved', value: summary?.resolved ?? 0, color: 'bg-emerald-500' },
    { label: 'Rejected', value: summary?.rejected ?? 0, color: 'bg-rose-500' },
  ];

  return (
    <div className="space-y-6">
      {/* Welcome header */}
      <div className="rounded-2xl bg-gradient-to-r from-blue-950 via-slate-900 to-slate-900 p-6 text-white shadow-sm sm:p-8">
        <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-center">
          <div className="min-w-0">
            <span className="mb-1 block text-[10px] font-bold uppercase tracking-[0.18em] text-blue-300">
              Citizen Grievance Redressal Portal
            </span>
            <h1 className="truncate text-2xl font-bold tracking-tight sm:text-3xl">
              Welcome, {user?.full_name || 'Citizen'}
            </h1>
            <p className="mt-1 max-w-2xl text-sm text-slate-300">
              Submit public complaints, follow administrative action, and consult the AI assistant
              for verified service guidance.
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <Link
              to="/grievances/new"
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-500"
            >
              <PlusCircle size={16} />
              New Grievance
            </Link>
            <Link
              to="/assistant"
              className="inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-800 px-4 py-2.5 text-sm font-semibold text-slate-200 transition hover:bg-slate-700"
            >
              <MessageSquare size={16} />
              Ask AI
            </Link>
          </div>
        </div>
      </div>

      {/* Track search */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (!trackRef.trim()) return;
            window.location.href = `/grievances?search=${encodeURIComponent(trackRef.trim())}`;
          }}
          className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center"
        >
          <div className="relative flex-1">
            <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              value={trackRef}
              onChange={(event) => setTrackRef(event.target.value)}
              placeholder="Search by reference ID (GRV-...) or subject..."
              aria-label="Track a grievance"
              className="w-full rounded-lg border border-slate-300 py-2.5 pl-10 pr-4 text-sm outline-none transition placeholder:text-slate-400 focus:border-transparent focus:ring-2 focus:ring-blue-600"
            />
          </div>
          <button
            type="submit"
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
          >
            Track status
            <ArrowRight size={15} />
          </button>
        </form>
      </div>

      {error && (
        <div className="flex flex-col gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-2.5">
            <AlertCircle size={18} className="mt-0.5 shrink-0 text-rose-600" />
            <p className="text-sm text-rose-800">{error}</p>
          </div>
          <button
            type="button"
            onClick={() => setReloadKey((key) => key + 1)}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-rose-300 bg-white px-3 py-1.5 text-xs font-semibold text-rose-700 transition hover:bg-rose-100"
          >
            <RefreshCw size={13} />
            Retry
          </button>
        </div>
      )}

      {/* Symmetric summary cards */}
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        {statCards.map((card) => {
          const Icon = card.icon;
          return (
            <div
              key={card.label}
              className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5"
            >
              <div
                className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${card.iconTone}`}
              >
                <Icon size={21} />
              </div>
              <div className="min-w-0">
                {isLoading ? (
                  <div className="h-7 w-10 animate-pulse rounded bg-slate-200" />
                ) : (
                  <p className={`text-2xl font-bold tracking-tight ${card.valueTone}`}>{card.value}</p>
                )}
                <p className="truncate text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                  {card.label}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Two-column workspace */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm lg:col-span-2">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 sm:px-6">
            <div className="flex items-center gap-2">
              <FileText size={18} className="text-blue-600" />
              <h2 className="text-base font-bold text-slate-900">Recent Grievances</h2>
            </div>
            <Link
              to="/grievances"
              className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 transition hover:text-blue-700"
            >
              View all
              <ArrowRight size={14} />
            </Link>
          </div>

          {isLoading ? (
            <div className="divide-y divide-slate-100">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="flex items-center gap-4 px-5 py-4 sm:px-6">
                  <div className="h-4 w-28 animate-pulse rounded bg-slate-200" />
                  <div className="h-4 flex-1 animate-pulse rounded bg-slate-200" />
                  <div className="h-6 w-20 animate-pulse rounded-full bg-slate-200" />
                </div>
              ))}
            </div>
          ) : grievances.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                <FileText size={23} />
              </div>
              <h3 className="text-sm font-semibold text-slate-800">No grievances lodged yet</h3>
              <p className="mx-auto mt-1 max-w-sm text-xs text-slate-500">
                If you are facing a civic, water, sanitation or municipal issue, submit your first
                grievance today.
              </p>
              <Link
                to="/grievances/new"
                className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-blue-700"
              >
                <PlusCircle size={14} />
                Submit Grievance
              </Link>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {grievances.map((grievance) => (
                <Link
                  key={grievance.id}
                  to={`/grievances/${grievance.id}`}
                  className="block px-5 py-4 transition hover:bg-slate-50/80 sm:px-6"
                >
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded border border-blue-200 bg-blue-50 px-1.5 py-0.5 font-mono text-[10px] font-bold text-blue-700">
                          {grievance.reference_number}
                        </span>
                        <span className="text-[11px] text-slate-400">{grievance.category}</span>
                      </div>
                      <p className="mt-1.5 truncate text-sm font-semibold text-slate-900">
                        {grievance.subject}
                      </p>
                      <p className="mt-0.5 line-clamp-1 text-xs text-slate-500">
                        {grievance.description}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center justify-between gap-3 sm:flex-col sm:items-end">
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

        <div className="space-y-6">
          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-base font-bold text-slate-900">Status Snapshot</h2>
            <p className="mt-0.5 text-xs text-slate-500">All grievances on your account.</p>
            <div className="mt-4 space-y-2.5">
              {statusSnapshot.map((item) => (
                <div key={item.label} className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className={`h-2.5 w-2.5 rounded-full ${item.color}`} />
                    <span className="text-xs font-medium text-slate-600">{item.label}</span>
                  </div>
                  <span className="text-xs font-bold text-slate-800">
                    {isLoading ? '—' : item.value}
                  </span>
                </div>
              ))}
            </div>
            <div className="mt-4 border-t border-slate-100 pt-4">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-slate-500">Resolution rate</span>
                <span className="font-bold text-emerald-700">
                  {totalCount > 0 ? Math.round((resolvedCount / totalCount) * 100) : 0}%
                </span>
              </div>
              <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-emerald-500 transition-all"
                  style={{
                    width: `${totalCount > 0 ? Math.round((resolvedCount / totalCount) * 100) : 0}%`,
                  }}
                />
              </div>
            </div>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-base font-bold text-slate-900">Quick Actions</h2>
            <div className="mt-3 space-y-2">
              <Link
                to="/grievances/new"
                className="group flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 px-3.5 py-3 transition hover:border-blue-200 hover:bg-blue-50"
              >
                <span className="flex items-center gap-2.5 text-xs font-semibold text-slate-700 group-hover:text-blue-800">
                  <PlusCircle size={16} className="text-blue-600" />
                  Lodge a new grievance
                </span>
                <ArrowRight size={14} className="text-slate-400 group-hover:text-blue-600" />
              </Link>
              <Link
                to="/assistant"
                className="group flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 px-3.5 py-3 transition hover:border-blue-200 hover:bg-blue-50"
              >
                <span className="flex items-center gap-2.5 text-xs font-semibold text-slate-700 group-hover:text-blue-800">
                  <MessageSquare size={16} className="text-blue-600" />
                  Ask the AI assistant
                </span>
                <ArrowRight size={14} className="text-slate-400 group-hover:text-blue-600" />
              </Link>
              <Link
                to="/services"
                className="group flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 px-3.5 py-3 transition hover:border-blue-200 hover:bg-blue-50"
              >
                <span className="flex items-center gap-2.5 text-xs font-semibold text-slate-700 group-hover:text-blue-800">
                  <Building2 size={16} className="text-blue-600" />
                  Browse service directory
                </span>
                <ArrowRight size={14} className="text-slate-400 group-hover:text-blue-600" />
              </Link>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};
