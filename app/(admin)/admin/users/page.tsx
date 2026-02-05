'use client';

import Link from 'next/link';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Users, MessageSquare, ArrowRight } from 'lucide-react';

export default function AdminUsersPage() {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-muted-foreground" />
            <CardTitle>User Management</CardTitle>
          </div>
          <CardDescription>
            View and manage user accounts, their conversations, and token usage
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Info Section */}
          <div className="rounded-lg border bg-muted/50 p-4">
            <h3 className="font-medium mb-2">How to Access User Details</h3>
            <p className="text-sm text-muted-foreground mb-4">
              To view a user&apos;s details, you can access them in the following ways:
            </p>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex items-start gap-2">
                <span className="font-mono text-primary bg-primary/10 px-1.5 py-0.5 rounded text-xs">1</span>
                <span>
                  <strong>From Conversations:</strong> Go to the Conversations page and click on any
                  user UUID in the table. This will take you to that user&apos;s conversations.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="font-mono text-primary bg-primary/10 px-1.5 py-0.5 rounded text-xs">2</span>
                <span>
                  <strong>Direct URL:</strong> If you know the user&apos;s UUID, you can navigate directly
                  to <code className="bg-muted px-1 py-0.5 rounded text-xs">/admin/users/[uuid]</code>
                </span>
              </li>
            </ul>
          </div>

          {/* Quick Actions */}
          <div>
            <h3 className="font-medium mb-3">Quick Actions</h3>
            <div className="grid gap-4 md:grid-cols-2">
              <Link href="/admin/conversations">
                <Card className="hover:bg-muted/50 transition-colors cursor-pointer">
                  <CardContent className="flex items-center gap-4 p-4">
                    <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <MessageSquare className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1">
                      <h4 className="font-medium">View All Conversations</h4>
                      <p className="text-sm text-muted-foreground">
                        Browse conversations and click on user UUIDs to view user details
                      </p>
                    </div>
                    <ArrowRight className="h-5 w-5 text-muted-foreground" />
                  </CardContent>
                </Card>
              </Link>
            </div>
          </div>

          {/* User Details Info */}
          <div className="rounded-lg border p-4">
            <h3 className="font-medium mb-2">What You Can See</h3>
            <div className="grid gap-4 md:grid-cols-3 text-sm">
              <div>
                <h4 className="font-medium text-primary mb-1">User Profile</h4>
                <ul className="space-y-1 text-muted-foreground">
                  <li>Name and email</li>
                  <li>Role and verification status</li>
                  <li>Professional information</li>
                  <li>Location details</li>
                  <li>Education and bar info</li>
                  <li>Areas of expertise</li>
                </ul>
              </div>
              <div>
                <h4 className="font-medium text-primary mb-1">Conversations</h4>
                <ul className="space-y-1 text-muted-foreground">
                  <li>All user conversations</li>
                  <li>Filter by status</li>
                  <li>Sort by date or title</li>
                  <li>View conversation details</li>
                  <li>Message history</li>
                </ul>
              </div>
              <div>
                <h4 className="font-medium text-primary mb-1">Token Usage</h4>
                <ul className="space-y-1 text-muted-foreground">
                  <li>Usage summary</li>
                  <li>Group by day/week/month</li>
                  <li>Group by agent</li>
                  <li>Group by conversation</li>
                  <li>Date range filtering</li>
                  <li>Cost tracking</li>
                </ul>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
