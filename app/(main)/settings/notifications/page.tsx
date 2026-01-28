import { Bell } from 'lucide-react';
import { ComingSoonCard } from '@/components/settings/coming-soon-card';

export default function NotificationsSettingsPage() {
  return (
    <ComingSoonCard
      title="Notifications"
      description="Configure your email and push notification preferences."
      icon={Bell}
    />
  );
}
