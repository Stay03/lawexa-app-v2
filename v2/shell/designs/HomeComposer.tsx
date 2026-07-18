'use client';

import { useRef, useState } from 'react';
import {
  ArrowUp,
  FileText,
  Paperclip,
  Plus,
  ShieldCheck,
  VenetianMask,
  X,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  PromptInput,
  PromptInputAction,
  PromptInputActions,
  PromptInputTextarea,
} from '@/components/ui/prompt-input';
import { cn } from '@/lib/utils';
import type { UserRole } from '@/types/auth';
import { JurisdictionField } from './composer/JurisdictionField';
import { WorkflowField } from './composer/WorkflowField';

/**
 * HomeComposer — the ONE v2-native composer both home designs share, so the
 * composer furniture can never drift between Design A and Design B. A fresh build
 * on the shared `components/ui` primitives (the v1 `ComposerPlusMenu` /
 * `JurisdictionStatus` / workflow-`Select` components stay boundary-blocked); it
 * faithfully reproduces the UX, states, and copy studied first-hand in
 * `app/(main)/page.tsx`:
 *
 *  - a `+` plus-menu with Attach files + the CONSOLIDATED privacy toggles
 *    (Redacted + Confidential);
 *  - a ROLE-AWARE workflow selector (`WorkflowField`) — users get v1's Lite /
 *    Expert, admins get v1's real `/admin/ai-workflows` list;
 *  - a jurisdiction chip (`JurisdictionField`) opening v1's real picker over the
 *    live jurisdiction list, with flags.
 *
 * SMOOTH MOTION (owner rule #17) — every state change has a deliberate transition:
 *  - Confidential is CONTROLLED by the parent design so the GREETING can present
 *    it like v1 (emerald "Confidential Chat" heading), not a note under the box;
 *    here it swaps the primitive to its emerald `variant="confidential"` outline
 *    AND fades a soft emerald ring around the whole surface in/out.
 *  - The redacted dot on `+` scales+fades in/out (never a hard pop).
 *  - Attachment chips animate in on add and animate out on remove (a short exit
 *    window before the row leaves the DOM), all `motion-reduce`-guarded.
 *  - The plus-menu / selects are Radix, which already play enter/exit animations.
 *
 * Everything is interactive locally (menus open, toggles flip, files show
 * removable chips) but nothing hits the network — real wiring lands with the
 * phase-3 chat wave. Guests get a bare composer (no furniture), matching v1.
 *
 * PORTAL-EVENT NOTE (studied from v1): React synthetic events bubble through the
 * React tree even out of portaled menu content, so a click inside an open menu
 * would reach `PromptInput`'s root `onClick`, refocus the textarea, and Radix
 * would read that as focus-outside and close the menu. Every furniture trigger and
 * menu surface therefore stops click propagation.
 */

interface HomeAttachment {
  id: string;
  name: string;
  size: number;
}

const ACCEPTED_FILE_TYPES = '.pdf,.doc,.docx,.rtf';
const MAX_FILES = 10;
/** Attachment exit window — must clear before the row leaves the DOM. */
const CHIP_EXIT_MS = 160;

/** Compact human file size — pure, so it is safe to call in render. */
function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export interface HomeComposerProps {
  value: string;
  onValueChange: (value: string) => void;
  /** Signed-in users get the full furniture; guests get a bare composer. */
  signedIn: boolean;
  /** Drives the role-aware workflow selector (users vs admin/superadmin). */
  role?: UserRole;
  /** Confidential is CONTROLLED by the design so the greeting can present it. */
  confidential: boolean;
  onConfidentialChange: (next: boolean) => void;
  /** Extra classes for the PromptInput card (per-design shadow / padding). */
  className?: string;
  /** Extra classes for the textarea (per-design font sizing). */
  textareaClassName?: string;
  /** Extra classes for the send button (per-design desktop sizing). */
  sendButtonClassName?: string;
}

