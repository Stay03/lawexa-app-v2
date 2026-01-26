export type UserRole = 'superadmin' | 'admin' | 'researcher' | 'user' | 'guest' | 'bot';
export type AuthProvider = 'email' | 'google';

export type UserType = 'lawyer' | 'law_student' | 'other';
export type CommunicationStyle = 'co_worker' | 'study_guide' | 'assistant';

export interface UserProfile {
  gender?: string;
  date_of_birth?: string;
  profession?: string;
  law_school?: string;
  year_of_call?: number;
  bio?: string;
  // Onboarding fields
  user_type?: UserType;
  communication_style?: CommunicationStyle;
}

export interface AreaOfExpertise {
  id: number;
  name: string;
  slug: string;
}

export interface User {
  id: number;
  name: string;
  email: string | null;
  role: UserRole;
  is_creator: boolean | null;
  is_verified: boolean;
  auth_provider: AuthProvider;
  avatar_url: string | null;
  profile: UserProfile | null;
  areas_of_expertise?: AreaOfExpertise[];
  created_at: string;
}

export interface AuthResponse {
  user: User;
  token: string;
}

export interface Session {
  id: number;
  name: string;
  device: {
    name: string;
    type: 'desktop' | 'phone' | 'tablet';
    browser: string;
    platform: string;
    location: string;
    ip_address: string;
  };
  last_used_at: string;
  created_at: string;
  is_current: boolean;
}

// Form schemas
export interface LoginFormData {
  email: string;
  password: string;
}

export interface RegisterFormData {
  name: string;
  email: string;
  password: string;
  password_confirmation: string;
}

export interface ForgotPasswordFormData {
  email: string;
}

export interface ResetPasswordFormData {
  token: string;
  email: string;
  password: string;
  password_confirmation: string;
}
