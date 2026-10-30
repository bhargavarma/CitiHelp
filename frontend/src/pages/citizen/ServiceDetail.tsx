import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { servicesApi } from '../../services/api';
import type { Service } from '../../types';
import {
  Building2,
  CheckCircle2,
  FileText,
  ListOrdered,
  ExternalLink,
  Calendar,
  ArrowLeft,
  AlertCircle,
  PlusCircle
} from 'lucide-react';

export const ServiceDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [service, setService] = useState<Service | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchService = async () => {
      if (!id) return;
      try {
        const data = await servicesApi.getServiceById(id);
        setService(data);
      } catch (err: any) {
        setError('Public service record not found or unavailable.');
      } finally {
        setIsLoading(false);
      }
    };
    fetchService();
  }, [id]);

  if (isLoading) {
    return <div className="py-20 text-center text-slate-500 text-sm">Loading service details...</div>;
  }

  if (error || !service) {
    return (
      <div className="bg-white rounded-2xl p-8 text-center border border-slate-200">
        <AlertCircle size={36} className="text-red-500 mx-auto mb-3" />
        <h2 className="text-base font-bold text-slate-900">{error || 'Service not found'}</h2>
        <Link
          to="/services"
          className="mt-4 inline-flex items-center space-x-1.5 px-4 py-2 bg-slate-900 text-white rounded-lg text-xs font-semibold"
        >
          <ArrowLeft size={14} />
          <span>Back to Directory</span>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Back button */}
      <div>
        <Link
          to="/services"
          className="inline-flex items-center space-x-1.5 text-xs font-semibold text-slate-600 hover:text-blue-600 transition"
        >
          <ArrowLeft size={14} />
          <span>Back to Service Directory</span>
        </Link>
      </div>

      {/* Main Card */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        {/* Banner header */}
        <div className="p-6 sm:p-8 border-b border-slate-100 bg-slate-900 text-white">
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <span className="text-xs font-semibold px-2.5 py-1 rounded bg-blue-600 text-white">
              {service.category}
            </span>
            {service.is_verified ? (
              <span className="inline-flex items-center text-xs text-emerald-400 font-medium">
                <CheckCircle2 size={14} className="mr-1" />
                Verified Government Information
              </span>
            ) : (
              <span className="text-xs text-amber-300 font-medium bg-amber-500/20 px-2 py-0.5 rounded border border-amber-400/30">
                Sample Prototype Data
              </span>
            )}
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            {service.name}
          </h1>
          <p className="mt-2 text-sm text-slate-300 flex items-center space-x-2">
            <Building2 size={16} className="text-blue-400" />
            <span>{service.department}</span>
          </p>
        </div>

        {/* Content sections */}
        <div className="p-6 sm:p-8 space-y-6 text-sm text-slate-800">
          <div>
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
              Service Description
            </h3>
            <p className="leading-relaxed text-slate-700 bg-slate-50 p-4 rounded-xl border border-slate-200/70">
              {service.description}
            </p>
          </div>

          <div>
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
              Eligibility Criteria
            </h3>
            <p className="leading-relaxed text-slate-700 bg-slate-50 p-4 rounded-xl border border-slate-200/70">
              {service.eligibility}
            </p>
          </div>

          <div>
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center space-x-1.5">
              <FileText size={16} className="text-blue-600" />
              <span>Mandatory Documentation Checklist</span>
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mt-2">
              {Array.isArray(service.required_documents) &&
                service.required_documents.map((doc, idx) => (
                  <div
                    key={idx}
                    className="flex items-start space-x-2.5 p-3 rounded-xl bg-blue-50/50 border border-blue-100 text-xs text-slate-700"
                  >
                    <CheckCircle2 size={15} className="text-blue-600 shrink-0 mt-0.5" />
                    <span>{doc}</span>
                  </div>
                ))}
            </div>
          </div>

          <div>
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center space-x-1.5">
              <ListOrdered size={16} className="text-blue-600" />
              <span>Application Procedure Steps</span>
            </h3>
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/70 text-slate-700 whitespace-pre-line leading-relaxed text-xs">
              {service.procedure}
            </div>
          </div>

          {/* Metadata Footer */}
          <div className="pt-6 border-t border-slate-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 text-xs text-slate-500">
            <div className="flex items-center space-x-4">
              <span className="flex items-center space-x-1.5">
                <Calendar size={14} className="text-slate-400" />
                <span>Last Reviewed: {service.last_reviewed}</span>
              </span>
              {service.source_url && (
                <a
                  href={service.source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:text-blue-700 font-semibold inline-flex items-center space-x-1"
                >
                  <span>Official Reference Portal</span>
                  <ExternalLink size={12} />
                </a>
              )}
            </div>

            <Link
              to="/grievances/new"
              className="inline-flex items-center space-x-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-lg shadow-xs transition"
            >
              <PlusCircle size={14} />
              <span>Lodge Grievance for this Service</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};
