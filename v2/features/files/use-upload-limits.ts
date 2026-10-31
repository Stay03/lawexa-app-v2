'use client';

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';

import { spacesQueries } from '@/v2/features/spaces/queries';
import { userLimitsQuery } from '@/v2/features/subscription/limits';
import { useV2Session } from '@/v2/runtime/session-context';
import { spaceUploadLimitsFrom, TODAY_UPLOAD_LIMITS, uploadLimitsFrom, type UploadLimits } from './upload-limits';

/**
 * The limits a file is checked against before it uploads. The person's own
 * (`GET /users/limits` → `uploads`, the read the Usage screen and the
 * out-of-messages notice keep). For an upload into a space, that space's own
 * sizes from its owner's plan (`GET /spaces/{uuid}` → `upload_limits`, Backend
 * 2a209254, the detail the space's frame already holds), with the person's
 * own count of files per chat message. Today's values for a guest, before a
 * read lands, and for any field an older server does not send.
 */
export function useUploadLimits({ spaceUuid }: { spaceUuid: string | null }): UploadLimits {
  const { userId: viewerId } = useV2Session();
  const personal = useQuery({
    ...userLimitsQuery({ viewerId }),
    enabled: viewerId !== null,
    select: (response) => response.data?.uploads ?? null,
  });
  const space = useQuery({
    ...spacesQueries.detail(spaceUuid ?? '', { viewerId }),
    enabled: spaceUuid !== null,
    select: (response) => response.data?.upload_limits ?? null,
  });
  const uploads = personal.data ?? null;
  const spaceLimits = spaceUuid !== null ? (space.data ?? null) : null;
  return useMemo(() => {
    const own = uploads ? uploadLimitsFrom(uploads) : TODAY_UPLOAD_LIMITS;
    return spaceLimits ? spaceUploadLimitsFrom(spaceLimits, own) : own;
  }, [uploads, spaceLimits]);
}
