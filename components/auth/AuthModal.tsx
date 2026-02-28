'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import LoginForm from './LoginForm';
import RegisterForm from './RegisterForm';

interface AuthModalProps {
  /** Element that triggers the dialog (used with internal state) */
  trigger?: React.ReactNode;
  defaultTab?: 'login' | 'register';
  /** Externally controlled open state */
  open?: boolean;
  /** Callback when open state changes (for external control) */
  onOpenChange?: (open: boolean) => void;
}

/**
 * Auth modal with tabbed Sign In / Sign Up forms.
 * Supports both trigger-based (internal state) and externally controlled modes.
 */
function AuthModal({ trigger, defaultTab = 'login', open: controlledOpen, onOpenChange }: AuthModalProps) {
  const [internalOpen, setInternalOpen] = useState(false);

  // Use external control when provided, otherwise fall back to internal state
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;
  const setOpen = isControlled ? (onOpenChange ?? (() => {})) : setInternalOpen;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {!isControlled && (
        <DialogTrigger asChild>
          {trigger || <Button>Sign In</Button>}
        </DialogTrigger>
      )}
      <DialogContent className="max-w-md p-0">
        <DialogHeader className="sr-only">
          <DialogTitle>Authentication</DialogTitle>
          <DialogDescription>Sign in or create an account</DialogDescription>
        </DialogHeader>
        <Tabs defaultValue={defaultTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2 rounded-b-none">
            <TabsTrigger value="login">Sign In</TabsTrigger>
            <TabsTrigger value="register">Sign Up</TabsTrigger>
          </TabsList>
          <TabsContent value="login" className="mt-0">
            <div className="p-0 [&>div]:border-0 [&>div]:shadow-none">
              <LoginForm />
            </div>
          </TabsContent>
          <TabsContent value="register" className="mt-0">
            <div className="p-0 [&>div]:border-0 [&>div]:shadow-none">
              <RegisterForm />
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

export default AuthModal;
export { AuthModal };
