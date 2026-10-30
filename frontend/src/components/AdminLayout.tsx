import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  Building2,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  Clock3,
  LayoutDashboard,
  LogOut,
  Menu,
  ShieldCheck,
  UserCog,
  X,
  XCircle,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface AdminLayoutProps {
  children: React.ReactNode;
}

interface NavItem {
  name: string;
  path: string;
  icon: React.ComponentType<{ size?: number | string; className?: string }>;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    label: 'Overview',
    items: [{ name: 'Dashboard', path: '/admin', icon: LayoutDashboard }],
  },
  {
    label: 'Grievance Management',
    items: [
      { name: 'All Grievances', path: '/admin/grievances', icon: ClipboardList },
      { name: 'Pending Queue', path: '/admin/grievances/pending', icon: Clock3 },
      { name: 'Resolved', path: '/admin/grievances/resolved', icon: CheckCircle2 },
      { name: 'Rejected', path: '/admin/grievances/rejected', icon: XCircle },
    ],
  },
  {
    label: 'Public Services',
    items: [{ name: 'Service Directory', path: '/admin/services', icon: Building2 }],
  },
  {
    label: 'Account',
    items: [{ name: 'Admin Profile', path: '/admin/profile', icon: UserCog }],
  },
];

const PRESET_PATHS = new Set([
  '/admin/grievances/pending',
  '/admin/grievances/resolved',
  '/admin/grievances/rejected',
]);

function isNavItemActive(pathname: string, item: NavItem): boolean {
  if (item.path === '/admin') return pathname === '/admin';
  if (item.path === '/admin/grievances') {
    return (
      pathname === '/admin/grievances' ||
      (pathname.startsWith('/admin/grievances/') && !PRESET_PATHS.has(pathname))
    );
  }
  if (item.path.startsWith('/admin/grievances/')) return pathname === item.path;
  return pathname === item.path || pathname.startsWith(`${item.path}/`);
}

function currentSection(pathname: string): string {
  const match = NAV_GROUPS.flatMap((group) => group.items).find((item) =>
    isNavItemActive(pathname, item)
  );
  if (match) return match.name;
  if (pathname.startsWith('/admin/grievances/')) return 'Grievance Detail';
  return 'Administration';
}

export const AdminLayout: React.FC<AdminLayoutProps> = ({ children }) => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  const renderNavigation = (onNavigate?: () => void) => (
    <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-4">
      {NAV_GROUPS.map((group) => (
        <div key={group.label}>
          <p className="px-3 pb-2 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">
            {group.label}
          </p>
          <div className="space-y-1">
            {group.items.map((item) => {
              const Icon = item.icon;
              const active = isNavItemActive(location.pathname, item);
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={onNavigate}
                  className={`group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
                    active
                      ? 'bg-blue-600 text-white shadow-sm shadow-blue-950/30'
                      : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                  }`}
                  aria-current={active ? 'page' : undefined}
                >
                  <Icon
                    size={17}
                    className={active ? 'text-white' : 'text-slate-400 group-hover:text-blue-300'}
                  />
                  <span>{item.name}</span>
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );

  const sidebarFooter = (
    <div className="border-t border-slate-800 p-4">
      <div className="mb-3 flex items-center gap-3 rounded-lg bg-slate-800/70 p-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-600 text-sm font-bold text-white">
          {(user?.full_name || 'A').charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-white">{user?.full_name || 'Administrator'}</p>
          <p className="truncate text-[11px] text-slate-400">{user?.email || 'admin'}</p>
        </div>
      </div>
      <button
        type="button"
        onClick={handleLogout}
        className="flex w-full items-center justify-center gap-2 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2.5 text-sm font-semibold text-slate-200 transition hover:border-rose-800 hover:bg-rose-950/50 hover:text-white"
      >
        <LogOut size={16} />
        <span>Sign Out</span>
      </button>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col bg-slate-900 lg:flex">
        <Link to="/admin" className="flex items-center gap-3 border-b border-slate-800 px-5 py-5">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 shadow-lg shadow-blue-950/40">
            <ShieldCheck size={21} className="text-white" />
          </div>
          <div>
            <p className="text-sm font-bold leading-tight text-white">Grievance Portal</p>
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-blue-300">
              Admin Console
            </p>
          </div>
        </Link>
        {renderNavigation()}
        {sidebarFooter}
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div className="flex h-full w-72 flex-col bg-slate-900">
            <div className="flex items-center justify-between border-b border-slate-800 px-4 py-4">
              <Link to="/admin" className="flex items-center gap-2" onClick={() => setMobileOpen(false)}>
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-600">
                  <ShieldCheck size={19} className="text-white" />
                </div>
                <div>
                  <p className="text-sm font-bold text-white">Grievance Portal</p>
                  <p className="text-[10px] uppercase tracking-widest text-blue-300">Admin Console</p>
                </div>
              </Link>
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white"
                aria-label="Close navigation"
              >
                <X size={20} />
              </button>
            </div>
            {renderNavigation(() => setMobileOpen(false))}
            {sidebarFooter}
          </div>
          <button
            type="button"
            className="flex-1 bg-slate-950/60 backdrop-blur-[2px]"
            onClick={() => setMobileOpen(false)}
            aria-label="Close navigation overlay"
          />
        </div>
      )}

      <div className="lg:pl-64">
        {/* Top bar */}
        <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
          <div className="flex h-16 items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
            <div className="flex min-w-0 items-center gap-3">
              <button
                type="button"
                onClick={() => setMobileOpen(true)}
                className="rounded-lg border border-slate-200 p-2 text-slate-600 transition hover:bg-slate-50 lg:hidden"
                aria-label="Open navigation"
              >
                <Menu size={20} />
              </button>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 text-[11px] font-medium text-slate-400">
                  <Link to="/admin" className="transition hover:text-blue-600">
                    Admin
                  </Link>
                  <ChevronRight size={12} />
                  <span className="truncate text-slate-500">{currentSection(location.pathname)}</span>
                </div>
                <p className="truncate text-sm font-semibold text-slate-800">
                  Public Grievance Redressal System
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 sm:gap-3">
              <Link
                to="/services"
                className="hidden rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 sm:inline-flex"
              >
                Public Directory
              </Link>
              <div className="hidden text-right sm:block">
                <p className="max-w-[180px] truncate text-sm font-semibold text-slate-800">
                  {user?.full_name || 'Administrator'}
                </p>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-blue-600">
                  Administrative Officer
                </p>
              </div>
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-900 text-sm font-bold text-white">
                {(user?.full_name || 'A').charAt(0).toUpperCase()}
              </div>
            </div>
          </div>
        </header>

        <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">{children}</main>

        <footer className="mx-auto w-full max-w-7xl px-4 pb-6 text-center text-[11px] text-slate-400 sm:px-6 lg:px-8">
          Public Grievance AI Assistant &bull; HACK-P438 &bull; Administrative Portal
        </footer>
      </div>
    </div>
  );
};
