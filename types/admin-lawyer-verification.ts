/**
 * Admin Lawyer Verification type definitions
 * Used by the admin panel for reviewing, approving, and rejecting lawyer verification submissions.
 */

// ============================================================
// Sub-Objects
// ============================================================

/** Minimal user summary embedded in list and detail items */
export interface LawyerVerificationUser {
  id: number;
  name: string;
  email: string;
  avatar_url: string | null;
}

/** Admin who performed the verification action (null until approved/rejected) */
export interface LawyerVerifier {
  id: number;
  name: string;
  email: string;
  avatar_url: string | null;
}

/** A single uploaded verification document with a temporary signed S3 URL */
export interface AdminLawyerDocument {
  id: number;
  url: string;
  original_name: string;
  mime_type: string;
  size: number;
  created_at: string;
}

// ============================================================
// Status
// ============================================================

/** Filter status for the list endpoint */
export type LawyerVerificationStatus = 'pending' | 'approved' | 'rejected' | 'all';

// ============================================================
// List Item (GET /api/admin/lawyer-verifications)
// ============================================================

export interface AdminLawyerVerificationListItem {
  id: number;
  user_id: number;
  user: LawyerVerificationUser;
  is_verified: boolean;
  verified_at: string | null;
  verification_submitted_at: string | null;
  documents: AdminLawyerDocument[];
  verifier: LawyerVerifier | null;
  created_at: string;
  updated_at: string;
}

// ============================================================
// Detail Item (GET /api/admin/lawyer-verifications/{id})
// ============================================================

export interface AdminLawyerVerificationDetail extends AdminLawyerVerificationListItem {
  verification_notes?: string | null;
  rejection_reason?: string | null;
}

// ============================================================
// Stats (GET /api/admin/lawyer-verifications/stats)
// ============================================================

export interface LawyerVerificationStats {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
}

// ============================================================
// Query Params
// ============================================================

export interface AdminLawyerVerificationsParams {
  status?: LawyerVerificationStatus;
  per_page?: number;
  page?: number;
}

// ============================================================
// API Response Shapes
// ============================================================

/** The nested paginated data shape from the backend */
export interface LawyerVerificationPaginatedData {
  data: AdminLawyerVerificationListItem[];
  current_page: number;
  per_page: number;
  total: number;
  last_page: number;
}

export interface LawyerVerificationsListResponse {
  success: boolean;
  message: string;
  data: LawyerVerificationPaginatedData;
}

export interface LawyerVerificationDetailResponse {
  success: boolean;
  message: string;
  data: AdminLawyerVerificationDetail;
}

export interface LawyerVerificationStatsResponse {
  success: boolean;
  message: string;
  data: LawyerVerificationStats;
}

// ============================================================
// Mutation Payloads
// ============================================================

export interface ApproveVerificationData {
  verification_notes?: string;
}

export interface RejectVerificationData {
  rejection_reason: string;
}
