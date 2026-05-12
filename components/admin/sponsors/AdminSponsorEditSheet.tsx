'use client';

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { AdminSponsorForm } from './AdminSponsorForm';
import type { AdminSponsor } from '@/types/admin-sponsors';

interface AdminSponsorEditSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sponsor: AdminSponsor;
}

export function AdminSponsorEditSheet({
  open,
  onOpenChange,
  sponsor,
}: AdminSponsorEditSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Edit sponsor</SheetTitle>
          <SheetDescription>
            Update contact details, notes, or active status.
          </SheetDescription>
        </SheetHeader>
        <div className="mt-6">
          <AdminSponsorForm
            mode="edit"
            sponsor={sponsor}
            onSuccess={() => onOpenChange(false)}
            onCancel={() => onOpenChange(false)}
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}
