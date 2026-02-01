/**
 * Connection Request Types
 *
 * Types for lawyer connection requests matching the API response structure
 * from POST /api/lawyer-connection-requests
 */

export interface User {
  id: number;
  uuid: string;
  name: string;
  email: string;
  role: string;
  is_creator: boolean;
  is_verified: boolean;
  auth_provider: string;
  avatar_url: string | null;
  created_at: string;
}

export interface LawyerConnectionRequest {
  id: number;
  user: User;
  lawyer: User;
  message: string;
  status: 'pending' | 'accepted' | 'rejected';
  responded_at: string | null;
  created_at: string;
}

export interface CreateConnectionRequestPayload {
  lawyer_uuid: string;
  message?: string;
}
