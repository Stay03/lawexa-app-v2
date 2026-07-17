/**
 * Route-level loading boundary. Every v2 route ships loading + error boundaries
 * from file one — that convention is part of the skeleton.
 */
export default function V2Loading() {
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl items-center justify-center px-6 py-16">
      <p className="text-sm text-muted-foreground">Loading…</p>
    </main>
  );
}
