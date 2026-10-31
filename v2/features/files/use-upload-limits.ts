'use client';

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';

import { userLimitsQuery } from '@/v2/features/subscription/limits';
import { useV2Session } from '@/v2/runtime/session-context';
import { TODAY_UPLOAD_LIMITS, uploadLimitsFrom, type UploadLimits } from './upload-limits';

/**
 * The limits a file is checked against before it uploads: the person's own
 * (`GET /users/limits` → `uploads`, the same read the Usage screen and the
 * out-of-messages notice keep), or today's values for a guest, before the read
 * lands, and for an upload into a Space, whose own limits come from its
 * owner's plan once Arthur has set them (Backend f2eb6ff9).
 */
export function useUploadLimits({ inSpace }: { inSpace: boolean }): UploadLimits {
  const { userId: viewerId } = useV2Session();
  const limits = useQuery({
    ...userLimitsQuery({ viewerId }),
    enabled: viewerId !== null && !inSpace,
    select: (response) => response.data?.uploads ?? null,
  });
  const uploads = inSpace ? null : (limits.data ?? null);
  return useMemo(() => (uploads ? uploadLimitsFrom(uploads) : TODAY_UPLOAD_LIMITS), [uploads]);
}
