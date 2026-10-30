import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  Building2,
  Calendar,
  CheckCircle2,
  KeyRound,
  LogOut,
  Mail,
  ShieldCheck,
  UserCog,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { AdminPageHeader } from '../../components/admin/AdminPageHeader';

function formatDate(value?: string): string {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export const AdminProfile: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  return (
    <div className="space-y-5">
      <AdminPageHeader
        section="Admin Profile"
        title="Account & Access"
        description="Review the administrator account currently signed in to this console."
        actions={
          <button
            type="button"
            onClick={handleLogout}
            className="inline-flex items-center gap-2 rounded-lg border border-rose-200 bg-white px-3.5 py-2.5 text-sm font-semibold text-rose-700 transition hover:bg-rose-50"
          >
            <LogOut size={16} />
            Sign out
          </button>
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm lg:col-span-1">
          <div className="flex flex-col items-center text-center">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-slate-900 text-2xl font-bold text-white">
              {(user?.full_name || 'A').charAt(0).toUpperCase()}
            </div>
            <h2 className="mt-4 text-lg font-bold text-slate-900">{user?.full_name || 'Administrator'}</h2>
            <span className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-blue-700">
              <ShieldCheck size={12} />
              Administrative Officer
            </span>
            <p className="mt-3 text-xs text-slate-500">{user?.email}</p>
          </div>

          <dl className="mt-6 space-y-3 border-t border-slate-100 pt-5">
            <div className="flex items-center justify-between gap-3 text-xs">
              <dt className="flex items-center gap-2 text-slate-500">
                <UserCog size={14} />
                Role
              </dt>
              <dd className="font-semibold capitalize text-slate-800">{user?.role || 'admin'}</dd>
            </div>
            <div className="flex items-center justify-between gap-3 text-xs">
              <dt className="flex items-center gap-2 text-slate-500">
                <CheckCircle2 size={14} />
                Account status
              </dt>
              <dd className="font-semibold text-emerald-700">
                {user?.is_active === false ? 'Inactive' : 'Active'}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-3 text-xs">
              <dt className="flex items-center gap-2 text-slate-500">
                <Calendar size={14} />
                Member since
              </dt>
              <dd className="font-semibold text-slate-800">{formatDate(user?.created_at)}</dd>
            </div>
            <div className="flex items-center justify-between gap-3 text-xs">
              <dt className="flex items-center gap-2 text-slate-500">
                <Mail size={14} />
                Email
              </dt>
              <dd className="max-w-[170px] truncate font-semibold text-slate-800">{user?.email}</dd>
            </div>
          </dl>
        </section>

        <div className="space-y-6 lg:col-span-2">
          <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center gap-2">
              <KeyRound size={18} className="text-blue-600" />
              <h2 className="text-base font-bold text-slate-900">Administrative capabilities</h2>
            </div>
            <p className="mt-1 text-xs text-slate-500">
              This account is authorised to perform the following portal operations.
            </p>
            <ul className="mt-4 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              {[
                'View all citizen grievances across departments',
                'Search, filter and sort the grievance register',
                'Inspect full complaint details and attachments',
                'Update grievance status with administrative remarks',
                'Append immutable audit entries to the status history',
                'Review dashboard statistics and category distribution',
              ].map((capability) => (
                <li
                  key={capability}
                  className="flex items-start gap-2 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2.5 text-xs text-slate-700"
                >
                  <CheckCircle2 size={14} className="mt-0.5 shrink-0 text-emerald-600" />
                  <span>{capability}</span>
                </li>
              ))}
            </ul>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center gap-2">
              <ShieldCheck size={18} className="text-blue-600" />
              <h2 className="text-base font-bold text-slate-900">Session security</h2>
            </div>
            <div className="mt-3 space-y-3 text-xs leading-relaxed text-slate-600">
              <p>
                Administrative sessions use the same JWT authentication as the citizen portal.
                Tokens are validated against the database on every request, and the account role is
                checked before any admin API is served.
              </p>
              <p>
                Signing out clears the local session token. If you believe this account has been
                compromised, ask the system owner to rotate the administrator password using the
                documented CLI procedure.
              </p>
            </div>

            <div className="mt-5 flex flex-wrap gap-2 border-t border-slate-100 pt-5">
              <Link
                to="/admin"
                className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-2 text-xs font-semibold text-white transition hover:bg-blue-700"
              >
                Return to dashboard
                <ArrowRight size={14} />
              </Link>
              <Link
                to="/services"
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3.5 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                <Building2 size={14} />
                Public service directory
              </Link>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};
