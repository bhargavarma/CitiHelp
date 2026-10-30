import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  AlertCircle,
  ArrowLeft,
  Calendar,
  CheckCircle2,
  Clock,
  FileText,
  History,
  Mail,
  MapPin,
  RefreshCw,
  Send,
  ShieldCheck,
  Tag,
  User,
} from 'lucide-react';
import { adminApi, getUploadUrl } from '../../services/api';
import { StatusBadge } from '../../components/StatusBadge';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { AdminPageHeader } from '../../components/admin/AdminPageHeader';
import { useToast } from '../../context/ToastContext';
import type { GrievanceDetail as GrievanceDetailType } from '../../types';

const STATUS_OPTIONS = ['Submitted', 'Under Review', 'In Progress', 'Resolved', 'Rejected'];

function formatDateTime(value?: string): string {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString();
}

const DetailSkeleton: React.FC = () => (
  <div className="space-y-5" aria-busy="true" aria-label="Loading grievance">
    <div className="h-8 w-40 animate-pulse rounded bg-slate-200" />
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <div className="space-y-6 lg:col-span-2">
        <div className="h-80 animate-pulse rounded-xl border border-slate-200 bg-white" />
        <div className="h-72 animate-pulse rounded-xl border border-slate-200 bg-white" />
      </div>
      <div className="h-96 animate-pulse rounded-xl border border-slate-200 bg-white" />
    </div>
  </div>
);

