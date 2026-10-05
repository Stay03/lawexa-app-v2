import { Building2, Check, Mail } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { ENTERPRISE_EMAIL, ENTERPRISE_LINES, ENTERPRISE_SUBTITLE, ENTERPRISE_TITLE } from './model';

/**
 * The Enterprise tab: v1's Enterprise card (`app/(main)/pricing/page.tsx`),
 * word for word, set as a section rather than a lone card. The name and the
 * sentence lead; v1's four lines sit as a two-by-two list under them; the way
 * to ask (v1's "Contact Sales" mail button, with the address written out so
 * it can be copied) closes the section on its own row.
 */
export function EnterprisePanel() {
  return (
    <section
      aria-labelledby="enterprise-title"
      className="overflow-hidden rounded-2xl bg-card ring-1 ring-foreground/10"
    >
      <div className="flex flex-col gap-8 p-6 sm:p-10">
        <div className="flex flex-col gap-4">
          <span
            aria-hidden
            className="flex size-12 items-center justify-center rounded-xl bg-primary/10 text-primary"
          >
            <Building2 className="size-6" />
          </span>
          <div className="flex flex-col gap-2">
            <h2 id="enterprise-title" className="pricing-heading text-3xl text-foreground">
              {ENTERPRISE_TITLE}
            </h2>
            <p className="max-w-prose text-base leading-relaxed text-muted-foreground">{ENTERPRISE_SUBTITLE}</p>
          </div>
        </div>

        <ul className="grid gap-x-8 gap-y-4 @2xl/pricing:grid-cols-2">
          {ENTERPRISE_LINES.map((line) => (
            <li key={line} className="flex items-start gap-3 text-[15px] leading-snug text-foreground">
              <Check aria-hidden className="mt-0.5 size-4 shrink-0 text-primary" />
              {line}
            </li>
          ))}
        </ul>
      </div>

      <div className="flex flex-col gap-3 border-t border-foreground/10 bg-secondary/60 px-6 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-10">
        <p className="text-sm font-medium text-foreground select-all">{ENTERPRISE_EMAIL}</p>
        <Button asChild className="h-11 md:h-10">
          <a href={`mailto:${ENTERPRISE_EMAIL}`}>
            <Mail aria-hidden />
            Contact Sales
          </a>
        </Button>
      </div>
    </section>
  );
}