export function HomeComposer({
  value,
  onValueChange,
  signedIn,
  role,
  confidential,
  onConfidentialChange,
  className,
  textareaClassName,
  sendButtonClassName,
}: HomeComposerProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [attachments, setAttachments] = useState<HomeAttachment[]>([]);
  const [removing, setRemoving] = useState<Set<string>>(new Set());
  const [redacted, setRedacted] = useState(false);

  const addFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setAttachments((prev) => {
      const seen = new Set(prev.map((a) => `${a.name}::${a.size}`));
      const next = [...prev];
      for (const file of Array.from(files)) {
        const key = `${file.name}::${file.size}`;
        if (seen.has(key) || next.length >= MAX_FILES) continue;
        seen.add(key);
        next.push({
          id:
            typeof crypto !== 'undefined' && 'randomUUID' in crypto
              ? crypto.randomUUID()
              : `${file.name}-${file.size}-${next.length}`,
          name: file.name,
          size: file.size,
        });
      }
      return next;
    });
  };

  // Play the exit animation, then drop the row. The timer (not an effect) commits
  // the removal, so it also fires under reduced motion where the visual exit is
  // suppressed — the chip still leaves, just without the animation.
  const removeAttachment = (id: string) => {
    setRemoving((prev) => {
      if (prev.has(id)) return prev;
      const next = new Set(prev);
      next.add(id);
      return next;
    });
    window.setTimeout(() => {
      setAttachments((prev) => prev.filter((a) => a.id !== id));
      setRemoving((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }, CHIP_EXIT_MS);
  };

  // Inert this wave — real submission lands with the chat wiring.
  const handleSubmit = () => {};

  const canSend = value.trim().length > 0 || attachments.length > 0;

  // Keep clicks inside portaled menus from bubbling to PromptInput's root (see
  // the PORTAL-EVENT NOTE above).
  const stop = (event: React.SyntheticEvent) => event.stopPropagation();

  return (
    <>
      {/* Hidden picker driven by the plus-menu's "Attach files". Resetting the
          value on change lets the same file be re-picked after removal. */}
      {signedIn ? (
        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPTED_FILE_TYPES}
          multiple
          hidden
          onChange={(event) => {
            addFiles(event.target.files);
            event.target.value = '';
          }}
        />
      ) : null}

      {/* Confidential surface cue — a soft emerald ring that fades in/out with the
          mode (the primitive swaps its own outline; this animates the whole
          surface so the change never just snaps). */}
      <div
        className={cn(
          'rounded-3xl transition-shadow duration-300 ease-out motion-reduce:transition-none',
          confidential && 'ring-4 ring-emerald-500/15',
        )}
      >
        <PromptInput
          value={value}
          onValueChange={onValueChange}
          onSubmit={handleSubmit}
          variant={confidential ? 'confidential' : 'default'}
          className={className}
        >
          {/* Attachment chips — one per selected file (local only, no upload). */}
          {signedIn && attachments.length > 0 ? (
            <div className="flex flex-wrap gap-2 px-2 pt-2">
              {attachments.map((attachment) => {
                const isRemoving = removing.has(attachment.id);
                return (
                  <div
                    key={attachment.id}
                    onClick={stop}
                    className={cn(
                      'flex items-center gap-2 rounded-lg bg-secondary px-2.5 py-1.5 text-xs',
                      isRemoving
                        ? 'motion-safe:animate-out motion-safe:fade-out motion-safe:zoom-out-95 motion-safe:duration-150'
                        : 'motion-safe:animate-in motion-safe:fade-in motion-safe:zoom-in-95 motion-safe:duration-150',
                    )}
                  >
                    <FileText className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
                    <span className="max-w-[140px] truncate" title={attachment.name}>
                      {attachment.name}
                    </span>
                    <span className="text-muted-foreground">{formatBytes(attachment.size)}</span>
                    <button
                      type="button"
                      onClick={() => removeAttachment(attachment.id)}
                      aria-label={`Remove ${attachment.name}`}
                      className="v2-interactive rounded-full p-0.5 text-muted-foreground transition-colors hover:bg-background/70 hover:text-foreground"
                    >
                      <X className="size-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          ) : null}

          <PromptInputTextarea
            placeholder="Ask a legal question"
            className={cn('text-foreground placeholder:text-muted-foreground', textareaClassName)}
          />

          <PromptInputActions className="flex items-center gap-2 px-2 pb-1">
            {signedIn ? (
              // Horizontally-scrollable toolbar keeps every control reachable at
              // 320px without wrapping the row. py-0.5: overflow-x-auto forces
              // overflow-y to auto, which would clip the + focus ring otherwise.
              <div className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto py-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {/* Plus-menu: Attach + consolidated privacy toggles. */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      aria-label="Attach files and privacy options"
                      onClick={stop}
                      className="v2-interactive relative flex size-9 shrink-0 items-center justify-center rounded-full text-primary transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <Plus className="size-5" />
                      {/* Redacted dot — scales+fades both ways, never a hard pop. */}
                      <span
                        aria-hidden
                        className={cn(
                          'absolute right-1 top-1 size-1.5 rounded-full bg-indigo-500 ring-2 ring-background transition-all duration-150 motion-reduce:transition-none',
                          redacted ? 'scale-100 opacity-100' : 'scale-0 opacity-0',
                        )}
                      />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    align="start"
                    side="top"
                    sideOffset={8}
                    className="w-72"
                    onClick={stop}
                  >
                    <DropdownMenuItem onSelect={() => fileInputRef.current?.click()}>
                      <Paperclip className="text-muted-foreground" />
                      <span className="flex-1">Attach files</span>
                      <span className="text-xs text-muted-foreground">PDF, DOC, RTF</span>
                    </DropdownMenuItem>

                    <DropdownMenuSeparator />
                    <DropdownMenuLabel>Privacy</DropdownMenuLabel>

                    <DropdownMenuCheckboxItem
                      checked={redacted}
                      onCheckedChange={setRedacted}
                      onSelect={(event) => event.preventDefault()}
                    >
                      <VenetianMask
                        className={redacted ? 'text-indigo-500' : 'text-muted-foreground'}
                      />
                      <span className="flex flex-col">
                        <span className="font-medium leading-tight">Redacted mode</span>
                        <span className="text-xs text-muted-foreground">
                          Hide names, addresses &amp; IDs from the model
                        </span>
                      </span>
                    </DropdownMenuCheckboxItem>

                    <DropdownMenuCheckboxItem
                      checked={confidential}
                      onCheckedChange={onConfidentialChange}
                      onSelect={(event) => event.preventDefault()}
                    >
                      <ShieldCheck
                        className={
                          confidential
                            ? 'text-emerald-600 dark:text-emerald-500'
                            : 'text-muted-foreground'
                        }
                      />
                      <span className="flex flex-col">
                        <span className="font-medium leading-tight">Confidential mode</span>
                        <span className="text-xs text-muted-foreground">
                          Not stored after your session
                        </span>
                      </span>
                    </DropdownMenuCheckboxItem>
                  </DropdownMenuContent>
                </DropdownMenu>

                {/* Role-aware workflow selector — v1's Lite/Expert or admin list. */}
                <WorkflowField role={role} stop={stop} />

                {/* Jurisdiction chip — v1's real picker over the live list. */}
                <JurisdictionField signedIn={signedIn} stop={stop} />
              </div>
            ) : (
              <span className="flex-1" />
            )}

            {/* Send — the primary action. ≥44px on mobile; inert this wave. */}
            <PromptInputAction tooltip="Send message">
              <Button
                type="button"
                size="icon"
                className={cn(
                  'v2-interactive size-11 shrink-0 rounded-full bg-primary hover:bg-primary/90',
                  sendButtonClassName,
                )}
                onClick={handleSubmit}
                disabled={!canSend}
                aria-label="Send message"
              >
                <ArrowUp className="size-5" />
              </Button>
            </PromptInputAction>
          </PromptInputActions>
        </PromptInput>
      </div>
    </>
  );
}
