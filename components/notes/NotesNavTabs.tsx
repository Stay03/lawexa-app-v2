'use client';

import { useRouter } from 'next/navigation';
import { TrendingUp, FileText, ShoppingBag } from 'lucide-react';
import { AnimatedTabs } from '@/components/ui/animated-tabs';

type NotesTab = 'library' | 'mine' | 'purchases';

interface NotesNavTabsProps {
  activeTab: NotesTab;
}

const navTabs = [
  { value: 'library', label: 'Library', icon: <TrendingUp className="h-4 w-4" /> },
  { value: 'mine', label: 'My Notes', icon: <FileText className="h-4 w-4" /> },
  { value: 'purchases', label: 'Purchased', icon: <ShoppingBag className="h-4 w-4" /> },
];

function getRouteForTab(tab: string): string {
  switch (tab) {
    case 'mine':
      return '/notes/mine';
    case 'purchases':
      return '/notes/purchases';
    default:
      return '/notes';
  }
}

function NotesNavTabs({ activeTab }: NotesNavTabsProps) {
  const router = useRouter();

  const handleTabChange = (value: string) => {
    router.push(getRouteForTab(value));
  };

  return (
    <AnimatedTabs
      tabs={navTabs}
      value={activeTab}
      onValueChange={handleTabChange}
    />
  );
}

export { NotesNavTabs };
export type { NotesTab };
