'use client';

import { useRef, useState } from 'react';
import {
  ArrowUp,
  ChevronDown,
  FileText,
  Landmark,
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
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  PromptInput,
  PromptInputAction,
  PromptInputActions,
  PromptInputTextarea,
} from '@/components/ui/prompt-input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

/**
 * HomeComposer — the ONE v2-native composer both home designs share, so the
 * composer furniture can never drift between Design A and Design B. It is a
 * fresh build on the shared `components/ui` primitives (the v1 `ComposerPlusMenu`
 * / `JurisdictionStatus` / workflow-`Select` components stay boundary-blocked);
 * it faithfully reproduces their UX, states, and copy that I studied first-hand
 * in `app/(main)/page.tsx`:
 *
 *  - a `+` plus-menu (DropdownMenu) with Attach files + the CONSOLIDATED privacy
 *    toggles — Redacted mode and Confidential mode (phase-doc §C decision to move
 *    confidential out of the header and in here beside redacted);
 *  - a workflow selector chip (Lawexa Lite / Expert — v1's user-facing options);
 *  - a jurisdiction chip resting on "Nigeria" (v1's `JurisdictionStatus` default).
 *
 * Everything is REALLY interactive locally — menus open, toggles flip visual
 * state (redacted lights an indigo dot on the `+`; confidential swaps the whole
 * composer to the primitive's emerald `variant="confidential"` outline exactly
 * like v1, and surfaces the "not stored" note), the file picker opens and selected
 * files show removable chips — but nothing hits the network and submit stays
 * inert. The real wiring lands with the phase-3 chat wave; this wave proves the
 * furniture, its states, and its layout with no dead-looking controls.
 *
 * Guests get a bare composer (no furniture), matching v1 — the send is inert this
 * wave regardless, so the guest→auth flow arrives with the wiring too.
 *
 * PORTAL-EVENT NOTE (studied from v1's `JurisdictionStatus`): React synthetic
 * events bubble through the React tree even out of portaled menu content, so a
 * click inside an open menu would reach `PromptInput`'s root `onClick`, refocus
 * the textarea, and Radix would read that as focus-outside and close the menu.
 * Every furniture trigger and menu surface therefore stops click propagation.
 */

interface HomeAttachment {
  id: string;
  name: string;
  size: number;
}

/** User-facing workflows (v1's `USER_WORKFLOWS`); admins get an API list in v1. */
const WORKFLOWS = [
  { id: 'lite', label: 'Lawexa Lite' },
  { id: 'expert', label: 'Lawexa Expert' },
] as const;

/**
 * Resting jurisdiction options. v1 resolves the real list from an API hook that
 * lives behind the v2 boundary, so this design wave uses a small local set (the
 * default is Nigeria, v1's documented fallback). The live jurisdiction picker is
 * wired with the chat composer in a later phase.
 */
const JURISDICTIONS = [
  'Nigeria',
  'Ghana',
  'Kenya',
  'South Africa',
  'United Kingdom',
  'None',
] as const;

const ACCEPTED_FILE_TYPES = '.pdf,.doc,.docx,.rtf';
const MAX_FILES = 10;

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
  className,
  textareaClassName,
  sendButtonClassName,
}: HomeComposerProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [attachments, setAttachments] = useState<HomeAttachment[]>([]);
  const [redacted, setRedacted] = useState(false);
  const [confidential, setConfidential] = useState(false);
  const [workflowId, setWorkflowId] = useState<string>(WORKFLOWS[0].id);
  const [jurisdiction, setJurisdiction] = useState<string>(JURISDICTIONS[0]);

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

  const removeAttachment = (id: string) =>
    setAttachments((prev) => prev.filter((a) => a.id !== id));

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
            {attachments.map((attachment) => (
              <div
                key={attachment.id}
                onClick={stop}
                className="flex items-center gap-2 rounded-lg bg-secondary px-2.5 py-1.5 text-xs"
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
            ))}
          </div>
        ) : null}

        <PromptInputTextarea
          placeholder="Ask anything about Nigerian law"
          className={cn('text-foreground placeholder:text-muted-foreground', textareaClassName)}
        />

        <PromptInputActions className="flex items-center gap-2 px-2 pb-1">
          {signedIn ? (
            // Horizontally-scrollable toolbar keeps every control reachable at
            // 320px without wrapping the row or breaking layout. py-0.5:
            // overflow-x-auto forces overflow-y to auto, which would clip the
            // + button's focus ring without this breathing room.
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
                    {redacted ? (
                      <span
                        aria-hidden
                        className="absolute right-1 top-1 size-1.5 rounded-full bg-indigo-500 ring-2 ring-background"
                      />
                    ) : null}
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
                    onCheckedChange={setConfidential}
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

              {/* Workflow selector — v1's user-facing Lite / Expert choice. */}
              <Select value={workflowId} onValueChange={setWorkflowId}>
                <SelectTrigger
                  size="sm"
                  onClick={stop}
                  aria-label="Workflow"
                  className="h-8 shrink-0 gap-1 rounded-full border-none bg-transparent px-2.5 text-xs text-muted-foreground hover:bg-secondary hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring [&>span]:truncate"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent onClick={stop}>
                  {WORKFLOWS.map((workflow) => (
                    <SelectItem key={workflow.id} value={workflow.id}>
                      {workflow.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Jurisdiction chip — resting on Nigeria, v1's default fallback. */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    onClick={stop}
                    aria-label={`Jurisdiction: ${jurisdiction}`}
                    className="v2-interactive inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border border-border bg-transparent px-2.5 text-xs text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <Landmark className="size-3.5 shrink-0" aria-hidden />
                    <span className="whitespace-nowrap">{jurisdiction}</span>
                    <ChevronDown className="size-3 shrink-0 opacity-60" aria-hidden />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="start"
                  side="top"
                  sideOffset={8}
                  className="w-56"
                  onClick={stop}
                >
                  <DropdownMenuLabel>Jurisdiction</DropdownMenuLabel>
                  <DropdownMenuRadioGroup value={jurisdiction} onValueChange={setJurisdiction}>
                    {JURISDICTIONS.map((option) => (
                      <DropdownMenuRadioItem key={option} value={option}>
                        {option === 'None' ? 'None (comparative)' : option}
                      </DropdownMenuRadioItem>
                    ))}
                  </DropdownMenuRadioGroup>
                </DropdownMenuContent>
              </DropdownMenu>
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

      {/* Confidential note — mirrors v1's messaging so the toggle plainly changes
          the surface, not just an icon color. */}
      {signedIn && confidential ? (
        <p className="mt-2 flex items-center justify-center gap-1.5 text-center text-xs text-emerald-600 dark:text-emerald-500">
          <ShieldCheck className="size-3.5 shrink-0" aria-hidden />
          Confidential — this chat won&apos;t be stored after your session.
        </p>
      ) : null}
    </>
  );
}
