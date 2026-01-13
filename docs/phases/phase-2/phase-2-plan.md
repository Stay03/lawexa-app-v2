# Lawexa - Implementation Plan

## Project Structure

```
lawexa-app/
├── app/                          # Next.js App Router
│   ├── (auth)/                   # Auth group (no layout)
│   │   ├── login/
│   │   │   └── page.tsx
│   │   ├── register/
│   │   │   └── page.tsx
│   │   ├── forgot-password/
│   │   │   └── page.tsx
│   │   ├── reset-password/
│   │   │   └── page.tsx
│   │   ├── verify-email/
│   │   │   └── [id]/[hash]/
│   │   │       └── page.tsx
│   │   └── auth/
│   │       └── google/
│   │           └── callback/
│   │               └── page.tsx  # Google OAuth callback handler
│   ├── (main)/                   # Main app with sidebar layout
│   │   ├── layout.tsx            # Sidebar layout
│   │   ├── page.tsx              # Welcome/Home page
│   │   ├── cases/
│   │   │   ├── page.tsx          # Case list
│   │   │   └── [slug]/
│   │   │       └── page.tsx      # Case detail
│   │   ├── notes/
│   │   │   ├── page.tsx          # Notes library
│   │   │   └── [slug]/
│   │   │       └── page.tsx      # Note detail
│   │   ├── bookmarks/
│   │   │   └── page.tsx
│   │   ├── dashboard/
│   │   │   └── page.tsx          # User dashboard
│   │   ├── creators/
│   │   │   └── page.tsx          # Creators dashboard
│   │   ├── settings/
│   │   │   ├── page.tsx          # Redirects to /settings/general
│   │   │   ├── general/
│   │   │   │   └── page.tsx
│   │   │   ├── account/
│   │   │   │   └── page.tsx
│   │   │   ├── privacy/
│   │   │   │   └── page.tsx
│   │   │   └── billing/
│   │   │       └── page.tsx
│   │   └── admin/
│   │       ├── page.tsx          # Admin dashboard
│   │       └── [...slug]/
│   │           └── page.tsx      # Admin sub-pages
│   ├── pricing/
│   │   └── page.tsx              # Pricing page (public)
│   ├── layout.tsx                # Root layout
│   ├── globals.css
│   └── not-found.tsx
├── components/
│   ├── ui/                       # shadcn/ui components
│   ├── common/                   # Shared components
│   │   ├── Logo.tsx
│   │   ├── ThemeToggle.tsx
│   │   ├── UserAvatar.tsx
│   │   ├── LoadingSkeleton.tsx
│   │   ├── EmptyState.tsx
│   │   ├── ErrorState.tsx
│   │   └── ConfirmDialog.tsx
│   ├── layout/                   # Layout components
│   │   ├── Sidebar/
│   │   │   ├── index.tsx
│   │   │   ├── SidebarNav.tsx
│   │   │   ├── SidebarUser.tsx
│   │   │   └── SidebarChatSessions.tsx
│   │   ├── Header.tsx
│   │   ├── MobileNav.tsx
│   │   └── PageHeader.tsx
│   ├── auth/                     # Auth components
│   │   ├── LoginForm.tsx
│   │   ├── RegisterForm.tsx
│   │   ├── ForgotPasswordForm.tsx
│   │   ├── ResetPasswordForm.tsx
│   │   ├── GoogleAuthButton.tsx
│   │   ├── AuthModal.tsx
│   │   └── GuestPrompt.tsx
│   ├── cases/                    # Case components
│   │   ├── CaseCard.tsx
│   │   ├── CaseList.tsx
│   │   ├── CaseDetail.tsx
│   │   ├── CaseFilters.tsx
│   │   └── CaseSearch.tsx
│   ├── notes/                    # Note components
│   │   ├── NoteCard.tsx
│   │   ├── NoteList.tsx
│   │   ├── NoteDetail.tsx
│   │   ├── NoteEditor.tsx
│   │   └── NoteTabs.tsx
│   └── subscription/             # Subscription components
│       ├── PricingCard.tsx
│       ├── PricingTable.tsx
│       ├── UpgradeModal.tsx
│       └── LimitReachedModal.tsx
├── lib/
│   ├── api/                      # API client
│   │   ├── client.ts             # Axios instance
│   │   ├── auth.ts               # Auth API functions
│   │   ├── cases.ts              # Cases API functions
│   │   ├── notes.ts              # Notes API functions
│   │   ├── users.ts              # Users API functions
│   │   └── subscriptions.ts      # Subscriptions API functions
│   ├── hooks/                    # Custom hooks
│   │   ├── useAuth.ts
│   │   ├── useUser.ts
│   │   ├── useGreeting.ts
│   │   ├── useFingerprint.ts
│   │   ├── useMediaQuery.ts
│   │   └── useLocalStorage.ts
│   ├── stores/                   # Zustand stores
│   │   ├── authStore.ts
│   │   ├── themeStore.ts
│   │   └── uiStore.ts
│   ├── utils/                    # Utility functions
│   │   ├── cn.ts                 # Class name helper
│   │   ├── format.ts             # Date, currency formatters
│   │   ├── validation.ts         # Zod schemas
│   │   └── api-error.ts          # API error extraction utility
│   └── constants/                # Constants
│       ├── routes.ts
│       ├── greetings.ts
│       └── config.ts
├── types/                        # TypeScript types
│   ├── api.ts                    # API response types
│   ├── auth.ts                   # Auth types
│   ├── user.ts                   # User types
│   ├── case.ts                   # Case types
│   ├── note.ts                   # Note types
│   └── subscription.ts           # Subscription types
├── styles/                       # Global styles
│   ├── colors.ts                 # Color tokens
│   └── theme.ts                  # Theme configuration
├── providers/                    # React providers
│   ├── QueryProvider.tsx         # TanStack Query
│   ├── ThemeProvider.tsx         # Dark/light theme
│   └── AuthProvider.tsx          # Auth context
└── public/
    └── images/
```

