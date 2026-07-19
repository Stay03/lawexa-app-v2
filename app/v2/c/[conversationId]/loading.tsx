/**
 * Route-level loading UI for `/c/[conversationId]` (v2 convention: per-route
 * loading.tsx). Fills the shell content region with a transcript skeleton while the
 * server shell resolves the session — no text flash, geometry close to the real
 * transcript (skeleton-first standing rule).
 */
export default function Loading() {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-6" aria-hidden>
        <div className="flex justify-end">
          <div className="bg-muted h-10 w-2/3 animate-pulse rounded-3xl" />
        </div>
        <div className="space-y-2">
          <div className="bg-muted h-4 w-full animate-pulse rounded" />
          <div className="bg-muted h-4 w-11/12 animate-pulse rounded" />
          <div className="bg-muted h-4 w-4/5 animate-pulse rounded" />
        </div>
        <div className="flex justify-end">
          <div className="bg-muted h-10 w-1/2 animate-pulse rounded-3xl" />
        </div>
        <div className="space-y-2">
          <div className="bg-muted h-4 w-full animate-pulse rounded" />
          <div className="bg-muted h-4 w-3/4 animate-pulse rounded" />
        </div>
      </div>
    </div>
  );
}
