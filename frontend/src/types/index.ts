export interface User {
  id: string;
  email: string;
  full_name: string;
  phone?: string;
  role: 'citizen' | 'admin';
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Service {
  id: string;
  name: string;
  category: string;
  department: string;
  description: string;
  eligibility: string;
  required_documents: string[];
  procedure: string;
  source_url?: string;
  last_reviewed: string;
  is_verified: boolean;
  created_at: string;
  updated_at: string;
}

export interface Grievance {
  id: string;
  reference_number: string;
  subject: string;
  description: string;
  category: string;
  location: string;
  attachment_path?: string;
  current_status: string;
  created_at: string;
  updated_at: string;
  citizen_name?: string;
  citizen_email?: string;
}

export interface GrievanceHistory {
  id: string;
  old_status?: string;
  new_status: string;
  remarks?: string;
  changed_by_name?: string;
  created_at: string;
}

export interface GrievanceDetail extends Grievance {
  history: GrievanceHistory[];
}

export interface GrievanceSummary {
  total: number;
  submitted: number;
  under_review: number;
  in_progress: number;
  resolved: number;
  rejected: number;
}

export interface UploadedAttachment {
  path: string;
  original_filename: string;
  size: number;
}

export interface ChatSession {
  id: string;
  title?: string;
  created_at: string;
  updated_at: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  sources?: Array<{
    title: string;
    source_url?: string;
    last_reviewed?: string;
    relevance_type?: string;
  }>;
  created_at: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface CategoryDistribution {
  category: string;
  count: number;
}

export interface AdminActivityItem {
  id: string;
  grievance_id: string;
  reference_number: string;
  subject: string;
  old_status?: string;
  new_status: string;
  remarks?: string;
  changed_by_name?: string;
  created_at: string;
}

export interface AdminStats {
  total_grievances: number;
  submitted: number;
  under_review: number;
  in_progress: number;
  resolved: number;
  rejected: number;
  pending: number;
  category_distribution: CategoryDistribution[];
  recent_grievances: Grievance[];
  recent_updates: AdminActivityItem[];
}

export type AdminSortOption = 'newest' | 'oldest' | 'status';

export interface AdminGrievanceFilters {
  page?: number;
  page_size?: number;
  status?: string;
  category?: string;
  search?: string;
  date_from?: string;
  date_to?: string;
  sort?: AdminSortOption;
}
