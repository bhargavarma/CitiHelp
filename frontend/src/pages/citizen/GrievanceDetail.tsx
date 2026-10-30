import React, { useEffect, useMemo, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { grievancesApi, getUploadUrl } from '../../services/api';
import { StatusBadge } from '../../components/StatusBadge';
import type { GrievanceDetail as GrievanceDetailType } from '../../types';
import {
  ArrowLeft,
  Calendar,
  MapPin,
  Clock,
  AlertCircle,
  FileText
} from 'lucide-react';

export const GrievanceDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [grievance, setGrievance] = useState<GrievanceDetailType | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchDetail = async () => {
      if (!id) return;
      try {
        const data = await grievancesApi.getById(id);
        setGrievance(data);
      } catch (err: any) {
        if (err.response && err.response.status === 403) {
          setError('Access Denied: You do not hold ownership permission for this grievance.');
        } else {
          setError('Grievance record not found.');
        }
      } finally {
        setIsLoading(false);
      }
    };
    fetchDetail();
  }, [id]);

  const history = useMemo(
    () =>
      [...(grievance?.history ?? [])].sort(
        (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      ),
    [grievance]
  );

  if (isLoading) {
    return <div className="py-20 text-center text-slate-500 text-sm">Loading grievance audit record...</div>;
  }

  if (error || !grievance) {
    return (
      <div className="bg-white rounded-2xl p-8 text-center border border-slate-200">
        <AlertCircle size={36} className="text-red-500 mx-auto mb-3" />
        <h2 className="text-base font-bold text-slate-900">{error || 'Grievance record not found'}</h2>
        <Link
          to="/grievances"
          className="mt-4 inline-flex items-center space-x-1.5 px-4 py-2 bg-slate-900 text-white rounded-lg text-xs font-semibold"
        >
          <ArrowLeft size={14} />
          <span>Return to Grievances</span>
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <Link
          to="/grievances"
          className="inline-flex items-center space-x-1.5 text-xs font-semibold text-slate-600 hover:text-blue-600 transition"
        >
          <ArrowLeft size={14} />
          <span>Back to My Grievances</span>
        </Link>
      </div>

      {/* Main Info Card */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-6 sm:p-8 space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-6 border-b border-slate-100">
          <div>
            <div className="flex items-center space-x-2">
              <span className="font-mono text-sm font-bold text-blue-700 bg-blue-50 px-2.5 py-1 rounded border border-blue-200">
                {grievance.reference_number}
              </span>
              <span className="text-xs text-slate-400">&bull;</span>
              <span className="text-xs font-semibold text-slate-500">{grievance.category}</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 mt-2">
              {grievance.subject}
            </h1>
          </div>
          <div className="shrink-0">
            <StatusBadge status={grievance.current_status} size="md" />
          </div>
        </div>

        {/* Location & Dates */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs text-slate-600 bg-slate-50 p-4 rounded-xl border border-slate-200/70">
          <div className="flex items-center space-x-2">
            <MapPin size={16} className="text-slate-400 shrink-0" />
            <span>
              <strong>Location:</strong> {grievance.location}
            </span>
          </div>
          <div className="flex items-center space-x-2">
            <Calendar size={16} className="text-slate-400 shrink-0" />
            <span>
              <strong>Date Lodged:</strong> {new Date(grievance.created_at).toLocaleString()}
            </span>
          </div>
        </div>

        {/* Description */}
        <div>
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
            Grievance Narrative
          </h3>
          <p className="text-sm text-slate-800 leading-relaxed bg-white p-4 rounded-xl border border-slate-200">
            {grievance.description}
          </p>
        </div>

        {/* Attachment info */}
        {grievance.attachment_path && (
          <div>
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
              Supporting Attachment Evidence
            </h3>
            <a
              href={getUploadUrl(grievance.attachment_path)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center space-x-2 p-3 bg-blue-50/50 hover:bg-blue-50 rounded-lg border border-blue-100 text-xs text-blue-800 font-medium transition"
            >
              <FileText size={16} />
              <span>View uploaded attachment</span>
            </a>
          </div>
        )}
      </div>

      {/* Chronological Status Audit Timeline */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-6 sm:p-8">
        <h2 className="text-base font-bold text-slate-900 mb-6 flex items-center space-x-2">
          <Clock size={18} className="text-blue-600" />
          <span>Chronological Status Redressal Timeline</span>
        </h2>

        {history.length === 0 ? (
          <p className="text-xs text-slate-500">No history records logged yet.</p>
        ) : (
          <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
            {history.map((entry, idx) => (
              <div key={entry.id || idx} className="relative">
                {/* Timeline dot */}
                <div className="absolute -left-6 top-1.5 w-3.5 h-3.5 rounded-full bg-blue-600 border-2 border-white shadow-xs"></div>
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/80">
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
                    <div className="flex items-center space-x-2">
                      <StatusBadge status={entry.new_status} size="sm" />
                      {entry.old_status && (
                        <span className="text-[11px] text-slate-400">
                          (transitioned from {entry.old_status})
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] text-slate-400">
                      {new Date(entry.created_at).toLocaleString()}
                    </span>
                  </div>

                  {entry.remarks ? (
                    <p className="text-xs text-slate-700 mt-2 font-medium bg-white p-3 rounded-lg border border-slate-200/60">
                      &ldquo;{entry.remarks}&rdquo;
                    </p>
                  ) : (
                    <p className="text-xs text-slate-400 mt-1 italic">
                      Status transition recorded without additional remarks.
                    </p>
                  )}

                  <div className="mt-2 text-[11px] text-slate-400">
                    Authority / Officer: {entry.changed_by_name || 'System Auto-Registration'}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
