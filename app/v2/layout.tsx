import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

export const metadata: Metadata = {
  title: 'Lawexa v2 preview',
};

/**
 * Server shell for the hidden v2 tree. Intentionally minimal — it inherits the
 * root providers (theme, query, toaster) from `app/layout.tsx`. Real chrome
 * (nav, breadcrumbs) arrives in later phases.
 */
export default function V2Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  // The env kill switch only disables the proxy rewrite; without this guard the
  // /v2 tree would still be directly reachable by URL. Killed switch ⇒ 404,
  // so "rollback" truly means nothing v2 is visible.
  if (process.env.V2_ENABLED !== 'true') {
    notFound();
  }

  return (
    <div className="min-h-screen bg-background text-foreground">{children}</div>
  );
}
