import { Skeleton } from '@/components/ui/skeleton';

/**
 * The share card's shape while its one upstream read is in flight.
 *
 * IT EARNS ITS PLACE EVEN THOUGH NOTHING IN THE APP NAVIGATES HERE. This page
 * is opened by a pasted link, so the reader is nearly always on a cold document
 * load — and with this boundary Next flushes the shell immediately and streams
 * the card in behind it, instead of holding a blank response for as long as the
 * API takes. On a phone on mobile data that is the difference between a card
 * that appears and a tab that looks broken.
 *
 * Geometry, not decoration: every block below stands where a real one will, so
 * nothing jumps when the answer lands.
 */
export default function Loading() {
  return (
    <main className="flex min-h-svh flex-col items-center justify-center px-5 py-10">
      <div aria-hidden className="w-full max-w-sm">
        <section className="rounded-3xl border bg-card p-6 shadow-sm sm:p-8">
          <Skeleton className="h-3 w-24 rounded" />
          <Skeleton className="mt-3 h-7 w-3/4 rounded" />
          <Skeleton className="mt-3 h-4 w-2/3 rounded" />

          <div className="mt-6 flex flex-col items-center gap-3 rounded-2xl border px-4 py-6">
            <Skeleton className="size-16 rounded-full" />
            <Skeleton className="h-4 w-32 rounded" />
            <Skeleton className="h-9 w-28 rounded" />
            <Skeleton className="h-3 w-14 rounded" />
          </div>

          <div className="mt-3 flex flex-col gap-1.5">
            {[0, 1].map((index) => (
              <Skeleton
                key={index}
                className="h-11 rounded-xl"
                style={{ opacity: index === 0 ? 1 : 0.55 }}
              />
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
