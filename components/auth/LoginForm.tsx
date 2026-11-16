'use client';

import { useEffect, useRef, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';
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
import { AuthSwitchLink } from './AuthSwitchLink';
import { AuthRefusalNote } from './AuthRefusalNote';
import { authRefusalOf, emailFromSearch, looksLikeEmail, signsInWithGoogle } from '@/lib/utils/auth-refusal';
import { authApi } from '@/lib/api/auth';
import type { LoginFormData } from '@/types/auth';

import { GoogleAuthButton } from './GoogleAuthButton';

function LoginForm() {
  const { login, loginError, isLoggingIn } = useAuth();

  const form = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  // Sent here from sign-up with the email already taken: it is in the box.
  useEffect(() => {
    const email = emailFromSearch(window.location.search);
    if (email) form.setValue('email', email);
  }, [form]);

  // An account made with Google has no password: say so, with its button (lib/utils/auth-refusal.ts).
  const refusal = authRefusalOf(loginError);

  /* SPOTTED BEFORE THE PASSWORD (Stay, 16 November 2026). Leaving the email box
     asks how that email signs in; a Google account swaps the password for
     Google's button. The swap holds only while the box still holds that email,
     so changing it brings the password back. Anything else, a failed check
     included, leaves the form as it is and says nothing. */
  const typedEmail = useWatch({ control: form.control, name: 'email' });
  const [googleEmail, setGoogleEmail] = useState<string | null>(null);
  const lastAsked = useRef<string | null>(null);
  const googleOnly = googleEmail !== null && googleEmail === typedEmail.trim().toLowerCase();
  const askHowItSignsIn = async (value: string) => {
    const email = value.trim().toLowerCase();
    if (!looksLikeEmail(email) || lastAsked.current === email) return;
    lastAsked.current = email;
    try {
      const status = (await authApi.emailStatus(email)).data;
      if (signsInWithGoogle(status)) setGoogleEmail(email);
    } catch {
      // The throttle or a fault: the form stays as it is.
    }
  };

  const onSubmit = (data: LoginFormData) => {
    login(data);
  };

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
                      onBlur={() => {
                        field.onBlur();
                        void askHowItSignsIn(field.value);
                      }}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {googleOnly ? (
              <AuthRefusalNote refusal="use_google" email={typedEmail} />
            ) : (
              <>
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
                        <PasswordInput placeholder="••••••••" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {refusal ? (
                  <AuthRefusalNote refusal={refusal} email={form.getValues('email')} />
                ) : loginError ? (
                  <p className="text-sm text-destructive">{loginError.message}</p>
                ) : null}

                <Button type="submit" className="w-full" disabled={isLoggingIn}>
                  {isLoggingIn && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Sign in
                </Button>
              </>
            )}
          </form>
        </Form>

        {/* The swapped form already holds Google's button: no second one below it. */}
        {googleOnly ? null : (
          <>
            <div className="relative my-6">
              <Separator />
              <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-card px-2 text-xs text-muted-foreground">
                OR
              </span>
            </div>

            <GoogleAuthButton />
          </>
        )}
      </CardContent>

      <CardFooter className="flex justify-center">
        <p className="text-sm text-muted-foreground">
          Don&apos;t have an account?{' '}
          <AuthSwitchLink to="/register">Sign up</AuthSwitchLink>
        </p>
      </CardFooter>
    </Card>
  );
}

export default LoginForm;
