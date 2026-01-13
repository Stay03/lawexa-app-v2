'use client';

import { cn } from '@/lib/utils';
import { Logo } from '@/components/common/Logo';
import { SidebarNav } from './SidebarNav';
import { SidebarUser } from './SidebarUser';
import { useAuthStore } from '@/lib/stores/authStore';

interface SidebarProps {
  className?: string;
}

function Sidebar({ className }: SidebarProps) {
  const { user } = useAuthStore();

  return (
    <aside
      className={cn(
        'flex h-screen w-64 flex-col border-r bg-card',
        className
      )}
    >
      {/* Logo */}
      <div className="flex h-16 items-center border-b px-4">
        <Logo />
      </div>

      {/* Navigation */}
      <div className="flex-1 overflow-y-auto p-4">
        <SidebarNav userRole={user?.role} />
      </div>

      {/* User section */}
      <div className="border-t">
        <SidebarUser />
      </div>
    </aside>
  );
}

export default Sidebar;
export { Sidebar };
