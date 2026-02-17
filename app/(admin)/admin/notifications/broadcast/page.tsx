'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { BroadcastNotificationForm } from '@/components/admin/notifications';

/******************************************************************************
                                Default Export
******************************************************************************/

/**
 * Default component. Admin notification broadcast page.
 */
export default function AdminBroadcastPage() {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Broadcast Notification</CardTitle>
          <CardDescription>
            Compose and send a notification to targeted users. Use sparingly to avoid notification fatigue.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <BroadcastNotificationForm />
        </CardContent>
      </Card>
    </div>
  );
}
