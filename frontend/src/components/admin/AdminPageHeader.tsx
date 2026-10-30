import React from 'react';
import { ChevronRight } from 'lucide-react';

interface AdminPageHeaderProps {
  title: string;
  description?: string;
  section?: string;
  actions?: React.ReactNode;
}

export const AdminPageHeader: React.FC<AdminPageHeaderProps> = ({
  title,
  description,
  section = 'Dashboard',
  actions,
}) => (
  <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
    <div className="min-w-0">
      <nav className="mb-1.5 flex items-center gap-1.5 text-[11px] font-medium text-slate-400">
        <span>Administration</span>
        <ChevronRight size={12} />
        <span className="text-slate-600">{section}</span>
      </nav>
      <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-[28px]">{title}</h1>
      {description && <p className="mt-1 max-w-3xl text-sm text-slate-600">{description}</p>}
    </div>
    {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
  </div>
);
