'use client';

import { Button } from '@/components/ui/button';
import { Loader2, Zap } from 'lucide-react';
import { toast } from 'sonner';
import { useTestAiProvider } from '@/lib/hooks/useAdminAi';

interface AiProviderTestButtonProps {
  providerId: number;
}

export function AiProviderTestButton({ providerId }: AiProviderTestButtonProps) {
  const testMutation = useTestAiProvider();

  const handleTest = () => {
    testMutation.mutate(providerId, {
      onSuccess: (response) => {
        if (response.data.success) {
          toast.success(
            `Connection successful (${response.data.response_time_ms}ms)`
          );
        } else {
          toast.error(response.data.error || 'Connection failed');
        }
      },
      onError: () => {
        toast.error('Something went wrong');
      },
    });
  };

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleTest}
      disabled={testMutation.isPending}
    >
      {testMutation.isPending ? (
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      ) : (
        <Zap className="mr-2 h-4 w-4" />
      )}
      Test API Key
    </Button>
  );
}
