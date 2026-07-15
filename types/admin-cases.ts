// Admin Cases - TypeScript Type Definitions
// Based on API documentation: docs/apiDocs/case-from-api-reference.md

import type { CaseTreatment, CitedCaseEdge } from '@/types/case';

/******************************************************************************
                                API Response Types
******************************************************************************/

export interface Country {
  id: number;
  name: string;
  code: string;
  abbreviation: string;
  slug: string;
  created_at: string;
  updated_at: string;
}

export interface Court {
  id: number;
  name: string;
  slug: string;
  abbreviation: string;
  country: Country;
  created_at: string;
  updated_at: string;
}

export interface Course {
  id: number;
  name: string;
  slug: string;
  created_at: string;
  updated_at: string;
  /** Present (non-null) when the course is soft-deleted; returned with `with_trashed`. */
  deleted_at?: string | null;
}

export interface Judge {
  id: number;
  name: string;
  slug: string;
  created_at: string;
  updated_at: string;
}

export interface CaseFile {
  id: number;
  url: string;
  original_name: string;
  mime_type: string;
  size: number;
  created_at: string;
}

export interface FullReport {
  id: number;
  case_id: number;
  full_text: string;
  created_at: string;
  updated_at: string;
}

export interface Creator {
  id: number;
  name: string;
}

/**
 * Lightweight case summary used in lists and relationships
 */
export interface CaseSummary {
  id: number;
  title: string;
  display_title: string;
  slug: string;
  court: string | Court | null; // Can be abbreviation string or Court object
  judgment_date: string | null;
  citation: string | null;
  is_bookmarked: boolean;
  bookmarks_count: number;
  views_count: number;
}

/**
 * A reverse citation (cited_by) in admin responses: a case summary plus how the
 * citing case treated this one.
 */
export interface CitedByCaseSummary extends CaseSummary {
  treatment: CaseTreatment | null;
}

/**
 * Full case detail including all relationships
 */
export interface CaseDetail {
  id: number;
  title: string;
  display_title: string;
  slug: string;
  course: Course | null;
  topic: string | null;
  tags: string[] | null;
  principles: string | null;
  level: string | null;
  court: Court | null;
  judgment_date: string | null;
  country: Country | null;
  citation: string | null;
  judges: Judge[];
  similar_cases: CaseSummary[];
  cited_cases: CitedCaseEdge[];
  cited_by: CitedByCaseSummary[];
  cited_by_count: number;
  creator: Creator | null;
  has_full_report: boolean;
  files: CaseFile[];
  is_bookmarked: boolean;
  bookmarks_count: number;
  views_count: number;
  body: string | null;
  full_report: FullReport | null;
  limit_exceeded: boolean;
  limit_message?: string;
  created_at: string;
  updated_at: string;
}

/******************************************************************************
                                Form Data Types
******************************************************************************/

/**
 * Form data structure for creating/editing cases
 */
export interface CaseFormData {
  // Basic Information
  title: string;
  body: string;
  course_id: number | null;
  topic: string | null;
  tags: string[];
  level: string | null;

  // Legal Information
  principles: string | null;

  // Court Information
  country_id: number | null;
  court_id: number | null;
  judgment_date: string | null;
  judge_ids: number[];

  // Relationships
  similar_case_ids: number[];
  cited_case_ids: number[];

  // Full Report
  full_report: string | null;
}

/**
 * Data sent to API when creating a case
 */
export interface CreateCaseData {
  title: string;
  body: string;
  course_id?: number;
  topic?: string;
  tags?: string[];
  level?: string;
  principles?: string;
  country_id?: number;
  court_id?: number;
  judgment_date?: string;
  judge_ids?: number[];
  similar_case_ids?: number[];
  cited_case_ids?: number[];
  full_report?: string;
  slug?: string;
  citation?: string;
}

/**
 * Data sent to API when updating a case (all fields optional)
 */
export interface UpdateCaseData extends Partial<CreateCaseData> {}

/******************************************************************************
                            Quick-Add Form Data Types
******************************************************************************/

export interface CreateCountryData {
  name: string;
  code: string;
  abbreviation?: string;
  slug?: string;
}

export interface CreateCourtData {
  name: string;
  country_id: number;
  abbreviation?: string;
  slug?: string;
}

export interface CreateCourseData {
  name: string;
  slug?: string;
}

export interface CreateJudgeData {
  name: string;
  slug?: string;
}

/******************************************************************************
                            Query Parameters Types
******************************************************************************/

export interface AdminCasesParams {
  page?: number;
  per_page?: number;
  search?: string;
  course?: string | number;
  country?: string | number;
  court?: string | number;
  judge?: string | number;
  topic?: string;
  level?: string;
  tags?: string | string[];
  date_from?: string;
  date_to?: string;
  sort?: string;
  order?: 'asc' | 'desc';
  with_trashed?: boolean;
}

export interface CountriesParams {
  search?: string;
  sort?: string;
  order?: 'asc' | 'desc';
  per_page?: number;
  page?: number;
}

export interface CourtsParams {
  search?: string;
  country?: string | number;
  sort?: string;
  order?: 'asc' | 'desc';
  per_page?: number;
  page?: number;
}

export interface CoursesParams {
  search?: string;
  sort?: string;
  order?: 'asc' | 'desc';
  per_page?: number;
  page?: number;
  with_trashed?: boolean;
}

export interface JudgesParams {
  search?: string;
  sort?: string;
  order?: 'asc' | 'desc';
  per_page?: number;
  page?: number;
}

/******************************************************************************
                            API Response Wrappers
******************************************************************************/

export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
  errors?: Record<string, string[]> | null;
}

export interface PaginatedResponse<T> {
  success: boolean;
  message: string;
  data: T[];
  pagination: {
    current_page: number;
    per_page: number;
    total: number;
    last_page: number;
    from: number;
    to: number;
  };
  links: {
    first: string;
    last: string;
    prev: string | null;
    next: string | null;
  };
}

/******************************************************************************
                            Component Props Types
******************************************************************************/

export interface QuickAddDialogProps<T> {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: (entity: T) => void;
}

export interface CountryQuickAddProps extends QuickAddDialogProps<Country> {}

export interface CourtQuickAddProps extends QuickAddDialogProps<Court> {
  preSelectedCountryId?: number | null;
}

export interface CourseQuickAddProps extends QuickAddDialogProps<Course> {}

/******************************************************************************
                            File Upload Types
******************************************************************************/

export const ACCEPTED_FILE_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
  'text/rtf',
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
] as const;

export const ACCEPTED_FILE_EXTENSIONS = [
  '.pdf',
  '.doc',
  '.docx',
  '.txt',
  '.rtf',
  '.jpg',
  '.jpeg',
  '.png',
  '.gif',
  '.webp',
] as const;

export const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB
export const MAX_FILES_PER_CASE = 10;

export interface FileValidationError {
  file: File;
  error: string;
}