---

## Phase 1: Project Setup

### 1.1 Install Dependencies

```bash
# State management
npm install @tanstack/react-query zustand

# Forms
npm install react-hook-form @hookform/resolvers zod

# HTTP client
npm install axios

# Utilities
npm install clsx tailwind-merge
npm install date-fns
npm install @fingerprintjs/fingerprintjs

# Icons (if not using lucide from shadcn)
npm install lucide-react

# Dev dependencies
npm install -D @tanstack/react-query-devtools
```

### 1.2 Install shadcn/ui Components

```bash
# Initialize shadcn/ui
npx shadcn@latest init

# Install auth-related components
npx shadcn@latest add button input form card label separator toast
```

### 1.3 Configure Project Structure

Create the folder structure as outlined above.

### 1.4 Setup API Client

**`lib/api/client.ts`**
```typescript
import axios from 'axios';
import { useAuthStore } from '@/lib/stores/authStore';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export const apiClient = axios.create({
  baseURL: `${API_BASE_URL}/api`,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
});

// Request interceptor - add auth token from Zustand store
apiClient.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor - handle errors with smart redirect
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Check if we're already on an auth page to prevent redirect loops
      const isAuthPage =
        window.location.pathname.startsWith('/login') ||
        window.location.pathname.startsWith('/register') ||
        window.location.pathname.startsWith('/forgot-password') ||
        window.location.pathname.startsWith('/reset-password');

      // Check if this is a silent auth check (don't redirect)
      const isSilentCheck = error.config?.headers?.['X-Silent-Auth'];

      if (!isAuthPage && !isSilentCheck) {
        useAuthStore.getState().clearAuth();
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);
```

### 1.5 Setup API Error Utility

**`lib/utils/api-error.ts`**
```typescript
import { AxiosError } from 'axios';
import type { ApiResponse } from '@/types/api';

export interface ApiError {
  message: string;
  errors: Record<string, string[]> | null;
  status: number;
}

/**
 * Extract structured error information from API responses.
 */
export function extractApiError(error: unknown): ApiError {
  if (error instanceof AxiosError && error.response?.data) {
    const data = error.response.data as ApiResponse<unknown>;
    return {
      message: data.message || 'An error occurred',
      errors: data.errors || null,
      status: error.response.status,
    };
  }
  return {
    message: 'Network error. Please try again.',
    errors: null,
    status: 0,
  };
}

/**
 * Get the first error message for a specific field.
 */
export function getFieldError(
  errors: Record<string, string[]> | null,
  field: string
): string | undefined {
  return errors?.[field]?.[0];
}
```

