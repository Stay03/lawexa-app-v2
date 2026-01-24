import { Logo } from '@/components/common/Logo';

export default function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background">
      {/* Minimal header with logo */}
      <header className="fixed top-0 left-0 right-0 z-50 flex h-16 items-center justify-center border-b bg-background/80 backdrop-blur-sm">
        <Logo size="md" />
      </header>

      {/* Main content with top padding for header */}
      <main className="pt-16">{children}</main>
    </div>
  );
}
