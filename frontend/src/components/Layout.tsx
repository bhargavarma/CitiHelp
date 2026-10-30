import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  LayoutDashboard,
  MessageSquare,
  PlusCircle,
  Clock,
  User as UserIcon,
  ShieldAlert,
  LogOut,
  Menu,
  X,
  Building2,
  BarChart3
} from 'lucide-react';

interface LayoutProps {
  children: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ children }) => {
  const { user, isAdmin, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const citizenNav = [
    { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
    { name: 'Service Directory', path: '/services', icon: Building2 },
    { name: 'AI Assistant', path: '/assistant', icon: MessageSquare },
    { name: 'Submit Grievance', path: '/grievances/new', icon: PlusCircle },
    { name: 'My Grievances', path: '/grievances', icon: Clock },
    { name: 'My Profile', path: '/profile', icon: UserIcon },
  ];

  const adminNav = [
    { name: 'Admin Dashboard', path: '/admin', icon: BarChart3 },
    { name: 'All Grievances', path: '/admin/grievances', icon: ShieldAlert },
    { name: 'Pending Queue', path: '/admin/grievances/pending', icon: Clock },
    { name: 'Service Directory', path: '/admin/services', icon: Building2 },
  ];

  const currentNav = isAdmin ? adminNav : citizenNav;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-900">
      {/* Top Banner Header */}
      <header className="bg-slate-900 text-white border-b border-slate-800 sticky top-0 z-30 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 text-slate-300 hover:text-white rounded-md"
            >
              {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
            </button>
            <Link to="/" className="flex items-center space-x-2">
              <div className="w-9 h-9 rounded-lg bg-blue-600 flex items-center justify-center font-bold text-lg text-white shadow">
                PG
              </div>
              <div>
                <span className="font-bold text-lg tracking-tight block leading-tight">
                  Public Grievance Portal
                </span>
                <span className="text-[10px] text-blue-300 uppercase tracking-widest block">
                  AI-Powered Civic Assistant (HACK-P438)
                </span>
              </div>
            </Link>
          </div>

          <div className="flex items-center space-x-4">
            {user ? (
              <div className="flex items-center space-x-3">
                <div className="hidden sm:block text-right">
                  <div className="text-sm font-semibold text-slate-100">{user.full_name}</div>
                  <div className="text-xs text-blue-400 font-medium uppercase tracking-wider">
                    {user.role === 'admin' ? 'Administrative Officer' : 'Citizen'}
                  </div>
                </div>
                <button
                  onClick={handleLogout}
                  className="flex items-center space-x-1.5 px-3 py-1.5 rounded-md bg-slate-800 hover:bg-red-900/60 text-slate-200 hover:text-white border border-slate-700 text-xs font-medium transition"
                  title="Sign out of portal"
                >
                  <LogOut size={14} />
                  <span className="hidden sm:inline">Logout</span>
                </button>
              </div>
            ) : (
              <div className="flex items-center space-x-2">
                <Link
                  to="/login"
                  className="px-3 py-1.5 text-xs font-semibold text-slate-200 hover:text-white"
                >
                  Login
                </Link>
                <Link
                  to="/register"
                  className="px-3 py-1.5 text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white rounded-md transition shadow-sm"
                >
                  Register
                </Link>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Container with Sidebar */}
      <div className="flex-1 flex max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 gap-6">
        {/* Desktop Sidebar */}
        {user && (
          <aside className="hidden md:flex flex-col w-64 shrink-0">
            <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm p-4 sticky top-24">
              <div className="px-3 py-2 text-xs font-bold text-slate-400 uppercase tracking-wider">
                {isAdmin ? 'Admin Console' : 'Citizen Navigation'}
              </div>
              <nav className="space-y-1 mt-1">
                {currentNav.map((item) => {
                  const Icon = item.icon;
                  const isActive = location.pathname === item.path;
                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      className={`flex items-center space-x-3 px-3 py-2.5 rounded-lg text-sm font-medium transition ${
                        isActive
                          ? 'bg-blue-50 text-blue-900 font-semibold border-l-4 border-blue-600 shadow-xs'
                          : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                      }`}
                    >
                      <Icon size={18} className={isActive ? 'text-blue-600' : 'text-slate-400'} />
                      <span>{item.name}</span>
                    </Link>
                  );
                })}
              </nav>

              <div className="mt-8 pt-4 border-t border-slate-100">
                <div className="bg-blue-50/60 rounded-lg p-3 text-xs text-blue-900">
                  <span className="font-semibold block mb-0.5">Prototype Disclaimer:</span>
                  All grievance and service records are part of an academic prototype (HACK-P438).
                </div>
              </div>
            </div>
          </aside>
        )}

        {/* Mobile Navigation Drawer */}
        {user && mobileMenuOpen && (
          <div className="fixed inset-0 z-40 md:hidden bg-slate-900/50 backdrop-blur-xs flex">
            <div className="w-64 bg-white h-full p-4 flex flex-col justify-between shadow-xl">
              <div>
                <div className="flex justify-between items-center mb-6 border-b border-slate-100 pb-3">
                  <span className="font-bold text-sm text-slate-900">Portal Menu</span>
                  <button onClick={() => setMobileMenuOpen(false)} className="p-1 text-slate-500">
                    <X size={20} />
                  </button>
                </div>
                <nav className="space-y-1">
                  {currentNav.map((item) => {
                    const Icon = item.icon;
                    const isActive = location.pathname === item.path;
                    return (
                      <Link
                        key={item.path}
                        to={item.path}
                        onClick={() => setMobileMenuOpen(false)}
                        className={`flex items-center space-x-3 px-3 py-2.5 rounded-lg text-sm font-medium transition ${
                          isActive
                            ? 'bg-blue-50 text-blue-900 font-semibold'
                            : 'text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        <Icon size={18} className={isActive ? 'text-blue-600' : 'text-slate-400'} />
                        <span>{item.name}</span>
                      </Link>
                    );
                  })}
                </nav>
              </div>

              <button
                onClick={handleLogout}
                className="flex items-center justify-center space-x-2 w-full py-2.5 rounded-lg bg-red-50 text-red-700 text-sm font-medium hover:bg-red-100 transition"
              >
                <LogOut size={16} />
                <span>Log Out</span>
              </button>
            </div>
            <div className="flex-1" onClick={() => setMobileMenuOpen(false)} />
          </div>
        )}

        {/* Main Content Pane */}
        <main className="flex-1 min-w-0">{children}</main>
      </div>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 mt-auto py-6 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4">
          <p className="font-medium text-slate-600">
            Public Grievance AI Assistant &bull; Academic Hackathon Submission &bull; Problem ID: HACK-P438
          </p>
          <p className="mt-1 text-slate-400">
            Designed with FastAPI, PostgreSQL, Google Gemini AI, React & Tailwind CSS. Synthetic & Sample Prototype Data.
          </p>
        </div>
      </footer>
    </div>
  );
};
