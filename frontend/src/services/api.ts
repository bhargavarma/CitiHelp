import axios from 'axios';
import type {
  User,
  Service,
  Grievance,
  GrievanceDetail,
  GrievanceHistory,
  GrievanceSummary,
  UploadedAttachment,
  ChatSession,
  ChatMessage,
  PaginatedResponse,
  AdminStats,
  AdminGrievanceFilters
} from '../types';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api/v1';

// Uploaded files are served from the backend root (e.g. /uploads/<uuid>.png),
// not from the versioned API prefix.
const API_ORIGIN = API_BASE_URL.replace(/\/api\/v1\/?$/, '');

export const getUploadUrl = (path?: string | null): string | undefined => {
  if (!path) return undefined;
  if (/^https?:\/\//i.test(path)) return path;
  return `${API_ORIGIN}${path.startsWith('/') ? path : `/${path}`}`;
};

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to attach JWT
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor for token expiration / 401 handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      // Clear token and let state know
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      if (window.location.pathname !== '/login' && window.location.pathname !== '/register' && window.location.pathname !== '/') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

// --- AUTH API ---
export const authApi = {
  register: async (data: { email: string; full_name: string; phone?: string; password: string }): Promise<User> => {
    const res = await api.post('/auth/register', data);
    return res.data;
  },
  login: async (data: { email: string; password: string }): Promise<{ access_token: string; token_type: string }> => {
    const res = await api.post('/auth/login', data);
    return res.data;
  },
  getCurrentUser: async (): Promise<User> => {
    const res = await api.get('/auth/me');
    return res.data;
  },
  logout: async () => {
    try {
      await api.post('/auth/logout');
    } finally {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
    }
  }
};

// --- SERVICES API ---
export const servicesApi = {
  getServices: async (params?: { page?: number; page_size?: number; search?: string; category?: string }): Promise<PaginatedResponse<Service>> => {
    const res = await api.get('/services', { params });
    return res.data;
  },
  getCategories: async (): Promise<string[]> => {
    const res = await api.get('/services/categories');
    return res.data.categories;
  },
  getServiceById: async (id: string): Promise<Service> => {
    const res = await api.get(`/services/${id}`);
    return res.data;
  }
};

// --- GRIEVANCES API ---
export const grievancesApi = {
  submit: async (data: { subject: string; description: string; category: string; location: string; attachment_path?: string }): Promise<Grievance> => {
    const res = await api.post('/grievances', data);
    return res.data;
  },
  getMyGrievances: async (params?: { page?: number; page_size?: number; status?: string; search?: string }): Promise<PaginatedResponse<Grievance>> => {
    const res = await api.get('/grievances', { params });
    return res.data;
  },
  getSummary: async (): Promise<GrievanceSummary> => {
    const res = await api.get('/grievances/summary');
    return res.data;
  },
  uploadAttachment: async (file: File): Promise<UploadedAttachment> => {
    const formData = new FormData();
    formData.append('file', file);
    const res = await api.post('/grievances/attachments', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data;
  },
  getCategories: async (): Promise<string[]> => {
    const res = await api.get('/grievances/categories');
    return res.data;
  },
  getById: async (id: string): Promise<GrievanceDetail> => {
    const res = await api.get(`/grievances/${id}`);
    return res.data;
  },
  trackByRef: async (ref: string): Promise<GrievanceDetail> => {
    const res = await api.get(`/grievances/track/${ref}`);
    return res.data;
  },
  getHistory: async (id: string): Promise<GrievanceHistory[]> => {
    const res = await api.get(`/grievances/${id}/history`);
    return res.data;
  }
};

// --- CHAT / AI API ---
export const chatApi = {
  createSession: async (title?: string): Promise<ChatSession> => {
    const res = await api.post('/chat/sessions', { title });
    return res.data;
  },
  getSessions: async (): Promise<ChatSession[]> => {
    const res = await api.get('/chat/sessions');
    return res.data;
  },
  getMessages: async (sessionId: string): Promise<ChatMessage[]> => {
    const res = await api.get(`/chat/sessions/${sessionId}/messages`);
    return res.data;
  },
  sendMessage: async (sessionId: string, message: string): Promise<ChatMessage> => {
    const res = await api.post(`/chat/sessions/${sessionId}/messages`, { message });
    return res.data;
  },
  directChat: async (message: string): Promise<ChatMessage> => {
    const res = await api.post('/chat', { message });
    return res.data;
  }
};

// --- ADMIN API ---
export const adminApi = {
  getStats: async (): Promise<AdminStats> => {
    const res = await api.get('/admin/stats');
    return res.data;
  },
  getGrievances: async (params?: AdminGrievanceFilters): Promise<PaginatedResponse<Grievance>> => {
    const res = await api.get('/admin/grievances', { params });
    return res.data;
  },
  getGrievanceById: async (id: string): Promise<GrievanceDetail> => {
    const res = await api.get(`/admin/grievances/${id}`);
    return res.data;
  },
  getGrievanceHistory: async (id: string): Promise<GrievanceHistory[]> => {
    const res = await api.get(`/admin/grievances/${id}/history`);
    return res.data;
  },
  updateStatus: async (id: string, data: { status: string; remarks?: string }): Promise<GrievanceDetail> => {
    const res = await api.patch(`/admin/grievances/${id}/status`, data);
    return res.data;
  }
};
