import { Suspense } from 'react';
import ResetPasswordForm from '@/components/auth/ResetPasswordForm';
import { Loader2 } from 'lucide-react';

function LoadingFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Suspense fallback={<LoadingFallback />}>
        <ResetPasswordForm />
      </Suspense>
    </div>
  );
}
