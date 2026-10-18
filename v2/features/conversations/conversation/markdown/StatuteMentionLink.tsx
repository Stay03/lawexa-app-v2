'use client';

import {
  Children,
  isValidElement,
  useState,
  useSyncExternalStore,
  type MouseEvent,
  type ReactNode,
} from 'react';
import { useRouter } from 'next/navigation';
import { ArrowUpRight, BookText, CornerDownRight } from 'lucide-react';

import { cn } from '@/lib/utils';
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from '@/components/ui/hover-card';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { formatProvisionLabel, parseProvisionSegment } from '@/v2/features/statutes/reader/provision';
import { useDocumentLinkHost } from './document-link-context';
import { statuteLinkTarget, type StatuteLinkTarget } from './document-links';
import { MENTION_CONTENT_WIDTH, MENTION_FOOTER_CLASS, MENTION_TRIGGER_CLASS } from './mention-styles';
import { usePointerCapability } from './use-pointer-capability';

/**
 * StatuteMentionLink — an answer's link to one of our statute pages (18
 * October 2026).
 *
 * IT STAYS IN THE APP (Stay, 14:32 UTC: a link to the same statute "reloads the
 * page"). A link to a part of the statute the page reads lands there in place
 * (`DocumentLinkHost.jump`), after the phone's full-screen chat closes; no
 * navigation runs, so the URL stays as it is, as with a Contents jump. Any other
 * statute link of ours is an in-app navigation; a modified click (a new tab) is
 * the browser's own.
 *
 * IT WEARS THE CASE BADGE AND ITS PANE (Arthur, 15:06 UTC), with the same
 * gestures: hover on a pointer device, a tap on touch, where the pane's own
 * button is the way on ("Go to section 18" on the statute's page, else "Open
 * statute"). The pane fetches nothing. On the statute's own page it reads the
 * part from the document already parsed there; for another statute it shows the
 * link's words and the part's number, because the statute's own read counts a
 * view and the part's read spends the reader's 10-a-minute statute allowance
 * (backend, 18 October 2026), and a hover must cost neither.
 *
 * WHOSE LINK IT IS depends on the page's origin, which the server cannot know:
 * the server and the first client render draw the relative and lawexa.com
 * forms, and an absolute link on the page's own origin becomes a badge once the
 * client knows it (`usePageOrigin`). A tap re-checks against the live origin.
 */

/** The page's origin: null on the server and through hydration, then the real one. */
function usePageOrigin(): string | null {
  return useSyncExternalStore(
    noSubscription,
    () => window.location.origin,
    () => null,
  );
}

function noSubscription() {
  return () => {};
}

/** The plain words of a link's children (markdown gives strings and inline elements). */
function nodeText(node: ReactNode): string {
  let text = '';
  Children.forEach(node, (child) => {
    if (typeof child === 'string' || typeof child === 'number') text += String(child);
    else if (isValidElement<{ children?: ReactNode }>(child)) text += nodeText(child.props.children);
  });
  return text.replace(/\s+/g, ' ').trim();
}

/** Where a statute link takes the reader: in place on its own statute, else an in-app navigation. */
function useStatuteGo(target: StatuteLinkTarget) {
  const router = useRouter();
  const host = useDocumentLinkHost();
  const onPage = host !== null && host.statuteSlug === target.slug;
  const hasPart = target.provision !== null || target.anchor !== null;
  const go = () => {
    if (onPage && hasPart) {
      host.beforeJump?.();
      if (host.jump(target)) return;
    }
    // The statute already on screen, with no part named: nothing to move to.
    if (onPage && !hasPart) return;
    router.push(target.href);
  };
  return { go, onPage, hasPart, host };
}

/** A plain left click goes in the app; anything modified is the browser's. */
function isPlainClick(event: MouseEvent<HTMLAnchorElement>): boolean {
  if (event.defaultPrevented || event.button !== 0) return false;
  return !(event.metaKey || event.ctrlKey || event.shiftKey || event.altKey);
}

/**
 * Any non-case link in an answer: a statute's badge when it is one of ours,
 * else react-markdown's default anchor, which still re-checks at the tap (an
 * absolute link on the page's origin, tapped before hydration settles).
 */
export function DocumentLink({ href, title, children }: { href?: string; title?: string; children: ReactNode }) {
  const origin = usePageOrigin();
  const target = statuteLinkTarget(href, origin);
  if (target) {
    return (
      <StatuteMention target={target} title={title}>
        {children}
      </StatuteMention>
    );
  }
  return (
    <PlainDocumentLink href={href} title={title}>
      {children}
    </PlainDocumentLink>
  );
}

function PlainDocumentLink({ href, title, children }: { href?: string; title?: string; children: ReactNode }) {
  const router = useRouter();
  return (
    <a
      href={href}
      title={title}
      onClick={(event) => {
        if (!isPlainClick(event)) return;
        const target = statuteLinkTarget(href, window.location.origin);
        if (!target) return;
        event.preventDefault();
        router.push(target.href);
      }}
    >
      {children}
    </a>
  );
}

