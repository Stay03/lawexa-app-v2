export default function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background">
      {/* Main content - no header, content starts from top */}
      <main>{children}</main>
    </div>
  );
}
