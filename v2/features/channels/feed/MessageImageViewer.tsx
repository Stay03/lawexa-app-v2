'use client';

import { useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { useMutation } from '@tanstack/react-query';
import {
  ChevronLeft,
  ChevronRight,
  Download,
  ExternalLink,
  ImageOff,
  Loader2,
  SearchX,
  X,
} from 'lucide-react';

import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogDescription,
  DialogOverlay,
  DialogPortal,
  DialogSurface,
  DialogTitle,
} from '@/components/ui/dialog';
import { filesApi } from '@/lib/api/files';
import { formatBytes } from '@/lib/utils/format-bytes';
import type { Message, MessageAttachment } from '@/types/collab';
import { useHeldValue } from '../use-held-value';
import { formatImageTarget, resolveImageSet, type ImageSet } from './image-target';
import { useFreshFileUrl, useOpenFileInNewTab } from './use-file-url';

/**
 * MessageImageViewer — a picture opens IN the conversation, over it.
 *
 * WHY IT EXISTS (owner, 2026-08-06): "when i click on these images in channels
 * it take me to new tab thats not good ui/ux." Tapping a photo used to mint a
 * signed URL and hand it to `window.open`, which throws the reader out of the
 * room they were reading. That is the right answer for a PDF — a document
 * belongs in a tab — and the wrong one for a picture, which is part of the
 * message. Documents are untouched; only `image/*` gets this.
 *
 * ── BACK CLOSES IT, BECAUSE IT IS IN THE URL ──────────────────────────────
 * The viewer is one value of `?image=` on the shared {@link useUrlOverlay}, so
 * OPENING pushes exactly one history entry and Back removes it — on a phone,
 * where Back is the universal dismiss, that is the gesture readers will reach
 * for first. Escape and a tap on the dark ground go through the same `close()`,
 * so all three land the reader exactly where they were, mid-conversation, with
 * the feed's scroll untouched (the feed never unmounted).
 *
 * MOVING BETWEEN PICTURES REPLACES rather than pushes, so the whole visit costs
 * ONE entry however far the reader swipes. Back leaves the viewer; it never
 * walks back through five photos first. Same contract as the Lawexa sessions
 * sheet's `ai` / `ai:{uuid}` pair, and for the same reason.
 *
 * ── THE SET IS THE MESSAGE, NOT THE CHANNEL ───────────────────────────────
 * `?image={messageUuid}:{attachmentId}` (see `./image-target.ts` for why that
 * encoding). Swiping moves between the pictures of THAT message, because that
 * is what the reader tapped into and it is the only set whose edges they can
 * see. A channel-wide reel would silently pull in photos from conversations
 * they had scrolled past.
 *
 * ── IT NEVER FOLLOWS A LINK THAT HAS EXPIRED ──────────────────────────────
 * A signed URL lasts ONE HOUR. Each frame paints from the row's `url`, and an
 * `onError` — the shape an expiry takes in an `<img>` — mints a fresh one and
 * retries ONCE per failure, re-arming on every successful paint so a tab left
 * open for three hours recovers three times. That is the tile's rule, applied
 * per frame. The two do NOT share state: the viewer owns its own `src` and its
 * own retry budget, so opening a picture can never disturb the tile behind it,
 * and the worst case is one extra mint on a picture whose tile had already
 * refreshed. What IS shared, between the frames, is the RESULT: a minted URL is
 * remembered by this component for as long as the reader stays in the channel,
 * so a picture that scrolls out of the three-frame render window and comes back
 * does not pay for the mint twice. Nothing is written back into the message
 * cache; a refetched page legitimately carries the ORIGINAL signed URL, and
 * storing a minted one would only be overwritten by it.
 *
 * ── SWIPE AND PINCH DO NOT FIGHT, BECAUSE THE PLATFORM SEPARATES THEM ─────
 * The frame carries `touch-action: pinch-zoom`. That hands the BROWSER every
 * multi-finger gesture — real pinch zoom, no library, no matrix maths — and
 * hands US the single finger, because no `pan-*` value is listed, so the
 * browser will never claim a one-finger drag as a scroll. When a second finger
 * lands mid-drag the engine takes the gesture and fires `pointercancel`, which
 * this abandons the swipe on: the platform arbitrates, and no finger counting
 * is needed. (Radix's own overlay wraps the dialog in `RemoveScroll` with
 * `allowPinchZoom`, and a gesture the browser has already claimed produces
 * non-cancelable touch events anyway — verified in
 * `react-remove-scroll@2.7.2`, `@radix-ui/react-dialog@1.1.15`.)
 *
 * WHILE ZOOMED, THE SWIPE STANDS DOWN AND PANNING TAKES OVER. A drag on a
 * zoomed photo means "move the photo", never "next photo" — so the frame
 * switches to `touch-action: manipulation` (pan + pinch) and the swipe refuses
 * to arm. The zoom level is read from `visualViewport.scale` through
 * `useSyncExternalStore`, so it is a real subscription and not a poll.
 *
 * KNOWN COST OF USING THE PLATFORM, stated rather than hidden: browser pinch
 * zoom is PAGE zoom, and no API can put it back. A reader who zooms into a
 * photo and closes the viewer is left on a zoomed page and has to pinch out.
 * The alternative is a hand-written zoom/pan implementation — several hundred
 * lines of gesture maths to reproduce something every engine already does
 * better — and that trade was not worth making for this.
 *
 * ── IT IS DARK IN BOTH THEMES ─────────────────────────────────────────────
 * A photograph is judged against black, so this surface does not follow the
 * theme and does not use the theme's foreground tokens; gold stays the accent
 * for focus and for the current-picture dot.
 */