### 1.6 Setup TanStack Query Provider

**`providers/QueryProvider.tsx`**
```typescript
'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { useState } from 'react';

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000, // 1 minute
            retry: 1,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  );
}
```

### 1.7 Setup Theme Store

**`lib/stores/themeStore.ts`**
```typescript
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type Theme = 'light' | 'dark';

interface ThemeStore {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

export const useThemeStore = create<ThemeStore>()(
  persist(
    (set) => ({
      theme: 'dark',
      setTheme: (theme) => set({ theme }),
      toggleTheme: () =>
        set((state) => ({ theme: state.theme === 'dark' ? 'light' : 'dark' })),
    }),
    { name: 'lawexa-theme' }
  )
);
```

### 1.8 Setup Base Types

**`types/api.ts`**
```typescript
export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T | null;
  errors?: Record<string, string[]> | null;
}

export interface PaginatedResponse<T> {
  success: boolean;
  message: string;
  data: {
    items: T[];
    meta: {
      current_page: number;
      last_page: number;
      per_page: number;
      total: number;
    };
  };
}
```

### 1.9 Setup Color Tokens

**`styles/colors.ts`**
```typescript
const Base = {
  Gold: {
    Light: '#D4A853',
    Default: '#C9A227',
    Dark: '#A68523',
  },
  Brown: {
    Lightest: '#3D3A35',
    Lighter: '#2D2A25',
    Light: '#252219',
    Default: '#1C1A15',
    Dark: '#141210',
  },
  Gray: {
    50: '#fafafa',
    100: '#f4f4f5',
    200: '#e4e4e7',
    300: '#d4d4d8',
    400: '#a1a1aa',
    500: '#71717a',
    600: '#52525b',
    700: '#3f3f46',
    800: '#27272a',
    900: '#18181b',
  },
  White: '#ffffff',
  Black: '#000000',
};

export const Colors = {
  // Dark theme
  dark: {
    background: {
      primary: Base.Brown.Default,
      secondary: Base.Brown.Light,
      tertiary: Base.Brown.Lighter,
    },
    foreground: {
      primary: Base.White,
      secondary: Base.Gray[400],
      muted: Base.Gray[500],
    },
    accent: {
      primary: Base.Gold.Default,
      hover: Base.Gold.Light,
    },
    border: Base.Brown.Lightest,
  },
  // Light theme
  light: {
    background: {
      primary: Base.White,
      secondary: Base.Gray[50],
      tertiary: Base.Gray[100],
    },
    foreground: {
      primary: Base.Gray[900],
      secondary: Base.Gray[600],
      muted: Base.Gray[500],
    },
    accent: {
      primary: Base.Gold.Default,
      hover: Base.Gold.Dark,
    },
    border: Base.Gray[200],
  },
};
```

---

## Phase 2: Authentication

### 2.1 Auth Types

**`types/auth.ts`**
```typescript
export type UserRole = 'superadmin' | 'admin' | 'researcher' | 'user' | 'guest' | 'bot';
export type AuthProvider = 'email' | 'google';

export interface UserProfile {
  gender?: string;
  date_of_birth?: string;
  profession?: string;
  law_school?: string;
  year_of_call?: number;
  bio?: string;
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
```

### 2.2 Auth Validation Schemas

**`lib/utils/validation.ts`**
```typescript
import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
});

export const registerSchema = z
  .object({
    name: z.string().min(1, 'Name is required').max(255),
    email: z.string().email('Please enter a valid email address'),
    password: z.string().min(8, 'Password must be at least 8 characters'),
    password_confirmation: z.string(),
  })
  .refine((data) => data.password === data.password_confirmation, {
    message: 'Passwords do not match',
    path: ['password_confirmation'],
  });

export const forgotPasswordSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
});

export const resetPasswordSchema = z
  .object({
    token: z.string(),
    email: z.string().email(),
    password: z.string().min(8, 'Password must be at least 8 characters'),
    password_confirmation: z.string(),
  })
  .refine((data) => data.password === data.password_confirmation, {
    message: 'Passwords do not match',
    path: ['password_confirmation'],
  });
```

