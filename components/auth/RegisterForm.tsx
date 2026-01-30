'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowLeft, Loader2, Mail } from 'lucide-react';

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
import { emailOnlySchema, registerStep2Schema } from '@/lib/utils/validation';
import { getFieldError } from '@/lib/utils/api-error';

import { GoogleAuthButton } from './GoogleAuthButton';

type Step = 'initial' | 'gmail-recommendation' | 'email-password';

interface EmailFormData {
  email: string;
}

interface Step2FormData {
  name: string;
  password: string;
  password_confirmation: string;
}

function RegisterForm() {
  const { register, registerError, isRegistering } = useAuth();
  const [step, setStep] = useState<Step>('initial');
  const [email, setEmail] = useState('');

  const emailForm = useForm<EmailFormData>({
    resolver: zodResolver(emailOnlySchema),
    defaultValues: {
      email: '',
    },
  });

  const step2Form = useForm<Step2FormData>({
    resolver: zodResolver(registerStep2Schema),
    defaultValues: {
      name: '',
      password: '',
      password_confirmation: '',
    },
  });

  const isGmailEmail = (email: string) => {
    return email.toLowerCase().endsWith('@gmail.com');
  };

  const onEmailSubmit = (data: EmailFormData) => {
    setEmail(data.email);
    if (isGmailEmail(data.email)) {
      setStep('gmail-recommendation');
    } else {
      setStep('email-password');
    }
  };

  const onStep2Submit = (data: Step2FormData) => {
    register({
      email,
      name: data.name,
      password: data.password,
      password_confirmation: data.password_confirmation,
    });
  };

  const handleBack = () => {
    setStep('initial');
    setEmail('');
    step2Form.reset();
  };

  const handleUsePasswordInstead = () => {
    setStep('email-password');
  };

  // Step 1: Initial screen with Google button and email input
  if (step === 'initial') {
    return (
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold">Create an account</CardTitle>
          <CardDescription>
            Choose how you want to sign up
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          <GoogleAuthButton />

          <div className="relative my-6">
            <Separator />
            <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-card px-2 text-xs text-muted-foreground">
              OR
            </span>
          </div>

          <Form {...emailForm}>
            <form onSubmit={emailForm.handleSubmit(onEmailSubmit)} className="space-y-4">
              <FormField
                control={emailForm.control}
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

              <Button type="submit" variant="outline" className="w-full">
                <Mail className="mr-2 h-4 w-4" />
                Continue with Email
              </Button>
            </form>
          </Form>
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

  // Step 2a: Gmail recommendation screen
  if (step === 'gmail-recommendation') {
    return (
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="w-fit -ml-2 mb-2"
            onClick={handleBack}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
          <CardTitle className="text-2xl font-bold">Sign up with Google</CardTitle>
          <CardDescription>
            We noticed you&apos;re using a Gmail address. For a faster and more secure experience, we recommend signing up with Google.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="rounded-lg border bg-muted/50 p-3">
            <p className="text-sm text-muted-foreground">
              Signing up as: <span className="font-medium text-foreground">{email}</span>
            </p>
          </div>

          <GoogleAuthButton />

          <div className="text-center">
            <button
              type="button"
              onClick={handleUsePasswordInstead}
              className="text-sm text-muted-foreground hover:text-primary hover:underline"
            >
              Use password instead
            </button>
          </div>
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

  // Step 2b: Name and password form (for non-Gmail or "use password instead")
  return (
    <Card className="w-full max-w-md">
      <CardHeader className="space-y-1">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="w-fit -ml-2 mb-2"
          onClick={handleBack}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        <CardTitle className="text-2xl font-bold">Complete your account</CardTitle>
        <CardDescription>
          Enter your details to finish signing up
        </CardDescription>
      </CardHeader>

      <CardContent>
        <div className="rounded-lg border bg-muted/50 p-3 mb-4">
          <p className="text-sm text-muted-foreground">
            Signing up as: <span className="font-medium text-foreground">{email}</span>
          </p>
        </div>

        <Form {...step2Form}>
          <form onSubmit={step2Form.handleSubmit(onStep2Submit)} className="space-y-4">
            <FormField
              control={step2Form.control}
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

            <FormField
              control={step2Form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Password</FormLabel>
                  <FormControl>
                    <PasswordInput placeholder="••••••••" {...field} />
                  </FormControl>
                  <FormMessage>
                    {getFieldError(registerError?.errors, 'password')}
                  </FormMessage>
                </FormItem>
              )}
            />

            <FormField
              control={step2Form.control}
              name="password_confirmation"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Confirm Password</FormLabel>
                  <FormControl>
                    <PasswordInput placeholder="••••••••" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {registerError && !registerError.errors && (
              <p className="text-sm text-destructive">{registerError.message}</p>
            )}

            {registerError?.errors?.email && (
              <p className="text-sm text-destructive">
                {getFieldError(registerError.errors, 'email')}
              </p>
            )}

            <Button type="submit" className="w-full" disabled={isRegistering}>
              {isRegistering && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create account
            </Button>
          </form>
        </Form>
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

export default RegisterForm;