/* ── The ground ────────────────────────────────────────────────────────────
      The dark space AROUND the picture, and the only thing a tap dismisses on.
      It is MARKED rather than inferred: the strip, each frame, and the box the
      picture is centred in carry the attribute, and nothing else inside the
      strip does. See {@link isGround} for the two traps that shape entails. */
const GROUND_ATTRIBUTE = 'data-viewer-ground';
const GROUND = { [GROUND_ATTRIBUTE]: '' };

/**
 * Did this press land on the ground, rather than on something?
 *
 * IT USED TO READ "the target is not an `<img>`", which quietly made every
 * other thing inside the strip ground too — including the "Open original"
 * button on a frame that failed to load. Pressing it dismissed the viewer under
 * the reader's finger and took the recovery it was offering away with it.
 *
 * AND IT IS DECIDED AT THE PRESS, NOT AT THE RELEASE, because
 * `setPointerCapture` retargets every later pointer event to the capturing
 * element: on `pointerup` the target is the strip, which is ground, so a
 * release-time reading would dismiss on every single tap.
 */
function isGround(target: EventTarget | null): boolean {
  return target instanceof Element && target.hasAttribute(GROUND_ATTRIBUTE);
}

/** Beyond this, a press is a gesture and its release must not dismiss. */
const TAP_SLOP_PX = 8;
/** Beyond this — and more horizontal than vertical — a drag is a page turn. */
const SWIPE_ARM_PX = 14;
/** A page turn commits past this share of the frame… */
const SWIPE_COMMIT_RATIO = 0.18;
/** …with this floor, so a flick on a narrow phone still counts. */
const SWIPE_COMMIT_MIN_PX = 56;
/** Drag past the first or last picture is damped, so the end is felt. */
const END_RESISTANCE = 0.3;
/** `visualViewport.scale` is not exactly 1 on every device at rest. */
const ZOOM_EPSILON = 1.05;
/** Long enough to read as movement, short enough not to be waited on. */
const SLIDE_MS = 200;
/** How long a blob download URL is kept alive after the anchor is clicked.
 *  Revoking in the same task aborts the save on some engines. */
const BLOB_RELEASE_MS = 1000;

/* ── The strip's three knobs ───────────────────────────────────────────────
      `--v2-image-i` is the SETTLED index and React owns it; the other two are
      written straight to the DOM during a drag, because a pointermove that
      re-rendered the transcript's overlay sixty times a second is the one
      thing a gesture must never cost. The transform reads all three, so the
      commit is a single style change — React's new `--v2-image-i` and the
      handler's `--v2-image-dx: 0` land in the same batch — and the browser
      transitions from where the finger left off straight to the new picture,
      with no snap-back in between and no frame-timing tricks to arrange it. */
const VAR_INDEX = '--v2-image-i';
const VAR_OFFSET = '--v2-image-dx';
const VAR_DURATION = '--v2-image-ms';

/** Gold on black: the theme's ring tokens are tuned for the page, not for a
 *  surface that is dark in light mode too. */
const VIEWER_FOCUS =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-black';

/** One chrome control: ≥44px on touch, quiet until it is wanted. */
const VIEWER_BUTTON = cn(
  'v2-interactive flex size-11 shrink-0 items-center justify-center rounded-full',
  'text-white/80 transition-colors duration-150 hover:bg-white/10 hover:text-white',
  'disabled:opacity-50 motion-reduce:transition-none',
  VIEWER_FOCUS,
);

/* ── Is the page pinch-zoomed? ─────────────────────────────────────────────
      An external system, so it is read through the sanctioned subscription
      rather than mirrored into state by an effect. The snapshot is a boolean,
      so panning a zoomed page fires the listener without re-rendering
      anything. */

function subscribeViewportZoom(onChange: () => void): () => void {
  const viewport = window.visualViewport;
  if (!viewport) return () => undefined;
  viewport.addEventListener('resize', onChange);
  viewport.addEventListener('scroll', onChange);
  return () => {
    viewport.removeEventListener('resize', onChange);
    viewport.removeEventListener('scroll', onChange);
  };
}

function readViewportZoomed(): boolean {
  return (window.visualViewport?.scale ?? 1) > ZOOM_EPSILON;
}

/** Never on the server, where there is no viewport to have zoomed. */
function readViewportZoomedOnServer(): boolean {
  return false;
}

function useViewportZoomed(): boolean {
  return useSyncExternalStore(
    subscribeViewportZoom,
    readViewportZoomed,
    readViewportZoomedOnServer,
  );
}

