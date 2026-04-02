'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { AlertCircle, CheckCircle2, Loader2, ShieldAlert } from 'lucide-react';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

import { authApi } from '@/lib/api/auth';
import { useAuthStore } from '@/lib/stores/authStore';
import { extractApiError } from '@/lib/utils/api-error';
import { GrantLoginForm } from './GrantLoginForm';

const ALLOWED_ORIGINS = [
  'https://bench.lawexa.com',
  'http://localhost:3000',
  'http://localhost:3001',
  'http://localhost:5173',
];

type GrantState =
  | { status: 'loading' }
  | { status: 'login' }
  | { status: 'granting' }
  | { status: 'success' }
  | { status: 'error'; message: string };

function getOrigin(url: string): string | null {
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

export function GrantAuth() {
  const searchParams = useSearchParams();
  const { isAuthenticated, isGuest } = useAuthStore();
  const [state, setState] = useState<GrantState>({ status: 'loading' });
  const grantAttempted = useRef(false);

  const clientId = searchParams.get('client_id');
  const redirectUri = searchParams.get('redirect_uri');
  const redirectOrigin = redirectUri ? getOrigin(redirectUri) : null;

  const performGrant = useCallback(async () => {
    if (!clientId || !redirectOrigin) return;

    setState({ status: 'granting' });

    try {
      const response = await authApi.grantToken(clientId);

      if (response.success && response.data) {
        window.opener?.postMessage(
          { type: 'lawexa:grant', token: response.data.token },
          redirectOrigin
        );
        setState({ status: 'success' });
        setTimeout(() => window.close(), 1000);
      }
    } catch (err) {
      const apiError = extractApiError(err);

      if (apiError.status === 401) {
        // Token expired — fall back to login
        setState({ status: 'login' });
      } else if (apiError.status === 403) {
        setState({
          status: 'error',
          message: 'Guest accounts cannot authorize third-party applications. Please sign in with a full account.',
        });
      } else if (apiError.status === 422) {
        setState({
          status: 'error',
          message: 'Invalid application. The requested client is not recognized.',
        });
      } else {
        setState({ status: 'error', message: apiError.message });
      }
    }
  }, [clientId, redirectOrigin]);

  // Validate params and check auth on mount
  useEffect(() => {
    if (!clientId || !redirectUri) {
      setState({
        status: 'error',
        message: 'Missing required parameters. Both client_id and redirect_uri are required.',
      });
      return;
    }

    if (!redirectOrigin || !ALLOWED_ORIGINS.includes(redirectOrigin)) {
      setState({
        status: 'error',
        message: `The redirect origin "${redirectOrigin}" is not allowed.`,
      });
      return;
    }

    if (!window.opener) {
      setState({
        status: 'error',
        message: 'This page must be opened as a popup window from the requesting application.',
      });
      return;
    }

    if (isGuest) {
      setState({
        status: 'error',
        message: 'Guest accounts cannot authorize third-party applications. Please sign in with a full account.',
      });
      return;
    }

    if (isAuthenticated && !grantAttempted.current) {
      grantAttempted.current = true;
      performGrant();
    } else if (!isAuthenticated) {
      setState({ status: 'login' });
    }
  }, [clientId, redirectUri, redirectOrigin, isAuthenticated, isGuest, performGrant]);

  const handleLoginSuccess = () => {
    grantAttempted.current = true;
    performGrant();
  };

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="space-y-1 text-center">
        <CardTitle className="text-2xl font-bold">Authorize Application</CardTitle>
        <CardDescription>
          {state.status === 'login'
            ? 'Sign in to your Lawexa account to continue'
            : state.status === 'granting'
              ? 'Authorizing...'
              : state.status === 'success'
                ? 'Authorization complete'
                : state.status === 'error'
                  ? 'Authorization failed'
                  : 'Checking your session...'}
        </CardDescription>
      </CardHeader>

      <CardContent>
        {state.status === 'loading' && (
          <div className="flex justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        )}

        {state.status === 'granting' && (
          <div className="flex flex-col items-center gap-3 py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">
              Generating authorization token...
            </p>
          </div>
        )}

        {state.status === 'success' && (
          <div className="flex flex-col items-center gap-3 py-8">
            <CheckCircle2 className="h-8 w-8 text-green-500" />
            <p className="text-sm text-muted-foreground">
              You have been authorized. This window will close automatically.
            </p>
          </div>
        )}

        {state.status === 'login' && (
          <GrantLoginForm onLoginSuccess={handleLoginSuccess} />
        )}

        {state.status === 'error' && (
          <div className="flex flex-col items-center gap-3 py-8 text-center">
            {state.message.includes('Guest') ? (
              <ShieldAlert className="h-8 w-8 text-orange-500" />
            ) : (
              <AlertCircle className="h-8 w-8 text-destructive" />
            )}
            <p className="text-sm text-muted-foreground">{state.message}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
