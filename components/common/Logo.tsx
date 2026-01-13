import { cn } from '@/lib/utils';

interface LogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  showText?: boolean;
}

function Logo({ className, size = 'md', showText = true }: LogoProps) {
  const sizes = {
    sm: { icon: 'h-6 w-6', text: 'text-lg' },
    md: { icon: 'h-8 w-8', text: 'text-xl' },
    lg: { icon: 'h-10 w-10', text: 'text-2xl' },
  };

  return (
    <div className={cn('flex items-center gap-2', className)}>
      {/* Logo icon - scales icon */}
      <svg
        viewBox="0 0 32 32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={cn(sizes[size].icon, 'text-primary')}
      >
        <rect width="32" height="32" rx="8" fill="currentColor" />
        <path
          d="M8 8h4v16H8V8zm6 0h4v16h-4V8zm6 0h4v16h-4V8z"
          fill="white"
          opacity="0.9"
        />
      </svg>
      {showText && (
        <span className={cn('font-bold tracking-tight', sizes[size].text)}>
          Lawexa
        </span>
      )}
    </div>
  );
}

export default Logo;
export { Logo };