/** One in-flight drag. Lives in a ref: nothing here renders. */
interface Drag {
  pointerId: number;
  startX: number;
  startY: number;
  /** Travelled past {@link TAP_SLOP_PX} — a release is no longer a tap. */
  moved: boolean;
  /** Armed as a page turn; the strip is following the finger. */
  swiping: boolean;
  /** Began on the dark ground, so a release IS a dismissal. */
  onGround: boolean;
}

export function MessageImageViewer({
  value,
  resolving,
  messages,
  onSelect,
  onClose,
}: {
  /** The live `?image=` value; `null` when the viewer is closed. */
  value: string | null;
  /** Is the transcript still arriving? A deep link that lands before the first
   *  page does waits, rather than refusing a picture that is on its way. */
  resolving: boolean;
  /** The feed's OWN array — cache pages merged with the outbox — so a picture
   *  in a message that has not been acknowledged yet opens like any other. */
  messages: readonly Message[];
  /** Move to a sibling: a REPLACE, so the visit stays one history entry. */
  onSelect: (next: string) => void;
  onClose: () => void;
}) {
  /**
   * The value the viewer is SHOWING, which outlives the value it is bound to.
   * Closing empties `?image=` a frame before Radix has played the exit, and a
   * viewer that blanked to its "can't find it" panel on the way out would read
   * as a fault rather than a dismissal. Held as the STRING rather than as the
   * resolved object: the object is rebuilt whenever a message arrives, and a
   * held reference would then be re-adopted on every unrelated cache write.
   */
  const shownValue = useHeldValue(value);
  const set = useMemo(
    () => resolveImageSet(messages, shownValue),
    [messages, shownValue],
  );

  /**
   * THE URLS THAT HAVE BEEN MINTED, KEPT ABOVE THE FRAMES THAT MINTED THEM.
   *
   * Only the current picture and its two neighbours are rendered, so swiping
   * three pictures on unmounts the frame that recovered from an expired URL and
   * takes its `src` with it. On a tab older than an hour, a message carrying
   * four photos would then re-fail, re-mint and re-decode the same picture on
   * every return trip. This map is the memory those frames do not have: keyed
   * by file id, seeded into each frame as it mounts, and living OUTSIDE the
   * portal, so it also survives closing and reopening the viewer.
   *
   * State rather than a ref, because a frame reads it WHILE IT RENDERS to seed
   * itself, and it is replaced rather than mutated so that read is a plain
   * prop. It is never written back into the message cache: a refetched page
   * legitimately carries the ORIGINAL signed URL, and a minted one stored there
   * would only be overwritten by it.
   */
  const [mintedUrls, setMintedUrls] =
    useState<ReadonlyMap<number, string>>(NO_MINTED_URLS);
  const rememberMintedUrl = (id: number, url: string) => {
    setMintedUrls((current) => new Map(current).set(id, url));
  };

  return (
    <Dialog
      open={value !== null}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <DialogPortal>
        {/* The overlay is also what carries the scroll lock (and the
            `allowPinchZoom` that keeps the viewer's gesture alive), so it is
            not optional even though the surface over it is opaque. The fade is
            the primitive's own; this only darkens it and stands it down for a
            reader who asked for less motion. */}
        <DialogOverlay className="bg-black/95 duration-150 motion-reduce:animate-none" />
        <ViewerStage
          set={set}
          resolving={resolving}
          mintedUrls={mintedUrls}
          onMintedUrl={rememberMintedUrl}
          onSelect={onSelect}
          onClose={onClose}
        />
      </DialogPortal>
    </Dialog>
  );
}

/** One frozen empty map, so a viewer that has never minted anything hands the
 *  same reference to every frame. */
const NO_MINTED_URLS: ReadonlyMap<number, string> = new Map();

/**
 * Everything inside the portal: the bar, the strip, the steps and the dots.
 *
 * IT IS ITS OWN COMPONENT BECAUSE THE PORTAL IS WHAT MOUNTS IT. The viewer
 * above stands mounted for the life of the channel so Radix can play an exit,
 * and a `visualViewport` subscription up there would have every open channel
 * listening to every address-bar and keyboard move for a component showing
 * nothing. Down here the listeners exist only while a picture is on screen —
 * which is the only time the answer is used.
 */
