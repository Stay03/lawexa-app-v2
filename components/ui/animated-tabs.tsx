'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

interface Tab {
  value: string;
  label: React.ReactNode;
  icon?: React.ReactNode;
}

interface AnimatedTabsProps {
  tabs: Tab[];
  value: string;
  onValueChange: (value: string) => void;
  className?: string;
}

export function AnimatedTabs({
  tabs,
  value,
  onValueChange,
  className,
}: AnimatedTabsProps) {
  const [indicatorStyle, setIndicatorStyle] = React.useState({ left: 0, width: 0 });
  const tabRefs = React.useRef<(HTMLButtonElement | null)[]>([]);
  const containerRef = React.useRef<HTMLDivElement>(null);

  // Update indicator position when value changes
  React.useEffect(() => {
    const updateIndicator = () => {
      const activeIndex = tabs.findIndex((tab) => tab.value === value);
      const activeTab = tabRefs.current[activeIndex];
      const container = containerRef.current;

      if (activeTab && container) {
        const containerRect = container.getBoundingClientRect();
        const tabRect = activeTab.getBoundingClientRect();
        setIndicatorStyle({
          left: tabRect.left - containerRect.left,
          width: tabRect.width,
        });
      }
    };

    updateIndicator();
    // Also update on window resize
    window.addEventListener('resize', updateIndicator);
    return () => window.removeEventListener('resize', updateIndicator);
  }, [value, tabs]);

  return (
    <div
      ref={containerRef}
      className={cn(
        'relative inline-flex h-9 items-center rounded-4xl bg-muted p-[3px]',
        className
      )}
    >
      {/* Sliding indicator */}
      <div
        className="absolute h-[calc(100%-6px)] rounded-xl bg-background shadow-sm transition-all duration-300 ease-out"
        style={{
          left: indicatorStyle.left,
          width: indicatorStyle.width,
        }}
      />

      {/* Tab buttons */}
      {tabs.map((tab, index) => (
        <button
          key={tab.value}
          ref={(el) => {
            tabRefs.current[index] = el;
          }}
          type="button"
          onClick={() => onValueChange(tab.value)}
          className={cn(
            'relative z-10 inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-sm font-medium transition-colors',
            value === tab.value
              ? 'text-foreground'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          {tab.icon}
          <span className="truncate max-w-[120px] sm:max-w-none">{tab.label}</span>
        </button>
      ))}
    </div>
  );
}
