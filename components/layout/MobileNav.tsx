'use client';

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Logo } from '@/components/common/Logo';
import { SidebarNav } from './Sidebar/SidebarNav';
import { SidebarUser } from './Sidebar/SidebarUser';
import { useAuthStore } from '@/lib/stores/authStore';

interface MobileNavProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function MobileNav({ open, onOpenChange }: MobileNavProps) {
  const { user } = useAuthStore();

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left" className="flex w-64 flex-col p-0">
        <SheetHeader className="flex h-16 items-center border-b px-4">
          <SheetTitle>
            <Logo />
          </SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto p-4">
          <SidebarNav
            userRole={user?.role}
            onItemClick={() => onOpenChange(false)}
          />
        </div>

        <div className="border-t">
          <SidebarUser />
        </div>
      </SheetContent>
    </Sheet>
  );
}

export default MobileNav;
export { MobileNav };