function StatuteMention({
  target,
  title,
  children,
}: {
  target: StatuteLinkTarget;
  title?: string;
  children: ReactNode;
}) {
  const pointer = usePointerCapability();
  const { go } = useStatuteGo(target);
  const onClick = (event: MouseEvent<HTMLAnchorElement>) => {
    if (!isPlainClick(event)) return;
    event.preventDefault();
    go();
  };

  // Before the pointer type resolves (server, first client render): the badge
  // alone, which already goes in the app.
  if (pointer === null) {
    return (
      <a href={target.href} title={title} className={MENTION_TRIGGER_CLASS} onClick={onClick}>
        {children}
      </a>
    );
  }

  if (pointer === 'fine') {
    return (
      <HoverCard openDelay={350} closeDelay={250}>
        <HoverCardTrigger asChild>
          <a href={target.href} title={title} className={MENTION_TRIGGER_CLASS} onClick={onClick}>
            {children}
          </a>
        </HoverCardTrigger>
        <HoverCardContent side="top" align="start" className={cn(MENTION_CONTENT_WIDTH, 'gap-0 overflow-hidden p-0')}>
          <StatutePreview target={target} linkText={nodeText(children)} onGo={go} />
        </HoverCardContent>
      </HoverCard>
    );
  }

  return (
    <TouchStatutePopover target={target} title={title} onGo={go} linkText={nodeText(children)}>
      {children}
    </TouchStatutePopover>
  );
}

/** Touch: the tap opens the pane (as a case's does), and its button goes. */
function TouchStatutePopover({
  target,
  title,
  linkText,
  onGo,
  children,
}: {
  target: StatuteLinkTarget;
  title?: string;
  linkText: string;
  onGo: () => void;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <a
          href={target.href}
          title={title}
          className={MENTION_TRIGGER_CLASS}
          onClick={(event) => {
            if (!isPlainClick(event)) return;
            event.preventDefault();
            setOpen((previous) => !previous);
          }}
        >
          {children}
        </a>
      </PopoverTrigger>
      <PopoverContent
        side="top"
        align="start"
        collisionPadding={16}
        className={cn(MENTION_CONTENT_WIDTH, 'gap-0 overflow-hidden p-0 motion-reduce:animate-none!')}
      >
        <StatutePreview
          target={target}
          linkText={linkText}
          onGo={() => {
            setOpen(false);
            onGo();
          }}
        />
      </PopoverContent>
    </Popover>
  );
}

/**
 * The pane: the statute's name, the part ("Section 18 · Recovery of
 * premises") and its opening words, then the way on. On the statute's own page
 * all of it comes from the parsed document; elsewhere the name is the link's
 * own words and the part is its number alone.
 */
function StatutePreview({
  target,
  linkText,
  onGo,
}: {
  target: StatuteLinkTarget;
  linkText: string;
  onGo: () => void;
}) {
  const { onPage, hasPart, host } = useStatuteGo(target);
  const pageHost = onPage ? host : null;
  const peek = pageHost && hasPart ? pageHost.peek(target) : null;
  const cited = target.provision ? parseProvisionSegment(target.provision) : null;
  const label = peek?.label ?? (cited ? formatProvisionLabel(cited) : null);
  const name = pageHost ? pageHost.statuteTitle || linkText : linkText;
  const action = onPage
    ? hasPart && label
      ? `Go to ${label.charAt(0).toLowerCase()}${label.slice(1)}`
      : null
    : 'Open statute';

  return (
    <div className="flex flex-col motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200">
      <div className="flex flex-col gap-2 p-4">
        <h3 className="text-popover-foreground line-clamp-2 text-sm font-semibold leading-snug">
          {name || 'Statute'}
        </h3>
        {label ? (
          <div
            className={cn(
              'text-muted-foreground flex min-w-0 items-center gap-1.5 text-xs',
              peek?.text ? 'border-border border-b pb-2.5' : null,
            )}
          >
            <BookText aria-hidden className="size-3.5 shrink-0" />
            <span className="min-w-0 truncate">{peek?.heading ? `${label} · ${peek.heading}` : label}</span>
          </div>
        ) : null}
        {peek?.text ? (
          <p className="text-popover-foreground/90 max-h-[280px] overflow-y-auto overscroll-contain pr-1 text-[0.8125rem] leading-relaxed">
            {peek.text}
          </p>
        ) : null}
      </div>
      {action ? (
        <button type="button" onClick={onGo} className={MENTION_FOOTER_CLASS}>
          {action}
          {onPage ? (
            <CornerDownRight aria-hidden className="size-4 shrink-0" />
          ) : (
            <ArrowUpRight aria-hidden className="size-4 shrink-0" />
          )}
        </button>
      ) : null}
    </div>
  );
}
