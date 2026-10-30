import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { servicesApi } from '../../services/api';
import type { Service } from '../../types';
import { Search, Filter, Building2, ArrowRight, CheckCircle2, ChevronLeft, ChevronRight } from 'lucide-react';

export const ServiceDirectory: React.FC = () => {
  const [services, setServices] = useState<Service[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [page, setPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [totalServices, setTotalServices] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const cats = await servicesApi.getCategories();
        setCategories(cats);
      } catch (err) {
        console.error('Failed to load categories', err);
      }
    };
    fetchCategories();
  }, []);

  useEffect(() => {
    const fetchServices = async () => {
      setIsLoading(true);
      try {
        const res = await servicesApi.getServices({
          page,
          page_size: 9,
          search: searchQuery.trim() || undefined,
          category: selectedCategory || undefined,
        });
        setServices(res.items);
        setTotalPages(res.total_pages);
        setTotalServices(res.total);
      } catch (err) {
        console.error('Failed to load services', err);
      } finally {
        setIsLoading(false);
      }
    };

    const timer = setTimeout(() => {
      fetchServices();
    }, 200);

    return () => clearTimeout(timer);
  }, [page, searchQuery, selectedCategory]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
          Public Service Directory
        </h1>
        <p className="text-sm text-slate-600 mt-1">
          Explore essential civic, revenue, transport, and municipal services across government departments.
        </p>
      </div>

      {/* Search & Filter Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row gap-3 items-center justify-between">
        <div className="relative w-full md:w-96">
          <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setPage(1);
            }}
            placeholder="Search service by name or keyword..."
            className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition"
          />
        </div>

        <div className="flex items-center space-x-2 w-full md:w-auto">
          <Filter size={18} className="text-slate-400 shrink-0 hidden sm:block" />
          <select
            value={selectedCategory}
            onChange={(e) => {
              setSelectedCategory(e.target.value);
              setPage(1);
            }}
            className="w-full md:w-64 px-3 py-2.5 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent bg-white transition"
          >
            <option value="">All Service Categories</option>
            {categories.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Services Grid */}
      {isLoading ? (
        <div className="py-16 text-center text-slate-500 text-sm">
          Searching public service directory...
        </div>
      ) : services.length === 0 ? (
        <div className="bg-white rounded-xl p-12 text-center border border-slate-200">
          <Building2 size={36} className="text-slate-400 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-800">No public services matched</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            Try adjusting your search query or selecting a different service category.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {services.map((svc) => (
            <div
              key={svc.id}
              className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-xs hover:shadow-md transition flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="text-[11px] font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                    {svc.category}
                  </span>
                  {svc.is_verified ? (
                    <span className="inline-flex items-center text-[11px] text-emerald-600 font-medium">
                      <CheckCircle2 size={12} className="mr-1" />
                      Verified
                    </span>
                  ) : (
                    <span className="text-[11px] text-amber-600 font-medium bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                      Sample Data
                    </span>
                  )}
                </div>

                <h3 className="text-base font-bold text-slate-900 leading-snug line-clamp-1">
                  {svc.name}
                </h3>
                <p className="text-xs text-slate-500 font-medium mt-1 mb-2">
                  {svc.department}
                </p>
                <p className="text-xs text-slate-600 line-clamp-3 leading-relaxed mb-4">
                  {svc.description}
                </p>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                <span className="text-[11px] text-slate-400">
                  Reviewed: {svc.last_reviewed}
                </span>
                <Link
                  to={`/services/${svc.id}`}
                  className="inline-flex items-center space-x-1 text-xs font-semibold text-blue-600 hover:text-blue-700 transition"
                >
                  <span>View Details</span>
                  <ArrowRight size={14} />
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between bg-white px-4 py-3 rounded-xl border border-slate-200/80">
          <div className="text-xs text-slate-500">
            Showing Page <span className="font-semibold text-slate-800">{page}</span> of{' '}
            <span className="font-semibold text-slate-800">{totalPages}</span> ({totalServices} services)
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setPage((p) => Math.max(p - 1, 1))}
              disabled={page === 1}
              className="p-1.5 rounded-lg border border-slate-300 text-slate-600 disabled:opacity-30 hover:bg-slate-50 transition"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              onClick={() => setPage((p) => Math.min(p + 1, totalPages))}
              disabled={page === totalPages}
              className="p-1.5 rounded-lg border border-slate-300 text-slate-600 disabled:opacity-30 hover:bg-slate-50 transition"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