function ViewerStage({
  set,
  resolving,
  mintedUrls,
  onMintedUrl,
  onSelect,
  onClose,
}: {
  /** The message's pictures and the place in them; `null` when the value on
   *  screen names nothing we hold. */
  set: ImageSet | null;
  resolving: boolean;
  mintedUrls: ReadonlyMap<number, string>;
  onMintedUrl: (id: number, url: string) => void;
  onSelect: (next: string) => void;
  onClose: () => void;
}) {
  const stripRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<Drag | null>(null);
  const openerRef = useRef<HTMLElement | null>(null);
  const zoomed = useViewportZoomed();

  /**
   * WHICH PICTURE THE LAST PRESS IN THE BAR WAS ABOUT.
   *
   * The bar survives a swipe — that is what keeps focus inside the dialog and
   * stops the controls flickering — so its Download and Open-original state
   * belongs to a FILE, not to the bar. Without this, a spinner earned on
   * picture one would spin (and disable the button) over picture two, and a
   * refusal earned on picture one would still be on screen over picture three,
   * saying "this picture" about a file it knows nothing about.
   *
   * MOVING CLEARS IT, which is the same rule read from the other end: a refusal
   * the reader has already swiped away from is over, and coming back to that
   * picture an hour later must not raise it again. The cost is small and stated:
   * swiping away from a download that is still in flight and back again shows an
   * idle button rather than its spinner. It lives here, not in the bar, because
   * `goTo` is the one place every move goes through — and a reset written from
   * an effect, or from the render that noticed the id had changed, is a state
   * write in a place that cannot have one.
   */
  const [pressedId, setPressedId] = useState<number | null>(null);

  const images = set?.images ?? EMPTY_IMAGES;
  const index = set?.index ?? 0;
  const current = set ? images[index] : null;

  const goTo = (nextIndex: number) => {
    if (!set || nextIndex < 0 || nextIndex >= images.length) return;
    setPressedId(null);
    onSelect(formatImageTarget(set.messageUuid, images[nextIndex].id));
  };

  /* ── The gesture ───────────────────────────────────────────────────────── */

  const settleStrip = () => {
    const strip = stripRef.current;
    if (!strip) return;
    // Removing the duration restores the frames' own 200ms, so the strip eases
    // back (or on) from wherever the finger let go.
    strip.style.removeProperty(VAR_DURATION);
    strip.style.setProperty(VAR_OFFSET, '0px');
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    // A right-click is a menu, not a page turn.
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    // A second finger during a page turn is not a second page turn. Any OTHER
    // drag still on the ref is one whose release we never heard (see the move
    // handler), and a fresh press replaces it.
    if (dragRef.current?.swiping) return;
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      moved: false,
      swiping: false,
      onGround: isGround(event.target),
    };
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    // Nothing is pressed any more: the release landed somewhere this strip
    // could not hear it, because the pointer is only captured once a swipe has
    // armed. There is no event for that, so the next move is where we find out.
    if (event.buttons === 0) {
      dragRef.current = null;
      return;
    }

    const dx = event.clientX - drag.startX;
    const dy = event.clientY - drag.startY;
    if (!drag.moved && Math.abs(dx) + Math.abs(dy) > TAP_SLOP_PX) {
      drag.moved = true;
    }

    if (!drag.swiping) {
      // A drag on a zoomed picture is the reader moving the picture, and the
      // browser is already doing it — see the module docblock.
      if (zoomed || images.length < 2) return;
      if (Math.abs(dx) <= SWIPE_ARM_PX || Math.abs(dx) <= Math.abs(dy)) return;
      drag.swiping = true;
      /* THE POINTER IS CAPTURED HERE, AND NOT ONE EVENT EARLIER.
         Capture retargets everything that follows to the capturing element —
         including `mouseup` and therefore `click`, whose target is the common
         ancestor of the press and the release. Captured on `pointerdown`, as
         this was, the strip swallows every click inside it: measured in
         Chromium, a press on the "Open original" button of a frame that failed
         to load fires the strip's click and NEVER the button's, so the one
         recovery the viewer offers could not be taken. Armed here instead, a
         press that stays a press reaches whatever it landed on, and a swipe —
         which is the only gesture that can outrun the strip — still gets the
         capture it needs to hear its own release. */
      event.currentTarget.setPointerCapture(event.pointerId);
      stripRef.current?.style.setProperty(VAR_DURATION, '0ms');
    }

    // Past the first or the last picture there is nothing to reveal, so the
    // strip resists instead of sliding onto empty ground.
    const atEnd = (dx > 0 && index === 0) || (dx < 0 && index === images.length - 1);
    stripRef.current?.style.setProperty(
      VAR_OFFSET,
      `${atEnd ? dx * END_RESISTANCE : dx}px`,
    );
  };

  const handlePointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    dragRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    if (drag.swiping) {
      const width = stripRef.current?.clientWidth ?? 0;
      const threshold = Math.max(SWIPE_COMMIT_MIN_PX, width * SWIPE_COMMIT_RATIO);
      const dx = event.clientX - drag.startX;
      settleStrip();
      if (Math.abs(dx) >= threshold) goTo(index + (dx < 0 ? 1 : -1));
      return;
    }

    settleStrip();
    // A TAP ON THE GROUND DISMISSES; A TAP ON ANYTHING ELSE DOES NOT. Closing
    // on the picture would cost the reader the browser's own touch-and-hold
    // menu, which is where "Save image" lives on a phone — and closing on a
    // control would carry away the answer that control was giving them.
    if (!drag.moved && drag.onGround) onClose();
  };

  const handlePointerCancel = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    // The engine has taken the gesture — a pinch beginning, or the page
    // panning under a zoom. Nothing was decided, so nothing is committed.
    dragRef.current = null;
    settleStrip();
  };

  const stripStyle: React.CSSProperties & Record<typeof VAR_INDEX, string> = {
    [VAR_INDEX]: String(index),
  };

  /* ── Focus goes back to the tile it came from ──────────────────────────────
        RADIX WILL NOT DO IT HERE. Its modal content captures the previously
        focused element and then refuses to use it: its own `onCloseAutoFocus`
        prevents the default restore and focuses `triggerRef.current`, which is
        null because this viewer is opened by the URL and has no
        `DialogTrigger`. Focus lands on `<body>`, so a keyboard reader who
        opened a picture deep in a transcript loses their place on Escape — and
        passing an `onCloseAutoFocus` that ONLY prevents the default does not
        help, for exactly that reason. The restore has to name the element.

        The capture is safe where it sits: `onOpenAutoFocus` is dispatched
        BEFORE the scope moves focus (verified in
        `@radix-ui/react-focus-scope@1.1.7`), so `document.activeElement` is
        still the tile that was pressed. Nothing is prevented there, so the
        scope goes on to focus the Close button as it should. */

  const captureOpener = () => {
    const opener = document.activeElement;
    openerRef.current = opener instanceof HTMLElement ? opener : null;
  };

  const restoreOpener = (event: Event) => {
    event.preventDefault();
    const opener = openerRef.current;
    openerRef.current = null;
    // The tile can be gone — the message deleted while its picture was open.
    // Then there is nowhere to return to, and leaving focus where the dialog
    // put it is the honest answer.
    if (opener?.isConnected) opener.focus();
  };

  return (
    <DialogSurface
      onOpenAutoFocus={captureOpener}
      onCloseAutoFocus={restoreOpener}
      onKeyDown={(event) => {
        if (event.key === 'ArrowRight') {
          event.preventDefault();
          goTo(index + 1);
        }
        if (event.key === 'ArrowLeft') {
          event.preventDefault();
          goTo(index - 1);
        }
      }}
      className={cn(
        'fixed inset-0 z-50 flex flex-col outline-none',
        // Symmetric, and short enough not to be waited on.
        'duration-150',
        'data-open:animate-in data-closed:animate-out',
        'data-open:fade-in-0 data-closed:fade-out-0',
        'data-open:zoom-in-95 data-closed:zoom-out-95',
        'motion-reduce:animate-none',
      )}
    >
      <ViewerChrome
        image={current}
        index={index}
        count={images.length}
        pressedId={pressedId}
        onPress={setPressedId}
        onClose={onClose}
      />

      <div className="relative min-h-0 flex-1">
        {set === null ? (
          <ViewerAbsence resolving={resolving} onClose={onClose} />
        ) : (
          <>
            <div
              ref={stripRef}
              style={stripStyle}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerCancel}
              {...GROUND}
              className={cn(
                'absolute inset-0 overflow-hidden select-none',
                // See the module docblock: the browser owns every multi-finger
                // gesture, and one finger is ours — until the page is zoomed,
                // when panning it is the honest reading of a drag and the
                // browser should have that too.
                zoomed ? 'touch-manipulation' : 'touch-pinch-zoom',
              )}
            >
              {images.map((image, position) => (
                <div
                  key={image.id}
                  aria-hidden={position !== index}
                  inert={position !== index}
                  style={{
                    transform: `translate3d(calc((${position} - var(${VAR_INDEX}, 0)) * 100% + var(${VAR_OFFSET}, 0px)), 0, 0)`,
                    transitionDuration: `var(${VAR_DURATION}, ${SLIDE_MS}ms)`,
                  }}
                  {...GROUND}
                  className={cn(
                    'absolute inset-0 flex items-center justify-center p-3',
                    'transition-transform ease-out motion-reduce:transition-none',
                  )}
                >
                  {/* Only the picture in view and its two neighbours are
                      fetched: a swipe then reveals bytes that are already
                      decoded, and a message carrying ten photos does not
                      download ten of them to show one. */}
                  {Math.abs(position - index) <= 1 && (
                    <ViewerFrame
                      image={image}
                      mintedUrls={mintedUrls}
                      onMintedUrl={onMintedUrl}
                    />
                  )}
                </div>
              ))}
            </div>

            {/* POINTER-FINE ONLY. On touch the gesture IS the control, and a
                pair of arrows pinned over the photo would be two targets
                sitting exactly where the swipe starts. */}
            {images.length > 1 && (
              <>
                <ViewerStep
                  side="left"
                  label="Previous picture"
                  atEnd={index === 0}
                  onClick={() => goTo(index - 1)}
                />
                <ViewerStep
                  side="right"
                  label="Next picture"
                  atEnd={index === images.length - 1}
                  onClick={() => goTo(index + 1)}
                />
              </>
            )}
          </>
        )}
      </div>

      {images.length > 1 && (
        <ViewerDots
          images={images}
          index={index}
          onSelect={(position) => goTo(position)}
        />
      )}

      <DialogDescription className="sr-only">
        {images.length > 1
          ? `Picture ${index + 1} of ${images.length} in this message. Swipe, or use the left and right arrow keys, to see the others. Press Escape or Back to return to the conversation.`
          : 'Press Escape or Back to return to the conversation.'}
      </DialogDescription>
    </DialogSurface>
  );
}

