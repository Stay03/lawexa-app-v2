import { cache } from 'react';
import Link from 'next/link';
import type { Metadata } from 'next';
import { BadgeCheck, CircleSlash, SearchX, TriangleAlert } from 'lucide-react';

import { fetchCertificateVerification } from '@/lib/api/certificates-public';
import { formatCertificateDate, normalizeCertificateNumber } from '@/lib/certificates/model';
import type { VerificationOutcome } from '@/lib/certificates/model';
import type { CertificateVerification } from '@/types/certificates';

/**
 * `/verify/[number]`: confirms that a Lawexa certificate is genuine, for anyone
 * holding its number (Techlead e465210e; shapes agreed with WOZ, 11 November
 * 2026). The certificate PDF prints this address.
 *
 * A root route, like `app/quiz-results`: it is served to everybody, cookie or
 * not, signed in or not, and inherits no app chrome. It therefore imports only
 * the shared layers, never `v2/`.
 *
 * A server component: the check needs no session, so the page arrives as HTML.
 * Three answers, kept apart on purpose: found (valid or revoked), not found
 * (a 404), and "could not check" (anything else), because telling an employer
 * that a real certificate is not genuine is the worst mistake this page can make.
 *
 * It never shows an email; the server never sends one.
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

const loadVerification = cache(
  async (number: string): Promise<VerificationOutcome> => fetchCertificateVerification(segmentText(number)),
);

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { number } = await params;
  const outcome = await loadVerification(number);
  const shown = normalizeCertificateNumber(segmentText(number)) ?? 'Certificate';

  const description =
    outcome.kind === 'found' && outcome.certificate.valid
      ? `${outcome.certificate.printed_name}: ${outcome.certificate.programme}. A genuine certificate issued by Lawexa.`
      : 'Check that a Lawexa certificate is genuine.';

  return {
    title: `Verify ${shown}`,
    description,
    // A certificate number belongs to a person; it must not be searchable.
    robots: { index: false, follow: false },
  };
}

export default async function VerifyCertificatePage({ params }: PageProps) {
  const { number } = await params;
  const outcome = await loadVerification(number);
  const shown = normalizeCertificateNumber(segmentText(number));

  return (
    <main className="flex min-h-svh flex-col items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-md">
        {outcome.kind === 'found' ? (
          <FoundCard certificate={outcome.certificate} />
        ) : outcome.kind === 'not_found' ? (
          <MessageCard
            icon={<SearchX className="size-6" />}
            title="No certificate with this number"
            body={
              shown
                ? `Lawexa has not issued a certificate numbered ${shown}. Check the number on the certificate, letter by letter, and try the link again.`
                : 'This link does not contain a certificate number. Check the address printed on the certificate.'
            }
          />
        ) : (
          <MessageCard
            tone="alarm"
            icon={<TriangleAlert className="size-6" />}
            title="We couldn't check this certificate just now"
            body="This says nothing about whether it is genuine. Please reload the page in a minute."
          />
        )}
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

function FoundCard({ certificate }: { certificate: CertificateVerification }) {
  const eventDate = formatCertificateDate(certificate.event_date);
  const issuedDate = formatCertificateDate(certificate.issued_at);

  return (
    <section className="rounded-3xl border bg-card p-6 shadow-sm sm:p-8">
      {certificate.logos.length > 0 && (
        <ul className="mb-6 flex flex-wrap items-center justify-center gap-6" aria-label="Issued by">
          {certificate.logos.map((logo) => (
            <li key={logo.url}>
              {/* eslint-disable-next-line @next/next/no-img-element -- the API serves the logo; next/image would need its host configured */}
              <img src={logo.url} alt={logo.label} className="h-10 w-auto max-w-[9rem] object-contain" />
            </li>
          ))}
        </ul>
      )}

      {certificate.valid ? (
        <p className="flex items-center gap-2 rounded-2xl bg-emerald-500/10 px-4 py-3 text-sm font-medium text-emerald-700 dark:text-emerald-300">
          <BadgeCheck aria-hidden className="size-5 shrink-0" />
          Genuine certificate, issued by Lawexa
        </p>
      ) : (
        <p className="flex items-center gap-2 rounded-2xl bg-destructive/10 px-4 py-3 text-sm font-medium text-destructive">
          <CircleSlash aria-hidden className="size-5 shrink-0" />
          This certificate has been withdrawn and is no longer valid
        </p>
      )}

      <p className="mt-6 text-[0.6875rem] font-semibold tracking-[0.16em] text-muted-foreground uppercase">Awarded to</p>
      <h1 className="mt-1 font-fraunces text-2xl leading-tight font-semibold text-balance text-foreground sm:text-3xl">
        {certificate.printed_name}
      </h1>

      <dl className="mt-6 grid gap-4 text-sm">
        <Detail label="Programme" value={certificate.programme} />
        {certificate.partner_name && <Detail label="In partnership with" value={certificate.partner_name} />}
        {eventDate && <Detail label="Date" value={eventDate} />}
        {issuedDate && <Detail label="Issued" value={issuedDate} />}
        <Detail label="Certificate number" value={certificate.number} mono />
      </dl>
    </section>
  );
}

function Detail({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={mono ? 'mt-0.5 font-mono tabular-nums text-foreground' : 'mt-0.5 text-pretty text-foreground'}>
        {value}
      </dd>
    </div>
  );
}

function MessageCard({
  icon,
  title,
  body,
  tone = 'quiet',
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
  tone?: 'quiet' | 'alarm';
}) {
  return (
    <section className="rounded-3xl border bg-card p-8 text-center shadow-sm">
      <span
        aria-hidden
        className={
          tone === 'alarm'
            ? 'mx-auto flex size-12 items-center justify-center rounded-2xl bg-destructive/10 text-destructive'
            : 'mx-auto flex size-12 items-center justify-center rounded-2xl bg-secondary text-muted-foreground'
        }
      >
        {icon}
      </span>
      <h1 className="mt-4 font-fraunces text-xl font-semibold text-foreground">{title}</h1>
      <p className="mx-auto mt-2 max-w-xs text-sm leading-relaxed text-pretty text-muted-foreground">{body}</p>
    </section>
  );
}
