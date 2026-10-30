import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { Mail, Phone, Shield, Calendar, CheckCircle2 } from 'lucide-react';

export const Profile: React.FC = () => {
  const { user } = useAuth();

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Citizen Profile</h1>
        <p className="text-sm text-slate-600 mt-1">
          Review your registered identity details, contact records, and portal account status.
        </p>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-6 sm:p-8 space-y-6">
        <div className="flex items-center space-x-4 pb-6 border-b border-slate-100">
          <div className="w-16 h-16 rounded-2xl bg-blue-600 text-white flex items-center justify-center font-bold text-2xl shadow">
            {user?.full_name?.charAt(0).toUpperCase() || 'U'}
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900">{user?.full_name}</h2>
            <div className="flex items-center space-x-2 mt-1">
              <span className="text-xs font-semibold px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200 uppercase">
                {user?.role}
              </span>
              <span className="inline-flex items-center text-xs text-emerald-600 font-medium">
                <CheckCircle2 size={13} className="mr-1" />
                Active Account
              </span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/70">
            <div className="flex items-center space-x-2 text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
              <Mail size={14} />
              <span>Email Address</span>
            </div>
            <div className="text-sm font-semibold text-slate-800">{user?.email}</div>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/70">
            <div className="flex items-center space-x-2 text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
              <Phone size={14} />
              <span>Mobile Contact</span>
            </div>
            <div className="text-sm font-semibold text-slate-800">
              {user?.phone || 'Not provided'}
            </div>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/70">
            <div className="flex items-center space-x-2 text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
              <Shield size={14} />
              <span>Account Type</span>
            </div>
            <div className="text-sm font-semibold text-slate-800 capitalize">
              {user?.role === 'admin' ? 'Administrative Authority' : 'Verified Citizen'}
            </div>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/70">
            <div className="flex items-center space-x-2 text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
              <Calendar size={14} />
              <span>Member Since</span>
            </div>
            <div className="text-sm font-semibold text-slate-800">
              {user?.created_at ? new Date(user.created_at).toLocaleDateString() : 'N/A'}
            </div>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-blue-50/60 border border-blue-100 text-xs text-blue-900 leading-relaxed">
          <strong>Security Note:</strong> All login sessions are protected with Argon2 password
          hashing and stateless JWT authentication. Grievance submissions are linked securely to
          your user record.
        </div>
      </div>
    </div>
  );
};