/** One frozen empty set, so a closed (or unresolved) viewer hands the same
 *  array to every derivation instead of a fresh `[]` per render. */
const EMPTY_IMAGES: readonly MessageAttachment[] = [];

/**
 * The bar: what this is, and the three things a reader can do with it.
 *
 * The file's NAME is the dialog's accessible name, because a picture viewer is
 * about exactly one file and its name is the only thing that identifies it. It
 * is also what the reader sees, so the announced name and the visible one
 * cannot drift.
 */
function ViewerChrome({
  image,
  index,
  count,
  pressedId,
  onPress,
  onClose,
}: {
  image: MessageAttachment | null;
  index: number;
  count: number;
  /** The file the last press was about, or `null` — see {@link ViewerStage}.
   *  Everything the two verbs put on screen is gated on it, so a spinner and a
   *  refusal both belong to a picture rather than to the reader. */
  pressedId: number | null;
  onPress: (id: number) => void;
  onClose: () => void;
}) {
  const download = usePictureDownload();
  const openOriginal = useOpenFileInNewTab();
  /** Comparing ids is a derivation; clearing the mutations from an effect would
   *  be a state write in a place that cannot have one. */
  const pressedHere = image !== null && pressedId === image.id;
  const saving = pressedHere && download.saving;
  const opening = pressedHere && openOriginal.opening;
  const failedHere = pressedHere && (download.failed || openOriginal.failed);

  return (
    <div className="v2-safe-top v2-safe-left v2-safe-right shrink-0">
      <div className="flex h-14 items-center gap-1 px-1">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          title="Close"
          className={VIEWER_BUTTON}
        >
          <X aria-hidden className="size-5" />
        </button>

        <div className="min-w-0 flex-1 px-1">
          <DialogTitle className="truncate text-sm font-medium text-white">
            {image?.original_name ?? 'Picture'}
          </DialogTitle>
          <p className="truncate text-xs text-white/60">
            {count > 1 && (
              <span aria-live="polite">
                {index + 1} of {count}
                {image ? ' · ' : ''}
              </span>
            )}
            {image ? formatBytes(image.size) : ''}
          </p>
        </div>

        {image && (
          <>
            <button
              type="button"
              onClick={() => {
                onPress(image.id);
                download.save(image);
              }}
              disabled={saving}
              aria-label={`Download ${image.original_name}`}
              title="Download"
              className={VIEWER_BUTTON}
            >
              {saving ? (
                <Loader2 aria-hidden className="size-5 animate-spin" />
              ) : (
                <Download aria-hidden className="size-5" />
              )}
            </button>
            <button
              type="button"
              onClick={() => {
                onPress(image.id);
                openOriginal.open(image.id);
              }}
              disabled={opening}
              aria-label={`Open ${image.original_name} in a new tab`}
              title="Open original"
              className={VIEWER_BUTTON}
            >
              {opening ? (
                <Loader2 aria-hidden className="size-5 animate-spin" />
              ) : (
                <ExternalLink aria-hidden className="size-5" />
              )}
            </button>
          </>
        )}
      </div>

      {/* The channel surfaces raise no toasts, so a refused download says so
          under the button that was pressed — and only while the reader is
          still looking at the picture it was about. */}
      {failedHere && (
        <p role="status" className="px-4 pb-2 text-xs text-white/70">
          {download.failed
            ? "Couldn't download this picture. Try again."
            : "Couldn't open this picture. Try again."}
        </p>
      )}
    </div>
  );
}

