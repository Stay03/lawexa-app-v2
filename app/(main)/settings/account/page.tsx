import { Settings } from 'lucide-react';
import { ComingSoonCard } from '@/components/settings/coming-soon-card';

export default function AccountSettingsPage() {
  return (
    <ComingSoonCard
      title="Account Settings"
      description="Manage your account details, email, and password."
      icon={Settings}
    />
  );
}
