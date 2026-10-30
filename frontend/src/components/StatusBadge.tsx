import React from 'react';

interface StatusBadgeProps {
  status: string;
  size?: 'sm' | 'md';
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, size = 'md' }) => {
  const normalized = status.toLowerCase();
  
  let colorStyles = 'bg-gray-100 text-gray-800 border-gray-300';
  
  if (normalized === 'submitted') {
    colorStyles = 'bg-blue-50 text-blue-700 border-blue-200';
  } else if (normalized === 'under review') {
    colorStyles = 'bg-amber-50 text-amber-700 border-amber-200';
  } else if (normalized === 'in progress') {
    colorStyles = 'bg-purple-50 text-purple-700 border-purple-200';
  } else if (normalized === 'resolved') {
    colorStyles = 'bg-emerald-50 text-emerald-700 border-emerald-200';
  } else if (normalized === 'rejected') {
    colorStyles = 'bg-rose-50 text-rose-700 border-rose-200';
  }

  const sizeStyles = size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-xs font-semibold';

  return (
    <span className={`inline-flex items-center rounded-full border ${colorStyles} ${sizeStyles}`}>
      <span className="w-1.5 h-1.5 rounded-full mr-1.5 bg-current opacity-70"></span>
      {status}
    </span>
  );
};