/**
 * Save the picture to the device.
 *
 * IT TRIES TO SAVE, AND FALLS BACK TO WHAT "DOWNLOAD" ALREADY MEANS HERE. The
 * bytes live on a different origin behind a signed URL, and HTML ignores the
 * `download` attribute across origins — so a real save means fetching the blob
 * first, which needs the file host to allow it. When it does, the reader gets
 * the file under its own name. When it does not, this opens the same tab the
 * Files tab's Download button has always opened: the verb never changes its
 * meaning, it only does the best available version of it. Only when BOTH are
 * refused does the bar say so.
 */
function usePictureDownload() {
  const [failed, setFailed] = useState(false);
  const mutation = useMutation({
    mutationFn: async (image: MessageAttachment) => {
      const response = await filesApi.getDownloadUrl(image.id);
      const url = response.data?.url;
      if (!url) throw new Error('The download link came back empty.');

      try {
        const bytes = await fetch(url);
        if (!bytes.ok) throw new Error(`The file host answered ${bytes.status}.`);
        const blobUrl = URL.createObjectURL(await bytes.blob());
        const anchor = document.createElement('a');
        anchor.href = blobUrl;
        anchor.download = image.original_name;
        // Safari has historically refused a click on a detached anchor.
        document.body.append(anchor);
        anchor.click();
        anchor.remove();
        // Not awaited: the save is already under way, and holding the mutation
        // pending for a second would leave a spinner over a finished download.
        setTimeout(() => URL.revokeObjectURL(blobUrl), BLOB_RELEASE_MS);
        return;
      } catch {
        // The host would not hand us the bytes (almost always CORS). The tab
        // is the honest fallback — see the docblock.
        if (!window.open(url, '_blank', 'noopener')) {
          throw new Error('The browser blocked the new tab.');
        }
      }
    },
    meta: { silentError: true },
  });

  const save = (image: MessageAttachment) => {
    setFailed(false);
    mutation.mutate(image, { onError: () => setFailed(true) });
  };
  return { save, saving: mutation.isPending, failed };
}

