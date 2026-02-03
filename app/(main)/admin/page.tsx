'use client';

import { Card, CardContent } from '@/components/ui/card';
import {
  LayoutDashboard,
  Users,
  MessageSquare,
  BarChart3,
  Clock,
} from 'lucide-react';

const upcomingFeatures = [
  {
    icon: BarChart3,
    title: 'Platform Analytics',
    description: 'Usage metrics, user engagement, and performance insights',
  },
  {
    icon: Users,
    title: 'User Management',
    description: 'Manage user accounts, roles, and permissions',
  },
  {
    icon: MessageSquare,
    title: 'Conversation Insights',
    description: 'Advanced analytics on conversation patterns and topics',
  },
];

export default function AdminDashboardPage() {
  return (
    <div className="space-y-6">
      {/* Coming Soon Hero */}
      <Card className="border-dashed">
        <CardContent className="py-12 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
            <LayoutDashboard className="h-8 w-8 text-muted-foreground" />
          </div>
          <h2 className="text-xl font-semibold mb-2">Dashboard Coming Soon</h2>
          <p className="text-muted-foreground max-w-md mx-auto">
            We&apos;re building a comprehensive admin dashboard with analytics,
            insights, and management tools.
          </p>
        </CardContent>
      </Card>

      {/* Upcoming Features */}
      <div>
        <h3 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
          <Clock className="h-4 w-4" />
          Upcoming Features
        </h3>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {upcomingFeatures.map((feature) => {
            const Icon = feature.icon;
            return (
              <Card key={feature.title} className="border-dashed opacity-75">
                <CardContent className="pt-6">
                  <Icon className="h-5 w-5 text-muted-foreground mb-3" />
                  <h4 className="font-medium mb-1">{feature.title}</h4>
                  <p className="text-sm text-muted-foreground">
                    {feature.description}
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}
