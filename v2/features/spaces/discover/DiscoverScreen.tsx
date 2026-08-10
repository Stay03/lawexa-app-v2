'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Compass, Loader2, Search, Users } from 'lucide-react';
import { isAxiosError } from 'axios';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { SpaceCrest } from '@/v2/features/collab/kit/Crest';
import type { DiscoverableSpace } from '@/types/collab';
import { useDiscoverSpaces, useJoinPublicSpace } from '@/v2/features/invites/queries';

/**
 * DiscoverScreen — the public spaces anybody can find, and the way in.
 *
 * ── A GUEST MAY READ, AND MUST BE TOLD WHY THEY CANNOT JOIN ────────────────
 * @staynjokede's ruling: guests read public spaces and their open channels; an
 * account is needed to join and to write. So the list is shown to everybody and
 * the refusal is EXPLAINED rather than silent. A button that does nothing, or a
 * bare "403", teaches somebody that Lawexa is broken — the honest version says
 * what to do instead and offers it.
 *
 * The server decides, not us: `POST /spaces/{uuid}/join` answers `403` for a
 * guest, and that is the answer we translate. We do not try to work out
 * guest-ness here, for the same reason the invite page does not — a guest
 * carries a real sign-in.
 */

function SpaceRow({ space }: { space: DiscoverableSpace }) {
  const router = useRouter();
  const join = useJoinPublicSpace();
  const [refusal, setRefusal] = useState<string | null>(null);

  const press = () => {
    setRefusal(null);
    join.mutate(space.uuid, {
      onSuccess: () => router.push(`/spaces/${space.uuid}`),
      onError: (error) => {
        const status = isAxiosError(error) ? error.response?.status : undefined;
        setRefusal(
          status === 403
            ? 'You need a Lawexa account to join. You can keep reading without one.'
            : "That didn't work. Try again in a moment.",
        );
      },
    });
  };

  return (
    <li className="rounded-xl border border-border/60 p-4">
      <div className="flex min-w-0 items-start gap-3">
        <SpaceCrest uuid={space.uuid} name={space.name} type={space.type} size="md" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-semibold text-foreground">
            {space.name}
          </p>
          <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
            <Users aria-hidden className="size-3.5" />
            {space.active_members_count}{' '}
            {space.active_members_count === 1 ? 'person' : 'people'} · {space.type_label}
          </p>
          {space.description ? (
            <p className="mt-1.5 line-clamp-2 text-sm leading-relaxed text-muted-foreground">
              {space.description}
            </p>
          ) : null}
        </div>
      </div>

      <div className="mt-3">
        {space.is_member === true ? (
          <Button asChild variant="outline" size="sm" className="w-full">
            <Link href={`/spaces/${space.uuid}`}>Open</Link>
          </Button>
        ) : (
          <Button
            size="sm"
            className="w-full"
            disabled={join.isPending}
            onClick={press}
          >
            {join.isPending ? (
              <Loader2 aria-hidden className="size-4 animate-spin" />
            ) : null}
            Join
          </Button>
        )}
        {refusal ? (
          <p role="alert" className="mt-2 text-xs leading-relaxed text-muted-foreground">
            {refusal}{' '}
            <Link href="/register" className="font-medium text-primary underline">
              Create an account
            </Link>
          </p>
        ) : null}
      </div>
    </li>
  );
}

export function DiscoverScreen() {
  const [term, setTerm] = useState('');
  const query = useDiscoverSpaces({ search: term.trim() || undefined });
  const rows = query.data?.data ?? [];

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-6">
      <h1 className="flex items-center gap-2 text-2xl font-semibold text-foreground">
        <Compass aria-hidden className="size-6 text-primary" />
        Find a space
      </h1>
      <p className="mt-1.5 text-sm text-muted-foreground">
        Spaces anybody can find and join. Private ones never appear here.
      </p>

      <div className="relative mt-5">
        <Search
          aria-hidden
          className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          value={term}
          onChange={(event) => setTerm(event.target.value)}
          placeholder="Search by name"
          className="pl-9"
          aria-label="Search public spaces"
        />
      </div>

      <div className="mt-5">
        {query.isPending ? (
          <div className="space-y-3">
            <Skeleton className="h-28 w-full rounded-xl" />
            <Skeleton className="h-28 w-full rounded-xl" />
            <Skeleton className="h-28 w-full rounded-xl" />
          </div>
        ) : query.isError ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            Couldn&rsquo;t load spaces. Check your connection and try again.
          </p>
        ) : rows.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            {term.trim()
              ? `Nothing matches “${term.trim()}”.`
              : 'There are no public spaces yet.'}
          </p>
        ) : (
          <ul className="space-y-3">
            {rows.map((space) => (
              <SpaceRow key={space.uuid} space={space} />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
