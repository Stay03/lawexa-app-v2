import { Sparkles } from 'lucide-react';
import { PageContainer } from '@/components/layout';

export default function UpgradePage() {
  return (
    <PageContainer variant="detail">
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="mb-4 rounded-full bg-primary/10 p-4">
          <Sparkles className="h-8 w-8 text-primary" />
        </div>
        <h1 className="text-2xl font-semibold mb-2">Upgrade Plans Coming Soon</h1>
        <p className="text-sm text-muted-foreground max-w-md">
          We are working on premium plans that will give you unlimited case views
          and access to advanced features. Stay tuned!
        </p>
      </div>
    </PageContainer>
  );
}
