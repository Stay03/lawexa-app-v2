import { Link } from 'lucide-react';
import { ComingSoonCard } from '@/components/settings/coming-soon-card';

export default function ApiSettingsPage() {
  return (
    <ComingSoonCard
      title="API"
      description="Manage your API keys and integrations."
      icon={Link}
    />
  );
}
