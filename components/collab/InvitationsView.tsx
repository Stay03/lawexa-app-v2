'use client';

import type { ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import {
  Briefcase,
  Building2,
  GraduationCap,
  Hash,
  Lock,
  MailOpen,
} from 'lucide-react';
import { toast } from 'sonner';

import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { PageContainer, PageHeader } from '@/components/layout';
import { Skeleton } from '@/components/ui/skeleton';
import {
  useAcceptChannelInvitation,
  useAcceptOrganizationInvitation,
  useAcceptSpaceInvitation,
  useChannelInvitations,
  useDeclineChannelInvitation,
  useDeclineSpaceInvitation,
  useOrganizationInvitations,
  useRejectOrganizationInvitation,
  useSpaceInvitations,
} from '@/lib/hooks/useCollab';
import { extractApiError } from '@/lib/utils/api-error';
import type {
  ChannelInvitation,
  OrganizationInvitation,
  SpaceInvitation,
} from '@/types/collab';

import { InvitationCard } from './InvitationCard';

function Section({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-2">
      <h2 className="text-sm font-semibold text-muted-foreground">{label}</h2>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

/** Unified inbox for pending organization, space and channel invitations. */
export function InvitationsView() {
  const router = useRouter();

  const channelsQuery = useChannelInvitations();
  const spacesQuery = useSpaceInvitations();
  const orgsQuery = useOrganizationInvitations();

  const acceptChannel = useAcceptChannelInvitation();
  const declineChannel = useDeclineChannelInvitation();
  const acceptSpace = useAcceptSpaceInvitation();
  const declineSpace = useDeclineSpaceInvitation();
  const acceptOrg = useAcceptOrganizationInvitation();
  const rejectOrg = useRejectOrganizationInvitation();

  const channels = channelsQuery.data?.data ?? [];
  const spaces = spacesQuery.data?.data ?? [];
  const organizations = orgsQuery.data?.data ?? [];

  const isLoading =
    channelsQuery.isLoading || spacesQuery.isLoading || orgsQuery.isLoading;
  const isError =
    channelsQuery.isError && spacesQuery.isError && orgsQuery.isError;
  const total = channels.length + spaces.length + organizations.length;

  const withError = (label: string, fn: () => Promise<unknown>) => async () => {
    try {
      await fn();
    } catch (error) {
      toast.error(label, { description: extractApiError(error).message });
    }
  };

  const acceptChannelInvite = (invitation: ChannelInvitation) =>
    withError('Could not accept invitation', async () => {
      await acceptChannel.mutateAsync(invitation.id);
      toast.success(`Joined #${invitation.channel.name}`);
      router.push(`/channels/${invitation.channel.uuid}`);
    });

  const acceptSpaceInvite = (invitation: SpaceInvitation) =>
    withError('Could not accept invitation', async () => {
      await acceptSpace.mutateAsync(invitation.id);
      toast.success(`Joined ${invitation.space.name}`);
      router.push(`/spaces/${invitation.space.uuid}`);
    });

  const acceptOrgInvite = (invitation: OrganizationInvitation) =>
    withError('Could not accept invitation', async () => {
      await acceptOrg.mutateAsync(invitation.id);
      toast.success(`Joined ${invitation.organization.name}`);
    });

  const renderContent = () => {
    if (isLoading) {
      return (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-28 w-full rounded-xl" />
          ))}
        </div>
      );
    }

    if (isError) {
      return (
        <ErrorState
          title="Couldn't load invitations"
          description="We couldn't load your invitations. Please try again."
          retry={() => {
            channelsQuery.refetch();
            spacesQuery.refetch();
            orgsQuery.refetch();
          }}
        />
      );
    }

    if (total === 0) {
      return (
        <EmptyState
          icon={MailOpen}
          title="No pending invitations"
          description="Invitations to organizations, spaces and channels will show up here."
        />
      );
    }

    return (
      <div className="space-y-6">
        {organizations.length > 0 && (
          <Section label="Organizations">
            {organizations.map((invitation) => (
              <InvitationCard
                key={`org-${invitation.id}`}
                icon={Building2}
                title={invitation.organization.name}
                subtitle={invitation.organization.type_label}
                roleLabel={invitation.role_label}
                invitedBy={invitation.invited_by}
                onAccept={acceptOrgInvite(invitation)}
                onDecline={withError('Could not decline invitation', () =>
                  rejectOrg.mutateAsync(invitation.id)
                )}
              />
            ))}
          </Section>
        )}

        {spaces.length > 0 && (
          <Section label="Spaces">
            {spaces.map((invitation) => (
              <InvitationCard
                key={`space-${invitation.id}`}
                icon={invitation.space.type === 'study' ? GraduationCap : Briefcase}
                title={invitation.space.name}
                subtitle={invitation.space.description ?? undefined}
                roleLabel={invitation.role_label}
                invitedBy={invitation.invited_by}
                onAccept={acceptSpaceInvite(invitation)}
                onDecline={withError('Could not decline invitation', () =>
                  declineSpace.mutateAsync(invitation.id)
                )}
              />
            ))}
          </Section>
        )}

        {channels.length > 0 && (
          <Section label="Channels">
            {channels.map((invitation) => (
              <InvitationCard
                key={`channel-${invitation.id}`}
                icon={invitation.channel.visibility === 'private' ? Lock : Hash}
                title={`#${invitation.channel.name}`}
                subtitle={`in ${invitation.channel.space.name}`}
                roleLabel={invitation.role_label}
                invitedBy={invitation.invited_by}
                onAccept={acceptChannelInvite(invitation)}
                onDecline={withError('Could not decline invitation', () =>
                  declineChannel.mutateAsync(invitation.id)
                )}
              />
            ))}
          </Section>
        )}
      </div>
    );
  };

  return (
    <PageContainer>
      <PageHeader
        title="Invitations"
        description="Respond to invitations to organizations, spaces and channels."
      />
      {renderContent()}
    </PageContainer>
  );
}
