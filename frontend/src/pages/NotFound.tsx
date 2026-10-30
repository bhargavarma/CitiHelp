import React from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, ArrowLeft } from 'lucide-react';

export const NotFound: React.FC = () => {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4 font-sans">
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-8 sm:p-10 text-center max-w-md w-full">
        <AlertCircle size={40} className="text-amber-500 mx-auto mb-4" />
        <h1 className="text-2xl font-extrabold text-slate-900">Page not found</h1>
        <p className="mt-2 text-sm text-slate-600">
          The page you requested does not exist or may have been moved.
        </p>
        <Link
          to="/"
          className="mt-6 inline-flex items-center space-x-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold transition"
        >
          <ArrowLeft size={16} />
          <span>Return to Home</span>
        </Link>
      </div>
    </div>
  );
};