### 2.3 Auth API Functions

**`lib/api/auth.ts`**
```typescript
import { apiClient } from './client';
import type { ApiResponse } from '@/types/api';
import type { AuthResponse, User, Session } from '@/types/auth';

export const authApi = {
  // Public endpoints
  register: async (data: {
    name: string;
    email: string;
    password: string;
    password_confirmation: string;
  }) => {
    const response = await apiClient.post<ApiResponse<AuthResponse>>(
      '/auth/register',
      data
    );
    return response.data;
  },

  login: async (data: { email: string; password: string }) => {
    const response = await apiClient.post<ApiResponse<AuthResponse>>(
      '/auth/login',
      data
    );
    return response.data;
  },

  googleAuthUrl: async () => {
    const response = await apiClient.get<ApiResponse<{ url: string }>>(
      '/auth/google'
    );
    return response.data;
  },

  googleCallback: async (accessToken: string) => {
    const response = await apiClient.post<ApiResponse<AuthResponse>>(
      '/auth/google',
      { access_token: accessToken }
    );
    return response.data;
  },

  guestToken: async (fingerprint?: string) => {
    const response = await apiClient.post<ApiResponse<AuthResponse>>(
      '/auth/guest',
      { fingerprint }
    );
    return response.data;
  },

  forgotPassword: async (email: string) => {
    const response = await apiClient.post<ApiResponse<null>>(
      '/auth/forgot-password',
      { email }
    );
    return response.data;
  },

  resetPassword: async (data: {
    token: string;
    email: string;
    password: string;
    password_confirmation: string;
  }) => {
    const response = await apiClient.post<ApiResponse<null>>(
      '/auth/reset-password',
      data
    );
    return response.data;
  },

  // Protected endpoints
  me: async () => {
    const response = await apiClient.get<ApiResponse<User>>('/auth/me');
    return response.data;
  },

  // Silent auth check (won't trigger redirect on 401)
  meSilent: async () => {
    const response = await apiClient.get<ApiResponse<User>>('/auth/me', {
      headers: { 'X-Silent-Auth': 'true' },
    });
    return response.data;
  },

  logout: async () => {
    const response = await apiClient.post<ApiResponse<null>>('/auth/logout');
    return response.data;
  },

  resendVerification: async () => {
    const response = await apiClient.post<ApiResponse<null>>(
      '/auth/resend-verification'
    );
    return response.data;
  },

  getSessions: async () => {
    const response = await apiClient.get<ApiResponse<Session[]>>(
      '/auth/sessions'
    );
    return response.data;
  },

  revokeSession: async (sessionId: number) => {
    const response = await apiClient.delete<ApiResponse<null>>(
      `/auth/sessions/${sessionId}`
    );
    return response.data;
  },

  revokeAllSessions: async () => {
    const response = await apiClient.delete<ApiResponse<null>>('/auth/sessions');
    return response.data;
  },
};
```

### 2.4 Auth Store

**`lib/stores/authStore.ts`**
```typescript
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User } from '@/types/auth';

interface AuthStore {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isGuest: boolean;
  setAuth: (user: User, token: string) => void;
  clearAuth: () => void;
  updateUser: (user: Partial<User>) => void;
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      isGuest: false,

      // Let Zustand persist handle storage - no manual localStorage
      setAuth: (user, token) => {
        set({
          user,
          token,
          isAuthenticated: true,
          isGuest: user.role === 'guest',
        });
      },

      clearAuth: () => {
        set({
          user: null,
          token: null,
          isAuthenticated: false,
          isGuest: false,
        });
      },

      updateUser: (userData) => {
        const currentUser = get().user;
        if (currentUser) {
          set({ user: { ...currentUser, ...userData } });
        }
      },
    }),
    {
      name: 'lawexa-auth',
    }
  )
);
```

