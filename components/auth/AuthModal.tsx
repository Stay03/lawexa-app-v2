'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { AnimatedTabs } from '@/components/ui/animated-tabs';
import { XIcon } from 'lucide-react';
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

const authTabs = [
  { value: 'login', label: 'Sign In' },
  { value: 'register', label: 'Sign Up' },
];

/**
 * Auth modal with tabbed Sign In / Sign Up forms.
 * Supports both trigger-based (internal state) and externally controlled modes.
 */
function AuthModal({ trigger, defaultTab = 'login', open: controlledOpen, onOpenChange }: AuthModalProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<string>(defaultTab);

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
      <DialogContent className="max-w-md p-0 gap-0" showCloseButton={false}>
        <DialogHeader className="sr-only">
          <DialogTitle>Authentication</DialogTitle>
          <DialogDescription>Sign in or create an account</DialogDescription>
        </DialogHeader>
        <DialogClose asChild>
          <Button variant="ghost" size="icon-sm" className="absolute top-3 right-3 z-10">
            <XIcon />
            <span className="sr-only">Close</span>
          </Button>
        </DialogClose>
        <div className="flex justify-center pt-4 pb-2">
          <AnimatedTabs
            tabs={authTabs}
            value={activeTab}
            onValueChange={setActiveTab}
          />
        </div>
        <div className="[&>div]:border-0 [&>div]:shadow-none [&>div]:rounded-none [&>div]:bg-transparent [&>div]:ring-0">
          {activeTab === 'login' ? <LoginForm /> : <RegisterForm />}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default AuthModal;
export { AuthModal };
