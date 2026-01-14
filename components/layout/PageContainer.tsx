import { cn } from '@/lib/utils';

interface PageContainerProps {
  children: React.ReactNode;
  /**
   * Layout variant:
   * - 'list': max-w-4xl (896px) - for list pages with cards
   * - 'detail': max-w-3xl (768px) - for detail/reading pages
   */
  variant?: 'list' | 'detail';
  className?: string;
}

const variantStyles = {
  list: 'max-w-4xl',
  detail: 'max-w-3xl',
};

function PageContainer({
  children,
  variant = 'list',
  className,
}: PageContainerProps) {
  return (
    <div className={cn('w-full mx-auto space-y-6', variantStyles[variant], className)}>
      {children}
    </div>
  );
}

export { PageContainer };
export type { PageContainerProps };