### 2.5 Auth Hooks

**`lib/hooks/useAuth.ts`**
```typescript
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { authApi } from '@/lib/api/auth';
import { useAuthStore } from '@/lib/stores/authStore';
import { extractApiError, type ApiError } from '@/lib/utils/api-error';
import type { LoginFormData, RegisterFormData } from '@/types/auth';

export function useAuth() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user, isAuthenticated, isGuest, setAuth, clearAuth } = useAuthStore();

  // Get current user query
  const { data: currentUser, isLoading } = useQuery({
    queryKey: ['auth', 'me'],
    queryFn: () => authApi.me(),
    enabled: isAuthenticated && !isGuest,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Login mutation
  const loginMutation = useMutation({
    mutationFn: (data: LoginFormData) => authApi.login(data),
    onSuccess: (response) => {
      if (response.success && response.data) {
        setAuth(response.data.user, response.data.token);
        queryClient.invalidateQueries({ queryKey: ['auth'] });
        router.push('/');
      }
    },
  });

  // Register mutation
  const registerMutation = useMutation({
    mutationFn: (data: RegisterFormData) => authApi.register(data),
    onSuccess: (response) => {
      if (response.success && response.data) {
        setAuth(response.data.user, response.data.token);
        router.push('/');
      }
    },
  });

  // Logout mutation
  const logoutMutation = useMutation({
    mutationFn: () => authApi.logout(),
    onSuccess: () => {
      clearAuth();
      queryClient.clear();
      router.push('/login');
    },
  });

  // Google auth
  const googleAuthMutation = useMutation({
    mutationFn: () => authApi.googleAuthUrl(),
    onSuccess: (response) => {
      if (response.success && response.data) {
        window.location.href = response.data.url;
      }
    },
  });

  // Extract errors with proper typing
  const loginError: ApiError | null = loginMutation.error
    ? extractApiError(loginMutation.error)
    : null;

  const registerError: ApiError | null = registerMutation.error
    ? extractApiError(registerMutation.error)
    : null;

  return {
    user: currentUser?.data || user,
    isAuthenticated,
    isGuest,
    isLoading,
    login: loginMutation.mutate,
    loginError,
    isLoggingIn: loginMutation.isPending,
    register: registerMutation.mutate,
    registerError,
    isRegistering: registerMutation.isPending,
    logout: logoutMutation.mutate,
    isLoggingOut: logoutMutation.isPending,
    googleAuth: googleAuthMutation.mutate,
  };
}
```

### 2.6 Fingerprint Hook

**`lib/hooks/useFingerprint.ts`**
```typescript
import { useEffect, useState } from 'react';
import FingerprintJS from '@fingerprintjs/fingerprintjs';

export function useFingerprint() {
  const [fingerprint, setFingerprint] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const getFingerprint = async () => {
      try {
        const fp = await FingerprintJS.load();
        const result = await fp.get();
        setFingerprint(result.visitorId);
      } catch (error) {
        console.error('Failed to get fingerprint:', error);
      } finally {
        setIsLoading(false);
      }
    };

    getFingerprint();
  }, []);

  return { fingerprint, isLoading };
}
```

### 2.7 Greeting Hook

**`lib/hooks/useGreeting.ts`**
```typescript
import { useMemo } from 'react';
import { useAuthStore } from '@/lib/stores/authStore';
import { getTimeBasedGreeting } from '@/lib/constants/greetings';

export function useGreeting() {
  const { user } = useAuthStore();

  const greeting = useMemo(() => {
    return getTimeBasedGreeting(user?.name);
  }, [user?.name]);

  return greeting;
}
```

