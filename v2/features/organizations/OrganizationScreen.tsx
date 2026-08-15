'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  BadgeCheck,
  Building2,
  Globe,
  Loader2,
  Mail,
  MapPin,
  MoreHorizontal,
  Pencil,
  Trash2,
  Users,
} from 'lucide-react';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useAuthStore } from '@/lib/stores/authStore';
import { extractApiError } from '@/lib/utils/api-error';
import { collabAccessState } from '@/v2/features/collab/model';
import { roleInRoster } from '@/v2/features/spaces/model';
import { useV2Session } from '@/v2/runtime/session-context';
import { useUrlOverlay } from '@/v2/runtime/use-url-overlay';
import { LIST_COLUMN } from '@/v2/shell/page-columns';
import { OrganizationFormDialog } from './OrganizationFormDialog';
import { OrganizationMembersSheet } from './OrganizationMembersSheet';
import { RequestVerificationDialog } from './RequestVerificationDialog';
import { VerificationPanel } from './VerificationPanel';
import { useDeleteOrganization } from './mutations';
import { organizationsQueries } from './queries';
import {
  NoOrganizationState,
  OrganizationErrorState,
  OrganizationScreenFrame,
} from './states';

/**
 * OrganizationScreen — the `/organization` client root (owner decision D7:
 * top-level, NOT under settings — v2 has no settings surface, and an
 * organization is a thing you visit rather than a preference you tune).
 *
 * ── FOUR ANSWERS, NOT THREE ────────────────────────────────────────────────
 * pending → the frame; error → the designed failure; `data: null` → "you're
 * not in an organization" with the create action; otherwise the organization.
 * That third answer is a REAL answer from `GET /my-organization`, which is why
 * it gets a designed panel rather than being folded into an empty state.
 *
 * ── GOVERNANCE COMES FROM THE ROSTER ───────────────────────────────────────
 * The organization payload carries no `my_role`, so the caller's rights are
 * read from the member roster — fetched alongside the organization, which also
 * warms the members sheet so opening it paints rows rather than a skeleton
 * (the feel directive). A roster that hasn't landed degrades to "no manage
 * actions", never to a button that 403s.
 *
 * Phase-5 W4, study A8 — 2026-08-04.
 */
