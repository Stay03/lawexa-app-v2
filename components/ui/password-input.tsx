'use client';

import * as React from 'react';
import { Eye, EyeOff } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

function PasswordInput({
  className,
  ...props
}: Omit<React.ComponentProps<typeof Input>, 'type'>) {
  const [showPassword, setShowPassword] = React.useState(false);

  return (
    <div className="relative">
      <Input
        type={showPassword ? 'text' : 'password'}
        className={cn('pr-10', className)}
        {...props}
      />
      <Button
        type="button"
        variant="ghost"
        size="icon-xs"
        className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
        onClick={() => setShowPassword((prev) => !prev)}
        tabIndex={-1}
      >
        {showPassword ? (
          <EyeOff className="h-4 w-4" />
        ) : (
          <Eye className="h-4 w-4" />
        )}
        <span className="sr-only">
          {showPassword ? 'Hide password' : 'Show password'}
        </span>
      </Button>
    </div>
  );
}

export { PasswordInput };