**`lib/constants/greetings.ts`**
```typescript
type TimePeriod = 'earlyMorning' | 'lateMorning' | 'afternoon' | 'evening' | 'night' | 'lateNight';

const timeBasedMessages: Record<TimePeriod, { withName: string[]; withoutName: string[] }> = {
  earlyMorning: {
    withName: ['Good morning,', 'Rise and shine,', 'Morning,'],
    withoutName: ['Rise and shine!', 'Good morning!', 'Early bird gets the worm!'],
  },
  lateMorning: {
    withName: ['Good morning,', 'Hey,', 'Hello,'],
    withoutName: ['Good morning!', 'Hello there!', 'Having a productive morning?'],
  },
  afternoon: {
    withName: ['Good afternoon,', 'Hey,', 'Hello,'],
    withoutName: ['Good afternoon!', 'Hope your day is going well!', 'Afternoon grind!'],
  },
  evening: {
    withName: ['Good evening,', 'Hey,', 'Evening,'],
    withoutName: ['Good evening!', 'Winding down?', 'Evening session!'],
  },
  night: {
    withName: ['Hey,', 'Still at it,', 'Night owl,'],
    withoutName: ['Night owl mode!', 'Burning the midnight oil!', 'Late night session!'],
  },
  lateNight: {
    withName: ['Hey,', 'Still awake,', 'Midnight oil burning,'],
    withoutName: ['Midnight oil burning!', 'The night is young!', 'Dedication!'],
  },
};

function getTimePeriod(): TimePeriod {
  const hour = new Date().getHours();

  if (hour >= 5 && hour < 9) return 'earlyMorning';
  if (hour >= 9 && hour < 12) return 'lateMorning';
  if (hour >= 12 && hour < 17) return 'afternoon';
  if (hour >= 17 && hour < 21) return 'evening';
  if (hour >= 21 && hour < 24) return 'night';
  return 'lateNight';
}

function getRandomMessage(messages: string[]): string {
  return messages[Math.floor(Math.random() * messages.length)];
}

export function getTimeBasedGreeting(userName?: string | null): string {
  const period = getTimePeriod();
  const messages = timeBasedMessages[period];

  if (userName) {
    const greeting = getRandomMessage(messages.withName);
    return `${greeting} ${userName}!`;
  }

  return getRandomMessage(messages.withoutName);
}
```

### 2.8 Auth Components

#### LoginForm Component

**`components/auth/LoginForm.tsx`**
```tsx
'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Separator } from '@/components/ui/separator';

import { useAuth } from '@/lib/hooks/useAuth';
import { loginSchema } from '@/lib/utils/validation';
import type { LoginFormData } from '@/types/auth';

import { GoogleAuthButton } from './GoogleAuthButton';

/******************************************************************************
                               Components
******************************************************************************/

/**
 * Default component. Login form with email/password and Google OAuth.
 */
function LoginForm() {
  const { login, loginError, isLoggingIn } = useAuth();

  // Init form
  const form = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  // Handle submit
  const onSubmit = (data: LoginFormData) => {
    login(data);
  };

  // Return
  return (
    <Card className="w-full max-w-md">
      <CardHeader className="space-y-1">
        <CardTitle className="text-2xl font-bold">Welcome back</CardTitle>
        <CardDescription>
          Enter your credentials to access your account
        </CardDescription>
      </CardHeader>

      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* Email Field */}
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input
                      type="email"
                      placeholder="you@example.com"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Password Field */}
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <div className="flex items-center justify-between">
                    <FormLabel>Password</FormLabel>
                    <a
                      href="/forgot-password"
                      className="text-sm text-muted-foreground hover:text-primary"
                    >
                      Forgot password?
                    </a>
                  </div>
                  <FormControl>
                    <Input type="password" placeholder="••••••••" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* API Error */}
            {loginError && (
              <p className="text-sm text-destructive">{loginError.message}</p>
            )}

            {/* Submit Button */}
            <Button type="submit" className="w-full" disabled={isLoggingIn}>
              {isLoggingIn && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Sign in
            </Button>
          </form>
        </Form>

        {/* Divider */}
        <div className="relative my-6">
          <Separator />
          <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-card px-2 text-xs text-muted-foreground">
            OR
          </span>
        </div>

        {/* Google OAuth */}
        <GoogleAuthButton />
      </CardContent>

      <CardFooter className="flex justify-center">
        <p className="text-sm text-muted-foreground">
          Don&apos;t have an account?{' '}
          <a href="/register" className="text-primary hover:underline">
            Sign up
          </a>
        </p>
      </CardFooter>
    </Card>
  );
}

/******************************************************************************
                               Export default
******************************************************************************/

export default LoginForm;
```

