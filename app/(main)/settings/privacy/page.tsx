import { Lock } from 'lucide-react';
import { ComingSoonCard } from '@/components/settings/coming-soon-card';

export default function PrivacySettingsPage() {
  return (
    <ComingSoonCard
      title="Privacy & Security"
      description="Manage your privacy settings, sessions, and security preferences."
      icon={Lock}
    />
  );
}
