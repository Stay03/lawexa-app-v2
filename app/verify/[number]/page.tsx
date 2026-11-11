import Link from 'next/link';
import type { Metadata } from 'next';

import { VerifyCertificate } from '@/components/certificates/VerifyCertificate';
import { normalizeCertificateNumber } from '@/lib/certificates/model';

/**
 * `/verify/[number]`: confirms that a Lawexa certificate is genuine, for anyone
 * holding its number (Techlead e465210e; shapes agreed with WOZ, 11 November
 * 2026). The certificate PDF prints this address.
 *
 * A root route, like `app/quiz-results`: it is served to everybody, cookie or
 * not, signed in or not, and inherits no app chrome. It therefore imports only
 * the shared layers, never `v2/`.
 *
 * The server draws the shell only. The check runs in the visitor's browser
 * (`VerifyCertificate`), so each visitor has their own rate limit at the API
 * instead of everyone sharing the Next server's one address (Techlead 113d06a1).
 * The metadata therefore names no person.
 */

interface PageProps {
  params: Promise<{ number: string }>;
}

/** The segment as typed. A stray `%` must not throw inside a public render. */
function segmentText(segment: string): string {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { number } = await params;
  const shown = normalizeCertificateNumber(segmentText(number));
  return {
    title: shown ? `Verify certificate ${shown}` : 'Verify a certificate',
    description: 'Check that a Lawexa certificate is genuine.',
    // A certificate number belongs to a person; it must not be searchable.
    robots: { index: false, follow: false },
  };
}

export default async function VerifyCertificatePage({ params }: PageProps) {
  const { number } = await params;

  return (
    <main className="flex min-h-svh flex-col items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-md">
        <VerifyCertificate rawNumber={segmentText(number)} />
        <p className="mt-5 text-center text-xs text-muted-foreground">
          <Link
            href="/"
            className="underline-offset-4 transition-colors duration-150 hover:text-foreground hover:underline motion-reduce:transition-none"
          >
            Certificates issued by Lawexa
          </Link>
        </p>
      </div>
    </main>
  );
}