#### GoogleAuthButton Component

**`components/auth/GoogleAuthButton.tsx`**
```tsx
'use client';

import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/hooks/useAuth';

/******************************************************************************
                               Components
******************************************************************************/

/**
 * Default component. Google OAuth button.
 */
function GoogleAuthButton() {
  const { googleAuth } = useAuth();

  // Return
  return (
    <Button
      type="button"
      variant="outline"
      className="w-full"
      onClick={() => googleAuth()}
    >
      <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
        <path
          fill="currentColor"
          d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        />
        <path
          fill="currentColor"
          d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        />
        <path
          fill="currentColor"
          d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        />
        <path
          fill="currentColor"
          d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        />
      </svg>
      Continue with Google
    </Button>
  );
}

/******************************************************************************
                               Export default
******************************************************************************/

export default GoogleAuthButton;
export { GoogleAuthButton };
```

#### RegisterForm Component

**`components/auth/RegisterForm.tsx`**
```tsx
'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Separator } from '@/components/ui/separator';

import { useAuth } from '@/lib/hooks/useAuth';
import { registerSchema } from '@/lib/utils/validation';
import { getFieldError } from '@/lib/utils/api-error';
import type { RegisterFormData } from '@/types/auth';

import { GoogleAuthButton } from './GoogleAuthButton';

/******************************************************************************
                               Components
******************************************************************************/

/**
 * Default component. Registration form with email/password and Google OAuth.
 */
function RegisterForm() {
  const { register, registerError, isRegistering } = useAuth();

  // Init form
  const form = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      name: '',
      email: '',
      password: '',
      password_confirmation: '',
    },
  });

  // Handle submit
  const onSubmit = (data: RegisterFormData) => {
    register(data);
  };

  // Return
  return (
    <Card className="w-full max-w-md">
      <CardHeader className="space-y-1">
        <CardTitle className="text-2xl font-bold">Create an account</CardTitle>
        <CardDescription>
          Enter your details to get started
        </CardDescription>
      </CardHeader>

      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* Name Field */}
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input placeholder="John Doe" {...field} />
                  </FormControl>
                  <FormMessage>
                    {getFieldError(registerError?.errors, 'name')}
                  </FormMessage>
                </FormItem>
              )}
            />

            {/* Email Field */}
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input
                      type="email"
                      placeholder="you@example.com"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage>
                    {getFieldError(registerError?.errors, 'email')}
                  </FormMessage>
                </FormItem>
              )}
            />

            {/* Password Field */}
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Password</FormLabel>
                  <FormControl>
                    <Input type="password" placeholder="••••••••" {...field} />
                  </FormControl>
                  <FormMessage>
                    {getFieldError(registerError?.errors, 'password')}
                  </FormMessage>
                </FormItem>
              )}
            />

            {/* Confirm Password Field */}
            <FormField
              control={form.control}
              name="password_confirmation"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Confirm Password</FormLabel>
                  <FormControl>
                    <Input type="password" placeholder="••••••••" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* API Error */}
            {registerError && !registerError.errors && (
              <p className="text-sm text-destructive">{registerError.message}</p>
            )}

            {/* Submit Button */}
            <Button type="submit" className="w-full" disabled={isRegistering}>
              {isRegistering && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create account
            </Button>
          </form>
        </Form>

        {/* Divider */}
        <div className="relative my-6">
          <Separator />
          <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-card px-2 text-xs text-muted-foreground">
            OR
          </span>
        </div>

        {/* Google OAuth */}
        <GoogleAuthButton />
      </CardContent>

      <CardFooter className="flex justify-center">
        <p className="text-sm text-muted-foreground">
          Already have an account?{' '}
          <a href="/login" className="text-primary hover:underline">
            Sign in
          </a>
        </p>
      </CardFooter>
    </Card>
  );
}

/******************************************************************************
                               Export default
******************************************************************************/

export default RegisterForm;
```