export function OrganizationScreen() {
  const session = useV2Session();
  const viewerId = session.userId;
  const viewerUuid = useAuthStore((state) => state.user?.uuid ?? null);
  const eligible = collabAccessState(session) === 'eligible';

  // Frozen at mount for the relative verification dates (React Compiler lint).
  const [now] = useState(() => Date.now());

  /** Deliberately NOT in the URL: a link that re-opens "Delete this
   *  organization?" on every refresh is an armed trigger, and the dialog holds
   *  the server's sentence from the last failed attempt. */
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  /**
   * A verification request succeeded in this session. It is the ONLY way the
   * submitter can see the under-review panel: `verification_requested_at` is
   * admin-only and is stripped from their copy of the organization, so without
   * this the upload would close the dialog onto an unchanged "Get verified"
   * panel. Deliberately session-only — a reload falls back to what the server
   * can prove (see `model.ts`, and the backend ask recorded there).
   */
  const [justSubmittedVerification, setJustSubmittedVerification] = useState(false);

  /**
   * NOTHING IS PUBLISHED TO THE HEADER FROM HERE ANY MORE (phase 7).
   * "Organization" is a fact about the ADDRESS, stated once in
   * `v2/shell/pushed-route.ts` along with the way back this screen never had.
   * The ORGANIZATION'S OWN NAME stays in the page, where it is the first line of
   * an identity block that carries its type, its verification badge, its email
   * and where it is: a bar title would repeat the one fact and drop the rest.
   */

  const organizationQuery = useQuery({
    ...organizationsQueries.mine({ viewerId }),
    enabled: eligible,
  });
  const organization = organizationQuery.data?.data ?? null;

  const membersQuery = useQuery({
    ...organizationsQueries.members(organization?.uuid ?? '', { viewerId }),
    enabled: eligible && !!organization,
  });

  const deleteOrganization = useDeleteOrganization(organization?.uuid ?? '');

  // Governance comes from the roster (the payload carries no `my_role`).
  // Derived ABOVE the four-answer branches because the panel gate needs it and
  // hooks cannot run after a return.
  const myRole = roleInRoster(
    membersQuery.data?.data ?? organization?.members ?? [],
    viewerUuid,
  );
  const isOwner = myRole === 'owner';
  const canManage = isOwner || myRole === 'admin';

  /**
   * All four non-destructive overlays on this screen ride one `?panel=` key —
   * `create`, `edit`, `verify`, `members` — so Back closes whichever is open and
   * a refresh re-opens it.
   *
   * `canOpen` carries the same conditions the affordances do, so a copied
   * `?panel=edit` or `?panel=verify` link cannot hand a plain member the admin
   * forms the menu never offered. `create` is gated on there being NO
   * organization, which is also what retires the param when the create dialog's
   * whole branch disappears — an organization arriving from a background
   * refetch or another tab would otherwise leave `?panel=create` in the URL
   * with nothing bound to it. The map is `undefined` until the query settles,
   * so a deep link is never stripped on the strength of an unresolved answer.
   */
  const panel = useUrlOverlay('panel', {
    canOpen: organizationQuery.isSuccess
      ? {
          create: !organization,
          edit: canManage,
          verify: canManage,
          members: !!organization,
        }
      : undefined,
  });

  if (organizationQuery.isPending) {
    return <OrganizationScreenFrame />;
  }

  if (organizationQuery.isError) {
    const apiError = extractApiError(organizationQuery.error);
    return (
      <div className={LIST_COLUMN}>
        <OrganizationErrorState
          message={
            apiError.status >= 400 && apiError.status < 500
              ? apiError.message
              : undefined
          }
          onRetry={() => void organizationQuery.refetch()}
        />
      </div>
    );
  }

  if (!organization) {
    return (
      <div className={LIST_COLUMN}>
        <NoOrganizationState onCreate={() => panel.show('create')} />
        <OrganizationFormDialog
          key={panel.keyFor('create')}
          viewerId={viewerId}
          {...panel.bind('create')}
        />
      </div>
    );
  }

  const place = [organization.city, organization.country].filter(Boolean).join(', ');

  const handleDelete = () => {
    setDeleteError(null);
    deleteOrganization.mutate(undefined, {
      onSuccess: () => setDeleteOpen(false),
      onError: (error) => setDeleteError(extractApiError(error).message),
    });
  };

  return (
    <div className={LIST_COLUMN}>
      {/* ── Identity header ──────────────────────────────────────────────── */}
      <header className="flex items-start gap-3">
        {/* THE LOGO IS DELIBERATELY NOT RENDERED HERE. `logo_url` exists on the
            payload and the API has upload/delete routes, but this build has no
            upload affordance (v1 had none either), and `next/image` would
            refuse the remote URL — this app configures no `images.remotePatterns`
            at all. A raw `<img>` for a decorative mark is the wrong trade, so
            the identity tile stays the house glyph and the logo arrives with
            the upload flow that gives it a reason to exist. */}
        <span
          aria-hidden
          className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-secondary text-muted-foreground"
        >
          <Building2 className="size-5" />
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <h1 className="min-w-0 truncate text-2xl font-semibold tracking-tight text-foreground">
              {organization.name}
            </h1>
            <Badge variant="secondary">{organization.type_label}</Badge>
            {organization.is_verified && (
              <Badge className="gap-1 border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400">
                <BadgeCheck aria-hidden className="size-3.5" />
                Verified
              </Badge>
            )}
          </div>

          <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
            {organization.email && (
              <span className="inline-flex min-w-0 items-center gap-1.5">
                <Mail aria-hidden className="size-3.5 shrink-0" />
                <span className="truncate">{organization.email}</span>
              </span>
            )}
            {organization.website && (
              <a
                href={organization.website}
                target="_blank"
                rel="noreferrer"
                className="v2-interactive inline-flex items-center gap-1.5 rounded transition-colors duration-150 hover:text-foreground hover:underline motion-reduce:transition-none"
              >
                <Globe aria-hidden className="size-3.5 shrink-0" />
                Website
              </a>
            )}
            {place && (
              <span className="inline-flex min-w-0 items-center gap-1.5">
                <MapPin aria-hidden className="size-3.5 shrink-0" />
                <span className="truncate">{place}</span>
              </span>
            )}
          </div>

          {organization.description && (
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              {organization.description}
            </p>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="v2-interactive"
            onClick={() => panel.show('members')}
          >
            <Users aria-hidden className="size-4" />
            Members
          </Button>
          {canManage && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  className="v2-interactive size-8"
                  aria-label="Organization settings"
                >
                  <MoreHorizontal aria-hidden className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => panel.show('edit')}>
                  <Pencil aria-hidden className="size-4" />
                  Edit organization
                </DropdownMenuItem>
                {isOwner && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      variant="destructive"
                      onClick={() => {
                        setDeleteError(null);
                        setDeleteOpen(true);
                      }}
                    >
                      <Trash2 aria-hidden className="size-4" />
                      Delete organization
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </header>

      <div className="mt-5">
        <VerificationPanel
          organization={organization}
          canManage={canManage}
          now={now}
          justSubmitted={justSubmittedVerification}
          onRequest={() => panel.show('verify')}
        />
      </div>

      <OrganizationMembersSheet
        organization={organization}
        viewerId={viewerId}
        viewerUuid={viewerUuid}
        {...panel.bind('members')}
      />

      <OrganizationFormDialog
        key={panel.keyFor('edit')}
        organization={organization}
        viewerId={viewerId}
        {...panel.bind('edit')}
      />

      <RequestVerificationDialog
        key={panel.keyFor('verify')}
        organizationUuid={organization.uuid}
        organizationName={organization.name}
        viewerId={viewerId}
        onSubmitted={() => setJustSubmittedVerification(true)}
        {...panel.bind('verify')}
      />

      <AlertDialog
        open={deleteOpen}
        onOpenChange={(next) => {
          setDeleteOpen(next);
          if (!next) setDeleteError(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {organization.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This deletes the organization for everyone in it. Spaces it owns are
              not deleted — they simply stop belonging to an organization. It
              can&rsquo;t be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {deleteError && (
            <p role="alert" className="text-sm text-destructive">
              {deleteError}
            </p>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteOrganization.isPending}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                handleDelete();
              }}
              disabled={deleteOrganization.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteOrganization.isPending && (
                <Loader2 aria-hidden className="size-4 animate-spin" />
              )}
              Delete organization
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