/**
 * One picture, fitted whole.
 *
 * Its own component, and the frame around it is keyed by the file's id, so the
 * paint state and the one-per-failure refresh budget belong to the FILE. A
 * swipe therefore cannot carry one picture's "this didn't load" onto the next.
 *
 * IT DOES NOT OUTLIVE THE RENDER WINDOW, AND THE MINTED URL DOES. Only the
 * current picture and its neighbours are mounted, so on the fourth picture of a
 * message this frame is gone and every piece of state named here goes with it —
 * including a URL it had to mint. `mintedUrls` is the viewer's own memory of
 * that work: a returning frame seeds itself from the map instead of failing,
 * minting and decoding all over again. What does NOT survive is the paint state
 * itself, so a picture the reader swipes back to shows its skeleton for as long
 * as the browser takes to hand back bytes it has already cached.
 */
function ViewerFrame({
  image,
  mintedUrls,
  onMintedUrl,
}: {
  image: MessageAttachment;
  mintedUrls: ReadonlyMap<number, string>;
  onMintedUrl: (id: number, url: string) => void;
}) {
  const refresh = useFreshFileUrl();
  const openOriginal = useOpenFileInNewTab();
  /** Seeded from whatever this viewer has already minted for the file, or from
   *  the row, and thereafter owned by the refresh — deliberately NOT following
   *  a later `image.url`, which a background refetch can serve as the very URL
   *  that already expired. */
  const [src, setSrc] = useState(() => mintedUrls.get(image.id) ?? image.url);
  const [paint, setPaint] = useState<'pending' | 'shown' | 'failed'>('pending');
  /** One refresh per FAILURE, not per frame: the minted URL is signed for an
   *  hour too, so a viewer left open long enough expires a second time. A
   *  successful paint re-arms it, and that cannot loop — an `<img>` that fired
   *  `onLoad` for a src never fires `onError` for the same one. */
  const refreshedRef = useRef(false);

  const handleError = () => {
    if (refreshedRef.current) {
      setPaint('failed');
      return;
    }
    refreshedRef.current = true;
    refresh.mutate(image.id, {
      onSuccess: (response) => {
        const url = response.data?.url;
        if (!url) {
          setPaint('failed');
          return;
        }
        // A MINT THAT HANDS BACK THE URL THAT JUST FAILED IS A FAILURE. `src` is
        // the `<img>`'s key, so an identical value changes nothing: the element
        // is never rebuilt, no `onLoad` and no `onError` can arrive, and `paint`
        // would sit at 'pending' behind a skeleton that pulses for ever with no
        // way out.
        if (url === src) {
          setPaint('failed');
          return;
        }
        onMintedUrl(image.id, url);
        setSrc(url);
        setPaint('pending');
      },
      onError: () => setPaint('failed'),
    });
  };

  if (paint === 'failed') {
    // The designed end state. It names the file, because the picture that
    // would have identified it is the thing that is missing. NOT ground: every
    // press in here is a press on something, and dismissing under the reader's
    // finger would take the recovery away with it.
    return (
      <div className="flex max-w-sm flex-col items-center gap-3 px-6 text-center">
        <span
          aria-hidden
          className="flex size-12 items-center justify-center rounded-2xl bg-white/10 text-white/70"
        >
          <ImageOff className="size-6" />
        </span>
        <p className="text-sm font-medium text-white">This picture didn&rsquo;t load.</p>
        <p className="text-xs break-all text-white/60">{image.original_name}</p>
        <button
          type="button"
          onClick={() => openOriginal.open(image.id)}
          disabled={openOriginal.opening}
          className={cn(
            'v2-interactive min-h-9 rounded-full border border-white/20 px-4 text-sm font-medium text-white',
            'transition-colors duration-150 hover:bg-white/10',
            'disabled:opacity-60 motion-reduce:transition-none',
            VIEWER_FOCUS,
          )}
        >
          {openOriginal.opening ? 'Opening…' : 'Open original'}
        </button>
        {openOriginal.failed && (
          <p role="status" className="text-xs text-white/70">
            Couldn&rsquo;t open it. Try again.
          </p>
        )}
      </div>
    );
  }

  return (
    <div
      {...GROUND}
      className="relative flex size-full items-center justify-center"
    >
      {/* THE FRAME'S GEOMETRY IS THE SCREEN, so nothing can move when the bytes
          land — the picture is centred inside a box that was already the right
          size. The skeleton is therefore not holding a place against reflow;
          it is standing WHERE the picture will land, at the same 4:3 the inline
          tile uses, so opening one reads as the tile growing rather than as a
          black screen that eventually fills. The payload carries no dimensions,
          which is why the shape has to be borrowed rather than known. */}
      {paint === 'pending' && (
        <div
          aria-hidden
          className="absolute aspect-[4/3] w-full max-w-3xl animate-pulse rounded-xl bg-white/5"
        />
      )}
      {/* eslint-disable-next-line @next/next/no-img-element -- remote URL on the API host; the app declares no images.remotePatterns, so next/image would throw at runtime. */}
      <img
        key={src}
        src={src}
        alt={image.original_name}
        draggable={false}
        decoding="async"
        onLoad={() => {
          refreshedRef.current = false;
          setPaint('shown');
        }}
        onError={handleError}
        className={cn(
          'max-h-full max-w-full object-contain',
          'transition-opacity duration-200 motion-reduce:transition-none',
          paint === 'shown' ? 'opacity-100' : 'opacity-0',
        )}
      />
    </div>
  );
}