### 2.9 Auth Pages

#### Google OAuth Callback Page

**`app/(auth)/auth/google/callback/page.tsx`**
```tsx
'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';

import { authApi } from '@/lib/api/auth';
import { useAuthStore } from '@/lib/stores/authStore';

/******************************************************************************
                               Components
******************************************************************************/

/**
 * Default component. Handle Google OAuth callback.
 */
function GoogleCallbackPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const setAuth = useAuthStore((state) => state.setAuth);

  useEffect(() => {
    const handleCallback = async () => {
      const accessToken = searchParams.get('access_token');
      const error = searchParams.get('error');

      // Handle error from Google
      if (error) {
        router.push('/login?error=google_auth_failed');
        return;
      }

      // Handle missing token
      if (!accessToken) {
        router.push('/login?error=missing_token');
        return;
      }

      try {
        const response = await authApi.googleCallback(accessToken);
        if (response.success && response.data) {
          setAuth(response.data.user, response.data.token);
          router.push('/');
        }
      } catch {
        router.push('/login?error=google_auth_failed');
      }
    };

    handleCallback();
  }, [searchParams, router, setAuth]);

  // Return
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
        <p className="mt-4 text-muted-foreground">Completing sign in...</p>
      </div>
    </div>
  );
}

/******************************************************************************
                               Export default
******************************************************************************/

export default GoogleCallbackPage;
```

#### Login Page

**`app/(auth)/login/page.tsx`**
```tsx
import LoginForm from '@/components/auth/LoginForm';

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <LoginForm />
    </div>
  );
}
```

#### Register Page

**`app/(auth)/register/page.tsx`**
```tsx
import RegisterForm from '@/components/auth/RegisterForm';

export default function RegisterPage() {
  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <RegisterForm />
    </div>
  );
}
```

### 2.10 Additional Components to Build

1. **ForgotPasswordForm** - Email input to request reset
2. **ResetPasswordForm** - New password with token
3. **AuthModal** - Modal wrapper for auth forms
4. **GuestPrompt** - CTA for guests to register

### 2.11 Additional Pages to Build

1. `/forgot-password` - Request password reset
2. `/reset-password` - Reset password (with token from email)
3. `/verify-email/[id]/[hash]` - Email verification handler

---

## Implementation Order

### Phase 2.1: Foundation
- [ ] Set up project structure
- [ ] Install and configure dependencies
- [ ] Install shadcn/ui components
- [ ] Create base types and API client
- [ ] Create API error utility
- [ ] Set up providers (Query, Theme)
- [ ] Create color tokens and theme

### Phase 2.2: Auth Core
- [ ] Build auth store (Zustand with persist)
- [ ] Create validation schemas
- [ ] Build auth API functions
- [ ] Build useAuth hook with error extraction
- [ ] Build LoginForm component
- [ ] Build RegisterForm component
- [ ] Build GoogleAuthButton component
- [ ] Create auth pages (login, register)

### Phase 2.3: Auth Complete
- [ ] Build ForgotPasswordForm component
- [ ] Build ResetPasswordForm component
- [ ] Build Google OAuth callback page
- [ ] Build email verification page
- [ ] Create AuthModal component
- [ ] Implement guest token flow with fingerprint
- [ ] Build GuestPrompt component

### Phase 2.4: Layout & Navigation
- [ ] Build Sidebar component
- [ ] Build mobile navigation
- [ ] Create main layout with sidebar
- [ ] Implement theme toggle
- [ ] Build welcome/home page with greeting

---

## Notes

- All API calls go through TanStack Query for caching and state management
- Auth token stored in Zustand with persist middleware (handles localStorage automatically)
- API client reads token from Zustand store, not localStorage directly
- API errors are extracted with typed `ApiError` interface for form display
- 401 responses only redirect when not on auth pages and not a silent check
- Theme preference stored in Zustand (persisted)
- Forms use React Hook Form with Zod validation
- shadcn/ui components: `button`, `input`, `form`, `card`, `label`, `separator`, `toast`
- Mobile-first CSS approach
- Skeleton loaders for initial loads, cached data shows immediately on subsequent visits
