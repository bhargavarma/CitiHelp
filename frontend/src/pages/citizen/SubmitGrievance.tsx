import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { grievancesApi } from '../../services/api';
import type { Grievance } from '../../types';
import {
  AlertCircle,
  CheckCircle2,
  Upload,
  ArrowRight
} from 'lucide-react';

const grievanceSchema = z.object({
  subject: z.string().min(5, 'Subject must be at least 5 characters').max(255),
  description: z.string().min(15, 'Please provide detailed description (min 15 characters)').max(5000),
  category: z.string().min(1, 'Please select a grievance category'),
  location: z.string().min(3, 'Please specify the exact street, ward, or locality'),
});

type GrievanceFormData = z.infer<typeof grievanceSchema>;

export const SubmitGrievance: React.FC = () => {
  const navigate = useNavigate();
  const [categories, setCategories] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [submittedGrievance, setSubmittedGrievance] = useState<Grievance | null>(null);
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null);
  const [attachmentName, setAttachmentName] = useState<string | null>(null);
  const [attachmentError, setAttachmentError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<GrievanceFormData>({
    resolver: zodResolver(grievanceSchema),
  });

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const cats = await grievancesApi.getCategories();
        setCategories(cats);
      } catch (err) {
        console.error('Failed to fetch categories:', err);
      }
    };
    fetchCategories();
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setAttachmentError(null);
    const file = e.target.files?.[0];
    if (!file) return;

    const allowedExtensions = ['.jpg', '.jpeg', '.png', '.pdf'];
    const extension = file.name.slice(file.name.lastIndexOf('.')).toLowerCase();

    if (!allowedExtensions.includes(extension)) {
      setAttachmentError('Unsupported file type. Please attach a JPEG, PNG or PDF file.');
      setAttachmentFile(null);
      setAttachmentName(null);
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setAttachmentError('File size exceeds the maximum permitted limit of 5 MB.');
      setAttachmentFile(null);
      setAttachmentName(null);
      return;
    }

    setAttachmentFile(file);
    setAttachmentName(file.name);
  };

  const onSubmit = async (data: GrievanceFormData) => {
    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      let attachmentPath: string | undefined;
      if (attachmentFile) {
        const uploaded = await grievancesApi.uploadAttachment(attachmentFile);
        attachmentPath = uploaded.path;
      }

      const result = await grievancesApi.submit({
        ...data,
        attachment_path: attachmentPath,
      });
      setSubmittedGrievance(result);
    } catch (err: any) {
      if (err.response && err.response.data && err.response.data.detail) {
        setErrorMessage(err.response.data.detail);
      } else {
        setErrorMessage('Failed to submit grievance. Please verify input fields.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (submittedGrievance) {
    return (
      <div className="max-w-2xl mx-auto bg-white rounded-2xl border border-slate-200/80 p-8 shadow-sm text-center">
        <div className="w-16 h-16 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-4">
          <CheckCircle2 size={36} />
        </div>
        <h2 className="text-2xl font-extrabold text-slate-900">
          Grievance Lodged Successfully
        </h2>
        <p className="mt-2 text-sm text-slate-600 max-w-md mx-auto">
          Your complaint has been registered in the Public Grievance system and assigned for administrative inspection.
        </p>

        <div className="my-6 p-5 bg-slate-50 rounded-xl border border-slate-200 inline-block text-left w-full max-w-md">
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
            Official Reference Number
          </div>
          <div className="font-mono text-xl font-bold text-blue-700 tracking-wide select-all">
            {submittedGrievance.reference_number}
          </div>
          <div className="mt-3 pt-3 border-t border-slate-200 text-xs text-slate-600 flex justify-between">
            <span>Current Status:</span>
            <span className="font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded">
              {submittedGrievance.current_status}
            </span>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row justify-center gap-3">
          <button
            onClick={() => navigate(`/grievances/${submittedGrievance.id}`)}
            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold transition"
          >
            Track Grievance Timeline
          </button>
          <button
            onClick={() => {
              setSubmittedGrievance(null);
              setAttachmentFile(null);
              setAttachmentName(null);
            }}
            className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-sm font-semibold transition"
          >
            Submit Another Complaint
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
          Submit Citizen Grievance
        </h1>
        <p className="text-sm text-slate-600 mt-1">
          Lodge an official public grievance regarding municipal, water, sanitation, road, or utility defects.
        </p>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-6 sm:p-8">
        {errorMessage && (
          <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm flex items-start space-x-2">
            <AlertCircle size={18} className="shrink-0 mt-0.5" />
            <span>{errorMessage}</span>
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Subject of Grievance *
            </label>
            <input
              type="text"
              {...register('subject')}
              placeholder="e.g. Contaminated drinking water supply in Ward 12"
              className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition"
            />
            {errors.subject && (
              <p className="mt-1 text-xs text-red-600 font-medium">{errors.subject.message}</p>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Department / Category *
              </label>
              <select
                {...register('category')}
                className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent bg-white transition"
              >
                <option value="">Select Category</option>
                {categories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
              {errors.category && (
                <p className="mt-1 text-xs text-red-600 font-medium">{errors.category.message}</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Exact Location / Ward / Street *
              </label>
              <input
                type="text"
                {...register('location')}
                placeholder="e.g. Sector 4, Street 9, Near Water Tank"
                className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition"
              />
              {errors.location && (
                <p className="mt-1 text-xs text-red-600 font-medium">{errors.location.message}</p>
              )}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Comprehensive Problem Description *
            </label>
            <textarea
              rows={5}
              {...register('description')}
              placeholder="Describe the issue in detail: when it began, how many households are affected, and prior department interactions..."
              className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition"
            />
            {errors.description && (
              <p className="mt-1 text-xs text-red-600 font-medium">{errors.description.message}</p>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Optional Supporting Attachment (Photo / PDF, max 5MB)
            </label>
            <div className="border-2 border-dashed border-slate-300 rounded-xl p-4 text-center hover:border-blue-400 transition cursor-pointer relative bg-slate-50/50">
              <input
                type="file"
                accept="image/*,application/pdf"
                onChange={handleFileChange}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
              <Upload size={22} className="text-slate-400 mx-auto mb-1" />
              <p className="text-xs font-medium text-slate-700">
                {attachmentName ? (
                  <span className="text-blue-700 font-semibold">{attachmentName}</span>
                ) : (
                  'Click or drag to attach photographic proof or PDF report'
                )}
              </p>
              <span className="text-[11px] text-slate-400 block mt-0.5">
                JPEG, PNG or PDF up to 5 MB
              </span>
            </div>
            {attachmentError && (
              <p className="mt-1 text-xs text-red-600 font-medium">{attachmentError}</p>
            )}
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full flex items-center justify-center space-x-2 py-3 px-4 border border-transparent rounded-xl shadow-sm text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 transition"
            >
              {isSubmitting ? (
                <span>Registering Complaint...</span>
              ) : (
                <>
                  <span>Submit Grievance</span>
                  <ArrowRight size={16} />
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