export const AdminGrievanceDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const toast = useToast();

  const [grievance, setGrievance] = useState<GrievanceDetailType | null>(null);
  const [selectedStatus, setSelectedStatus] = useState('');
  const [remarks, setRemarks] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  const fetchDetail = useCallback(async () => {
    if (!id) return;
    setIsLoading(true);
    setError(null);
    try {
      const data = await adminApi.getGrievanceById(id);
      setGrievance(data);
      setSelectedStatus(data.current_status);
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      setError(
        status === 404
          ? 'This grievance record does not exist or may have been removed.'
          : 'Unable to load the grievance record. Please try again.'
      );
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchDetail();
  }, [fetchDetail]);

  const history = useMemo(() => {
    const records = grievance?.history ?? [];
    return [...records].sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );
  }, [grievance]);

  const hasChange = Boolean(
    grievance && (selectedStatus !== grievance.current_status || remarks.trim())
  );

  const requestUpdate = (event: React.FormEvent) => {
    event.preventDefault();
    if (!grievance || !selectedStatus) return;
    if (!hasChange) {
      toast.info('No change to record', 'Select a different status or add administrative remarks.');
      return;
    }
    setConfirmOpen(true);
  };

  const confirmUpdate = async () => {
    if (!id || !grievance || !selectedStatus) return;
    setIsUpdating(true);
    try {
      const updated = await adminApi.updateStatus(id, {
        status: selectedStatus,
        remarks: remarks.trim() || undefined,
      });
      setGrievance(updated);
      setSelectedStatus(updated.current_status);
      setRemarks('');
      setConfirmOpen(false);
      toast.success(
        'Status updated',
        `${updated.reference_number} is now marked "${updated.current_status}".`
      );
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: unknown } } })?.response?.data
        ?.detail;
      const message =
        typeof detail === 'string'
          ? detail
          : 'The status update could not be saved. Check your permissions and try again.';
      toast.error('Update failed', message);
      setConfirmOpen(false);
    } finally {
      setIsUpdating(false);
    }
  };

  if (isLoading) return <DetailSkeleton />;

  if (error || !grievance) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <AlertCircle size={36} className="mx-auto mb-3 text-rose-500" />
        <h2 className="text-base font-bold text-slate-900">Grievance unavailable</h2>
        <p className="mx-auto mt-1 max-w-md text-sm text-slate-600">{error}</p>
        <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
          <button
            type="button"
            onClick={fetchDetail}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700"
          >
            <RefreshCw size={16} />
            Retry
          </button>
          <Link
            to="/admin/grievances"
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            <ArrowLeft size={16} />
            Back to register
          </Link>
        </div>
      </div>
    );
  }

  const meta = [
    { label: 'Citizen', value: grievance.citizen_name || 'Citizen', icon: User },
    { label: 'Email', value: grievance.citizen_email || 'Not provided', icon: Mail },
    { label: 'Category', value: grievance.category, icon: Tag },
    { label: 'Location', value: grievance.location, icon: MapPin },
    { label: 'Submitted', value: formatDateTime(grievance.created_at), icon: Calendar },
    { label: 'Last updated', value: formatDateTime(grievance.updated_at), icon: Clock },
  ];

  return (
    <div className="space-y-5">
      <Link
        to="/admin/grievances"
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 transition hover:text-blue-600"
      >
        <ArrowLeft size={14} />
        Back to grievance register
      </Link>

      <AdminPageHeader
        section="Grievance Detail"
        title={grievance.subject}
        description={`${grievance.reference_number} • ${grievance.category}`}
        actions={<StatusBadge status={grievance.current_status} />}
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {/* Complaint record */}
          <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 px-5 py-4 sm:px-6">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded border border-blue-200 bg-blue-50 px-2 py-0.5 font-mono text-xs font-bold text-blue-700">
                  {grievance.reference_number}
                </span>
                <StatusBadge status={grievance.current_status} size="sm" />
              </div>
              <h2 className="mt-2 text-lg font-bold text-slate-900">{grievance.subject}</h2>
            </div>

            <div className="grid grid-cols-1 gap-x-6 gap-y-4 px-5 py-5 sm:grid-cols-2 sm:px-6">
              {meta.map((item) => {
                const Icon = item.icon;
                return (
                  <div key={item.label} className="flex items-start gap-2.5">
                    <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
                      <Icon size={15} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        {item.label}
                      </p>
                      <p className="mt-0.5 break-words text-xs font-semibold text-slate-800">
                        {item.value}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="border-t border-slate-100 px-5 py-5 sm:px-6">
              <h3 className="mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Grievance Description
              </h3>
              <p className="whitespace-pre-wrap rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm leading-relaxed text-slate-700">
                {grievance.description}
              </p>
            </div>

            {grievance.attachment_path && (
              <div className="border-t border-slate-100 px-5 py-4 sm:px-6">
                <h3 className="mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Supporting Attachment
                </h3>
                <a
                  href={getUploadUrl(grievance.attachment_path)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3.5 py-2.5 text-xs font-semibold text-blue-700 transition hover:bg-blue-100"
                >
                  <FileText size={15} />
                  Open uploaded evidence
                </a>
              </div>
            )}
          </section>

          {/* Audit trail */}
          <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 sm:px-6">
              <div className="flex items-center gap-2">
                <History size={18} className="text-blue-600" />
                <h2 className="text-base font-bold text-slate-900">Status History</h2>
              </div>
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600">
                {history.length} entr{history.length === 1 ? 'y' : 'ies'}
              </span>
            </div>

            {history.length === 0 ? (
              <div className="px-6 py-10 text-center">
                <History size={28} className="mx-auto mb-2 text-slate-300" />
                <p className="text-sm font-semibold text-slate-800">No history recorded</p>
                <p className="mt-1 text-xs text-slate-500">
                  Status changes will create immutable audit entries here.
                </p>
              </div>
            ) : (
              <ol className="relative space-y-5 px-5 py-5 before:absolute before:bottom-6 before:left-[30px] before:top-6 before:w-px before:bg-slate-200 sm:px-6">
                {history.map((entry, index) => {
                  const isLatest = index === history.length - 1;
                  return (
                    <li key={entry.id || index} className="relative flex gap-4">
                      <span
                        className={`relative z-10 mt-1 flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full border-2 border-white shadow-sm ${
                          isLatest ? 'bg-blue-600 ring-2 ring-blue-100' : 'bg-slate-300'
                        }`}
                      />
                      <div className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-slate-50 p-3.5">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <StatusBadge status={entry.new_status} size="sm" />
                            {entry.old_status && (
                              <span className="text-[10px] text-slate-400">
                                from {entry.old_status}
                              </span>
                            )}
                            {isLatest && (
                              <span className="rounded-full bg-blue-100 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-blue-700">
                                Latest
                              </span>
                            )}
                          </div>
                          <span className="text-[10px] text-slate-400">
                            {formatDateTime(entry.created_at)}
                          </span>
                        </div>
                        <p className="mt-2 text-xs leading-relaxed text-slate-700">
                          {entry.remarks || 'Status transition recorded without additional remarks.'}
                        </p>
                        <p className="mt-2 text-[10px] font-medium text-slate-400">
                          Logged by {entry.changed_by_name || 'System / Citizen'}
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}
          </section>
        </div>

        {/* Status update panel */}
        <div className="lg:col-span-1">
          <section className="rounded-xl border border-slate-200 bg-white shadow-sm lg:sticky lg:top-24">
            <div className="border-b border-slate-100 px-5 py-4">
              <div className="flex items-center gap-2">
                <ShieldCheck size={18} className="text-blue-600" />
                <h2 className="text-base font-bold text-slate-900">Update Status</h2>
              </div>
              <p className="mt-1 text-[11px] leading-relaxed text-slate-500">
                Every change is permanently recorded with your administrator identity and timestamp.
              </p>
            </div>

            <form onSubmit={requestUpdate} className="space-y-4 px-5 py-5">
              <div>
                <label
                  htmlFor="status-select"
                  className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-slate-500"
                >
                  New status
                </label>
                <select
                  id="status-select"
                  value={selectedStatus}
                  onChange={(event) => setSelectedStatus(event.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm font-semibold text-slate-800 outline-none transition focus:border-transparent focus:ring-2 focus:ring-blue-600"
                >
                  {STATUS_OPTIONS.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
                <p className="mt-1.5 text-[10px] text-slate-400">
                  Current status: <span className="font-semibold text-slate-600">{grievance.current_status}</span>
                </p>
              </div>

              <div>
                <div className="mb-1.5 flex items-center justify-between">
                  <label
                    htmlFor="remarks"
                    className="text-[10px] font-bold uppercase tracking-wider text-slate-500"
                  >
                    Administrative remarks
                  </label>
                  <span className="text-[10px] text-slate-400">{remarks.length}/2000</span>
                </div>
                <textarea
                  id="remarks"
                  rows={5}
                  maxLength={2000}
                  value={remarks}
                  onChange={(event) => setRemarks(event.target.value)}
                  placeholder="Record inspection notes, field orders, contractor assignment or resolution justification..."
                  className="w-full resize-y rounded-lg border border-slate-300 px-3 py-2.5 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-transparent focus:ring-2 focus:ring-blue-600"
                />
                <p className="mt-1.5 text-[10px] leading-relaxed text-slate-400">
                  Optional. Remarks are visible to the citizen in the audit timeline.
                </p>
              </div>

              {!hasChange && (
                <p className="rounded-lg bg-slate-50 px-3 py-2 text-[11px] text-slate-500">
                  Select a different status or add remarks to enable the update.
                </p>
              )}

              <button
                type="submit"
                disabled={!hasChange || isUpdating}
                className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Send size={15} />
                Review & save update
              </button>
            </form>

            <div className="border-t border-slate-100 px-5 py-4">
              <div className="flex items-start gap-2 rounded-lg bg-blue-50 px-3 py-2.5 text-[11px] leading-relaxed text-blue-900">
                <CheckCircle2 size={14} className="mt-0.5 shrink-0" />
                <span>
                  Previous history is never overwritten. A new audit entry is appended for every
                  status change.
                </span>
              </div>
            </div>
          </section>
        </div>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        title="Confirm status update"
        description={
          <div className="space-y-2">
            <p>
              Change status from{' '}
              <span className="font-semibold text-slate-800">{grievance.current_status}</span> to{' '}
              <span className="font-semibold text-slate-800">{selectedStatus}</span>?
            </p>
            {remarks.trim() && (
              <p className="rounded-lg bg-slate-50 p-2.5 text-xs text-slate-600">
                <span className="font-semibold text-slate-700">Remarks:</span> {remarks.trim()}
              </p>
            )}
            <p className="text-xs text-slate-500">
              This action will append a permanent audit entry and notify the citizen through the
              grievance timeline.
            </p>
          </div>
        }
        confirmLabel="Save status update"
        tone="primary"
        isLoading={isUpdating}
        onConfirm={confirmUpdate}
        onCancel={() => {
          if (!isUpdating) setConfirmOpen(false);
        }}
      />
    </div>
  );
};
