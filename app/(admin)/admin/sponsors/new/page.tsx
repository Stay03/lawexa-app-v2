'use client';

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { AdminSponsorForm } from '@/components/admin/sponsors/AdminSponsorForm';

export default function CreateSponsorPage() {
  return (
    <div className="space-y-6">
      <Link href="/admin/sponsors">
        <Button variant="ghost" size="sm">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Sponsors
        </Button>
      </Link>

      <div>
        <h1 className="text-2xl font-semibold tracking-tight">New sponsor</h1>
        <p className="text-sm text-muted-foreground">
          Register an organization that will sponsor subscriptions for students.
        </p>
      </div>

      <AdminSponsorForm mode="create" />
    </div>
  );
}
