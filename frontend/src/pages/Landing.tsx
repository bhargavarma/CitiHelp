import React from 'react';
import { Link } from 'react-router-dom';
import {
  ShieldCheck,
  Search,
  MessageSquare,
  FileCheck2,
  Clock,
  ArrowRight
} from 'lucide-react';

export const Landing: React.FC = () => {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-900">
      {/* Navigation */}
      <nav className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="w-9 h-9 rounded-lg bg-blue-600 flex items-center justify-center font-bold text-white shadow">
              PG
            </div>
            <div className="hidden sm:block">
              <span className="font-bold text-lg text-slate-900">Public Grievance Portal</span>
              <span className="text-[10px] text-blue-600 font-semibold uppercase tracking-wider block">
                Gov Services & Redressal
              </span>
            </div>
          </div>
          <div className="flex items-center space-x-2 sm:space-x-3">
            <Link
              to="/services"
              className="hidden md:inline-block text-sm font-medium text-slate-600 hover:text-blue-600 px-3 py-2 transition"
            >
              Services
            </Link>
            <Link
              to="/login"
              className="text-sm font-medium text-slate-700 hover:text-slate-900 px-2 sm:px-3 py-2"
            >
              Log in
            </Link>
            <Link
              to="/login?role=admin"
              aria-label="Login as Admin"
              className="inline-flex items-center space-x-1.5 px-2.5 sm:px-3 py-2 text-sm font-semibold text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-100 hover:text-slate-900 transition"
            >
              <ShieldCheck size={15} className="shrink-0" />
              <span className="hidden sm:inline">Login as Admin</span>
              <span className="sm:hidden">Admin</span>
            </Link>
            <Link
              to="/register"
              className="px-3 sm:px-4 py-2 text-sm font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-sm transition"
            >
              <span className="hidden lg:inline">Register Citizen</span>
              <span className="lg:hidden">Register</span>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="bg-gradient-to-b from-blue-900 via-slate-900 to-slate-900 text-white py-20 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
        <div className="max-w-4xl mx-auto text-center relative z-10">
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-blue-500/20 text-blue-300 text-xs font-semibold mb-6 border border-blue-400/30">
            <ShieldCheck size={14} />
            <span>Problem Statement HACK-P438 &bull; Academic Prototype</span>
          </div>
          <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight leading-tight">
            Transparent, AI-Guided Public Grievance Redressal
          </h1>
          <p className="mt-5 text-lg text-slate-300 max-w-2xl mx-auto leading-relaxed">
            Empowering citizens to discover government services, consult our curated AI assistant,
            lodge complaints with instant reference tracking, and review official status updates.
          </p>

          <div className="mt-8 flex flex-col sm:flex-row justify-center gap-4">
            <Link
              to="/register"
              className="inline-flex items-center justify-center space-x-2 px-6 py-3.5 bg-blue-500 hover:bg-blue-400 text-white font-semibold rounded-xl shadow-lg transition"
            >
              <span>Get Started as Citizen</span>
              <ArrowRight size={18} />
            </Link>
            <Link
              to="/services"
              className="inline-flex items-center justify-center space-x-2 px-6 py-3.5 bg-slate-800 hover:bg-slate-700 text-slate-100 font-semibold rounded-xl border border-slate-700 transition"
            >
              <Search size={18} />
              <span>Browse 15+ Public Services</span>
            </Link>
          </div>
        </div>
      </section>

      {/* Feature Cards */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 -mt-10 relative z-20">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm hover:shadow-md transition">
            <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center mb-5">
              <FileCheck2 size={24} />
            </div>
            <h3 className="text-lg font-bold text-slate-900 mb-2">Verified Public Directory</h3>
            <p className="text-sm text-slate-600 leading-relaxed">
              Explore required documents, eligibility rules, and application workflows for over 15 municipal, transport, civil supplies, and revenue services.
            </p>
          </div>

          <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm hover:shadow-md transition">
            <div className="w-12 h-12 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center mb-5">
              <MessageSquare size={24} />
            </div>
            <h3 className="text-lg font-bold text-slate-900 mb-2">Google Gemini AI Assistant</h3>
            <p className="text-sm text-slate-600 leading-relaxed">
              Ask natural questions to get sourced, factual answers grounded strictly in verified civic documents and Citizen Charters.
            </p>
          </div>

          <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm hover:shadow-md transition">
            <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-5">
              <Clock size={24} />
            </div>
            <h3 className="text-lg font-bold text-slate-900 mb-2">End-to-End Tracking</h3>
            <p className="text-sm text-slate-600 leading-relaxed">
              Every complaint is stamped with a unique reference number. Status history preserves chronological inspection remarks by assigned officers.
            </p>
          </div>
        </div>
      </section>

      {/* Workflow Steps */}
      <section className="bg-white border-y border-slate-200 py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900">
              How the Civic Grievance Process Works
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              A transparent four-step pathway from citizen submission to verified administrative resolution.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div className="text-center">
              <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-700 font-bold flex items-center justify-center mx-auto mb-3">
                1
              </div>
              <h4 className="font-bold text-slate-900 mb-1">Citizen Registration</h4>
              <p className="text-xs text-slate-500">
                Create a secure citizen account with email verification and Argon2 encrypted credentials.
              </p>
            </div>

            <div className="text-center">
              <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-700 font-bold flex items-center justify-center mx-auto mb-3">
                2
              </div>
              <h4 className="font-bold text-slate-900 mb-1">Lodge Grievance</h4>
              <p className="text-xs text-slate-500">
                Specify department, location, issue description, and optional photographic proof.
              </p>
            </div>

            <div className="text-center">
              <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-700 font-bold flex items-center justify-center mx-auto mb-3">
                3
              </div>
              <h4 className="font-bold text-slate-900 mb-1">Officer Review</h4>
              <p className="text-xs text-slate-500">
                Assigned authorities inspect the issue, record status updates, and note field actions.
              </p>
            </div>

            <div className="text-center">
              <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-700 font-bold flex items-center justify-center mx-auto mb-3">
                4
              </div>
              <h4 className="font-bold text-slate-900 mb-1">Resolution & History</h4>
              <p className="text-xs text-slate-500">
                Issue marked Resolved with an immutable history audit trail visible on your dashboard.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="mt-auto bg-slate-900 text-slate-400 py-8 text-center text-xs">
        <div className="max-w-7xl mx-auto px-4">
          <p className="text-slate-300 font-semibold mb-1">
            Academic Hackathon Submission &bull; Problem ID: HACK-P438 &bull; Public Grievance AI Assistant
          </p>
          <p className="text-slate-500">
            Prototype Data Only. Grievances are recorded in our demonstrator PostgreSQL database.
          </p>
        </div>
      </footer>
    </div>
  );
};
