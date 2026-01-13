'use client';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { LogIn, UserPlus } from 'lucide-react';

interface GuestPromptProps {
  title?: string;
  description?: string;
  showRegister?: boolean;
}

function GuestPrompt({
  title = 'Create an account to continue',
  description = 'Sign up for free to access all features and save your progress.',
  showRegister = true,
}: GuestPromptProps) {
  return (
    <Card className="w-full max-w-md">
      <CardHeader className="text-center">
        <CardTitle className="text-xl">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {showRegister && (
          <Button asChild className="w-full">
            <a href="/register">
              <UserPlus className="mr-2 h-4 w-4" />
              Create free account
            </a>
          </Button>
        )}
        <Button variant="outline" asChild className="w-full">
          <a href="/login">
            <LogIn className="mr-2 h-4 w-4" />
            Sign in
          </a>
        </Button>
      </CardContent>
    </Card>
  );
}

export default GuestPrompt;
export { GuestPrompt };