/**
 * A step control, pointer-fine only — see the call site.
 *
 * AT THE END IT IS DIMMED AND ANNOUNCED, NEVER `disabled`. A button the browser
 * disables under a reader's own click is blurred to `<body>` in the same frame,
 * and the arrow keys live on the dialog surface — so clicking through to the
 * last picture would silently take the keyboard away from someone who had been
 * using it. `aria-disabled` says the same thing to a screen reader while
 * keeping the focus, and the press itself no-ops: `goTo` bounds-checks.
 */
function ViewerStep({
  side,
  label,
  atEnd,
  onClick,
}: {
  side: 'left' | 'right';
  label: string;
  atEnd: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-disabled={atEnd}
      aria-label={label}
      title={label}
      className={cn(
        VIEWER_BUTTON,
        'absolute top-1/2 hidden -translate-y-1/2 bg-black/40 aria-disabled:opacity-50',
        '[@media(hover:hover)_and_(pointer:fine)]:flex',
        side === 'left' ? 'left-2' : 'right-2',
      )}
    >
      {side === 'left' ? (
        <ChevronLeft aria-hidden className="size-5" />
      ) : (
        <ChevronRight aria-hidden className="size-5" />
      )}
    </button>
  );
}

/** Where the reader is in the message's pictures, and a way to jump. Real
 *  buttons rather than decoration: the dots are the only affordance a keyboard
 *  or a screen reader can use to reach picture four directly. */
function ViewerDots({
  images,
  index,
  onSelect,
}: {
  images: readonly MessageAttachment[];
  index: number;
  onSelect: (position: number) => void;
}) {
  return (
    <div className="v2-safe-bottom shrink-0">
      <div className="flex items-center justify-center gap-1 py-3">
        {images.map((image, position) => (
          <button
            key={image.id}
            type="button"
            onClick={() => onSelect(position)}
            aria-label={`Picture ${position + 1}: ${image.original_name}`}
            aria-current={position === index}
            className={cn(
              'v2-interactive flex size-8 items-center justify-center rounded-full',
              VIEWER_FOCUS,
            )}
          >
            <span
              aria-hidden
              className={cn(
                'size-1.5 rounded-full transition-all duration-150 motion-reduce:transition-none',
                position === index ? 'w-4 bg-primary' : 'bg-white/40',
              )}
            />
          </button>
        ))}
      </div>
    </div>
  );
}

/**
 * The two states in which there is no picture to show.
 *
 * WAITING is not the same as MISSING, and conflating them is what would make a
 * refreshed deep link flash a refusal at a reader whose transcript was one
 * round trip away. So the panel says "loading" for exactly as long as the feed
 * is still arriving, and only then does it say the honest thing.
 *
 * THE REFUSAL COVERS BOTH WAYS A PICTURE GOES MISSING — a file that has since
 * been removed from its message, and a link into a conversation older than the
 * pages this session has loaded — because from the reader's side they are the
 * same event and the same sentence is true of both. It never guesses at a
 * different picture, and it always offers the way out, since Back is not the
 * only thing a reader may reach for.
 *
 * AND IT ONLY NAMES AN ACTION THE READER CAN TAKE FROM HERE. This dialog is
 * modal and the page under it is scroll-locked, so "scroll up to find it" was a
 * sentence that could not be obeyed without first doing the one thing it did
 * not mention. Leaving is now the first half of the instruction, and the button
 * beneath it is how.
 */
function ViewerAbsence({
  resolving,
  onClose,
}: {
  resolving: boolean;
  onClose: () => void;
}) {
  if (resolving) {
    return (
      <div className="flex size-full items-center justify-center">
        <div
          aria-hidden
          className="aspect-[4/3] w-full max-w-3xl animate-pulse rounded-xl bg-white/5"
        />
        <p className="sr-only" role="status">
          Loading this picture.
        </p>
      </div>
    );
  }

  return (
    <div className="flex size-full flex-col items-center justify-center gap-4 px-6 text-center">
      <span
        aria-hidden
        className="flex size-12 items-center justify-center rounded-2xl bg-white/10 text-white/70"
      >
        <SearchX className="size-6" />
      </span>
      <div className="space-y-1.5">
        <p className="text-base font-semibold text-white">
          This picture isn&rsquo;t here any more
        </p>
        <p className="mx-auto max-w-sm text-sm leading-relaxed text-white/60">
          It may have been removed from the message, or it belongs further back
          in the conversation than we&rsquo;ve loaded. Go back to the
          conversation and scroll up to look for it.
        </p>
      </div>
      <button
        type="button"
        onClick={onClose}
        className={cn(
          'v2-interactive min-h-9 rounded-full border border-white/20 px-4 text-sm font-medium text-white',
          'transition-colors duration-150 hover:bg-white/10 motion-reduce:transition-none',
          VIEWER_FOCUS,
        )}
      >
        Back to the conversation
      </button>
    </div>
  );
}
