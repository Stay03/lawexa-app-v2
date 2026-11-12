'use client';

import { readCertificateOffer } from '@/lib/certificates/model';
import { CertificateReadyNote, ConfirmNameCard } from './ConfirmNameCard';

/**
 * What the end of a quiz shows about its certificate: the name prompt, a note
 * that it is already issued, or nothing. `raw` is the server's `certificate`
 * field as it arrived; anything unusable shows nothing, and the certificates
 * page and the notification remain the way back.
 */
export function CertificateOffer({ raw }: { raw: unknown }) {
  const offer = readCertificateOffer(raw);
  if (!offer) return null;
  if (offer.state === 'needs_name' && offer.pending_uuid) {
    return (
      <ConfirmNameCard
        key={offer.pending_uuid}
        pendingUuid={offer.pending_uuid}
        programme={offer.programme}
        suggestedName={offer.suggested_name}
      />
    );
  }
  if (offer.state === 'issued' && offer.number) {
    return <CertificateReadyNote programme={offer.programme} number={offer.number} />;
  }
  return null;
}
