import type { PaginationMeta, PaginationLinks } from './case';

export type AmbassadorStatus = 'pending' | 'approved' | 'rejected';

export interface AmbassadorUser {
  id: number;
  name: string;
  email: string;
  avatar_url: string | null;
}

export interface AmbassadorApplication {
  id: number;
  uuid: string;
  user: AmbassadorUser | null;
  name: string;
  email: string;
  phone: string;
  country: string | null;
  university: string | null;
  law_school: string | null;
  faculty: string | null;
  level: string | null;
  motivation: string;
  growth_plan: string;
  leadership_experience: string | null;
  social_handle: string | null;
  heard_from: string | null;
  status: AmbassadorStatus;
  status_label: string;
  reviewed_by: AmbassadorUser | null;
  reviewed_at: string | null;
  review_notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface AmbassadorListResponse {
  success: boolean;
  message: string;
  data: AmbassadorApplication[];
  pagination: PaginationMeta;
  links: PaginationLinks;
}

export interface AmbassadorListParams {
  status?: AmbassadorStatus;
  sort?: 'created_at' | 'status' | 'updated_at' | 'reviewed_at';
  direction?: 'asc' | 'desc';
  per_page?: number;
  page?: number;
}

export interface ApproveAmbassadorData {
  review_notes?: string;
}

export interface RejectAmbassadorData {
  review_notes: string;
}
