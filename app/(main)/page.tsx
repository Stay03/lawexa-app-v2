'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { AxiosError } from 'axios';
import { PastedContentCard } from '@/components/chat/pasted-content-card';
import { useGreetingParts } from '@/lib/hooks/useGreeting';
import {
  PromptInput,
  PromptInputTextarea,
  PromptInputActions,
  PromptInputAction,
} from '@/components/ui/prompt-input';
import {
  FileUpload,
  FileUploadTrigger,
  FileUploadContent,
} from '@/components/ui/file-upload';
import { ArrowUp, Paperclip, X, Loader2, FileText, MessageCircle, FileUp, Scale, NotebookPen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { PulsingHeart } from '@/components/ui/pulsing-heart';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { chatApi } from '@/lib/api/chat';
import { useAuthStore } from '@/lib/stores/authStore';
import { AuthModal } from '@/components/auth/AuthModal';
import { useQuery } from '@tanstack/react-query';
import { adminAiApi } from '@/lib/api/admin-ai';
import { adminAiKeys } from '@/lib/hooks/useAdminAi';
import { extractApiError, extractBlockedReason } from '@/lib/utils/api-error';
import { MessageBlockBanner } from '@/components/chat/message-block-banner';
import type { IBlockedReason } from '@/types/message-pack';
import { formatFileSize } from '@/lib/validations/admin-cases';
import { useUserLimits } from '@/lib/hooks/useUserLimits';
import { NoFreeMessagesBanner } from '@/components/chat/no-free-messages-banner';
import {
  useJurisdictionChoice,
  bridgeHomeJurisdictionToConversation,
} from '@/lib/hooks/useJurisdictionChoice';
import { applyJurisdiction } from '@/lib/utils/jurisdiction-payload';
import { JurisdictionStatus } from '@/components/chat/jurisdiction-status';
import { cn } from '@/lib/utils';
import { useConfidentialModeStore } from '@/lib/stores/confidentialModeStore';
import {
  appendUserTurn,
  deleteTranscript,
  renameTranscript,
} from '@/lib/storage/confidentialTranscriptStore';

const MAX_DOCUMENT_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_FILES_PER_TURN = 10;
const ALLOWED_FILE_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/rtf',
  'text/rtf',
];

type FileUploadEntry = {
  key: string;
  file_name: string;
  file_size: number;
  status: 'uploading' | 'uploaded' | 'failed';
  file_id?: number;
  error?: string;
};

export default function HomePage() {
  const [input, setInput] = useState(() => {
    if (typeof window === 'undefined') return '';
    return localStorage.getItem('home_input_draft') ?? '';
  });
  const [pastedContent, setPastedContent] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('home_input_pasted') || null;
  });
  const [uploads, setUploads] = useState<FileUploadEntry[]>([]);
  const uploadedFiles = uploads.filter((u) => u.status === 'uploaded');
  const isUploading = uploads.some((u) => u.status === 'uploading');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [studyMode, setStudyMode] = useState(false);
  const [selectedWorkflowId, setSelectedWorkflowId] = useState<string>('');
  const [error, setError] = useState<{ message: string; status: number } | null>(null);
  const [blockedReason, setBlockedReason] = useState<IBlockedReason | null>(null);
  const { greeting, name, isSpecial } = useGreetingParts();
  const router = useRouter();
  const [showLinks, setShowLinks] = useState(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const user = useAuthStore((state) => state.user);
  const isGuest = useAuthStore((state) => state.isGuest);
  const isConfidentialPending = useConfidentialModeStore((s) => s.isPending);
  const setConfidentialPending = useConfidentialModeStore((s) => s.setPending);
  const markConfidential = useConfidentialModeStore((s) => s.markConfidential);

  // Home page has no conversation yet — choice lives under the home key
  // and is bridged into the conversation slot once the backend creates one.
  const [jurisdictionChoice, setJurisdictionChoice] = useJurisdictionChoice(null);

  // Check if user has no free AI messages (device abuse or zero-limit plan)
  const { data: limitsData } = useUserLimits();
  const hasNoFreeMessages = !isGuest &&
    limitsData?.data?.ai_messages != null &&
    limitsData.data.ai_messages.plan_limit === 0 &&
    limitsData.data.ai_messages.total_remaining === 0 &&
    limitsData.data.ai_messages.payg_remaining === 0;

  // Sync input draft to localStorage
  useEffect(() => {
    if (input) {
      localStorage.setItem('home_input_draft', input);
    } else {
      localStorage.removeItem('home_input_draft');
    }
  }, [input]);

  // Sync pasted content to localStorage
  useEffect(() => {
    if (pastedContent) {
      localStorage.setItem('home_input_pasted', pastedContent);
    } else {
      localStorage.removeItem('home_input_pasted');
    }
  }, [pastedContent]);

  // Check if user is a student (profession === 'student')
  const isStudent = user?.profile?.profession === 'student';

  // Workflow selector — only admin/researcher can pick. Regular users and
  // guests don't send a workflow_id so the backend uses its own default.
  const canSelectWorkflow = !!user?.role && ['superadmin', 'admin', 'researcher'].includes(user.role);
  const workflowParams = { active_only: true, per_page: 50 };
  const { data: workflowsData } = useQuery({
    queryKey: adminAiKeys.workflowsList(workflowParams),
    queryFn: () => adminAiApi.getWorkflows(workflowParams),
    enabled: canSelectWorkflow,
    staleTime: 30 * 1000,
  });
  const workflows = workflowsData?.data ?? [];

  // Pre-select the default workflow for admin/researcher when data loads.
  useEffect(() => {
    if (selectedWorkflowId) return;
    if (!canSelectWorkflow) return;
    if (workflows.length > 0) {
      const defaultWorkflow = workflows.find((w) => w.is_default);
      setSelectedWorkflowId(String((defaultWorkflow ?? workflows[0]).id));
    }
  }, [workflows, selectedWorkflowId, canSelectWorkflow]);

  useEffect(() => {
    // Slide in after a short delay
    const showTimer = setTimeout(() => setShowLinks(true), 500);
    // Slide out after 30 seconds
    const hideTimer = setTimeout(() => setShowLinks(false), 30500);

    return () => {
      clearTimeout(showTimer);
      clearTimeout(hideTimer);
    };
  }, []);

  // Restore saved guest prompt after login — runs when auth state settles
  useEffect(() => {
    if (!isGuest && user) {
      const saved = localStorage.getItem('guest_pending_prompt');
      if (saved) {
        setInput(saved);
        setTimeout(() => inputAreaRef.current?.querySelector('textarea')?.focus(), 100);
      }
    }
  }, [isGuest, user]);

  const handleSubmit = async () => {
    if ((!input.trim() && uploadedFiles.length === 0 && !pastedContent) || isSubmitting || isUploading) return;

    const typedText = input.trim();
    const fullMessage = pastedContent
      ? `<pasted_content>${pastedContent}</pasted_content>${typedText ? '\n\n' + typedText : ''}`
      : typedText;
    if (!fullMessage) return;

    // Guest: save prompt and show auth modal instead of sending
    if (isGuest) {
      localStorage.setItem('guest_pending_prompt', fullMessage);
      setAuthModalOpen(true);
      return;
    }

    localStorage.removeItem('guest_pending_prompt');
    localStorage.removeItem('home_input_draft');
    localStorage.removeItem('home_input_pasted');
    setPastedContent(null);
    setIsSubmitting(true);

    // Snapshot the toggle so we can clear it once the conversation exists.
    const isConfidential = isConfidentialPending;

    // For confidential chats, persist the user turn to IndexedDB BEFORE the
    // POST so a crash doesn't lose it. Use a temp UUID until the server
    // returns the real conversation_id; we rename the row on success.
    let tempConvId: string | null = null;
    if (isConfidential) {
      tempConvId = typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `tmp-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      try {
        await appendUserTurn(tempConvId, {
          content: fullMessage,
          ...(uploadedFiles.length > 0 && {
            attachments: uploadedFiles.map((u) => ({
              file_id: u.file_id!,
              file_name: u.file_name,
              file_size: u.file_size,
            })),
          }),
        });
      } catch {
        // IndexedDB unavailable — fall through and let the user see the
        // standard error path if it actually breaks server-side.
      }
    }

    try {
      // Start chat to get conversation_id
      const fileIds = uploadedFiles.map((u) => u.file_id!).filter((id) => id !== undefined);
      const baseBody = {
        message: fullMessage,
        stream: true as const,
        // Token-level streaming is on by default for everyone.
        stream_mode: 'v2_stream' as const,
        ...(studyMode && { study_mode: true }),
        ...(selectedWorkflowId && { workflow_id: Number(selectedWorkflowId) }),
        ...(fileIds.length > 0 && { file_ids: fileIds }),
        // Confidential turn 1: send the flag + an empty history array.
        // Subsequent turns omit `is_confidential` (immutable) but keep `messages`.
        ...(isConfidential && { is_confidential: true, messages: [] }),
      };
      const response = await chatApi.start(
        applyJurisdiction(baseBody, jurisdictionChoice),
      );

      if (response.success) {
        const conversationId = response.data.conversation_id;
        const executionId = response.data.execution_id;
        // Carry the home-page choice into the conversation's storage slot
        // so subsequent sends in /c/[id] keep using it.
        bridgeHomeJurisdictionToConversation(conversationId);

        // Reconcile the IDB row's temp UUID with the server-assigned one,
        // and mark the conversation as confidential in the session store.
        if (isConfidential) {
          if (tempConvId && tempConvId !== conversationId) {
            try {
              await renameTranscript(tempConvId, conversationId);
            } catch {
              // Non-fatal — rename is best-effort.
            }
          }
          markConfidential(conversationId);
          setConfidentialPending(false);
        }

        // Store message in sessionStorage to avoid URL length limits
        sessionStorage.setItem(`conv_init_${conversationId}`, JSON.stringify({
          msg: fullMessage,
          exec: executionId,
          stream_mode: 'v2_stream',
          ...(uploadedFiles.length > 0 && {
            attachments: uploadedFiles.map((u) => ({
              file_id: u.file_id!,
              file_name: u.file_name,
              file_size: u.file_size,
            })),
          }),
        }));
        router.push(`/c/${conversationId}?init=1`);
      } else {
        // Backend returned success: false — drop the orphan IDB row.
        if (tempConvId) {
          try { await deleteTranscript(tempConvId); } catch { /* noop */ }
        }
        setError({ message: response.message || 'Failed to start conversation', status: 0 });
        setIsSubmitting(false);
      }
    } catch (err) {
      // Handle 409 — user already has a pending conversation (e.g., navigated back and resent)
      if (err instanceof AxiosError && err.response?.status === 409) {
        const data = err.response.data?.data;
        if (data?.conversation_id) {
          if (isConfidential && tempConvId && tempConvId !== data.conversation_id) {
            try { await renameTranscript(tempConvId, data.conversation_id); } catch { /* noop */ }
          }
          router.push(`/c/${data.conversation_id}`);
          return;
        }
      }

      // Any other error — drop the orphan IDB row so we don't leak rows
      // when, e.g., the backend gate is off and returns 422.
      if (tempConvId) {
        try { await deleteTranscript(tempConvId); } catch { /* noop */ }
      }

      const blocked = extractBlockedReason(err);
      if (blocked) {
        setBlockedReason(blocked);
        setError(null);
      } else {
        const apiError = extractApiError(err);
        setError({ message: apiError.message, status: apiError.status });
      }
      setIsSubmitting(false);
    }
  };

  const handleFilesAdded = async (newFiles: File[]) => {
    if (newFiles.length === 0) return;
    if (error) setError(null);

    // Reserve "slots" — accept up to the remaining cap, dedupe by name+size
    // against anything already in the list (uploading or done).
    const existingKeys = new Set(
      uploads.map((u) => `${u.file_name}::${u.file_size}`),
    );
    const remainingSlots = MAX_FILES_PER_TURN - uploads.length;
    const accepted: { file: File; entry: FileUploadEntry }[] = [];
    let rejectedType = false;
    let rejectedSize = false;
    let rejectedDuplicate = false;
    let rejectedCap = false;

    for (const file of newFiles) {
      if (!ALLOWED_FILE_TYPES.includes(file.type)) {
        rejectedType = true;
        continue;
      }
      if (file.size > MAX_DOCUMENT_SIZE) {
        rejectedSize = true;
        continue;
      }
      const dedupKey = `${file.name}::${file.size}`;
      if (existingKeys.has(dedupKey)) {
        rejectedDuplicate = true;
        continue;
      }
      if (accepted.length >= remainingSlots) {
        rejectedCap = true;
        break;
      }
      existingKeys.add(dedupKey);
      const slotKey =
        typeof crypto !== 'undefined' && 'randomUUID' in crypto
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      accepted.push({
        file,
        entry: {
          key: slotKey,
          file_name: file.name,
          file_size: file.size,
          status: 'uploading',
        },
      });
    }

    if (rejectedType) {
      setError({ message: 'Only PDF, DOC, DOCX, and RTF files are supported.', status: 0 });
    } else if (rejectedSize) {
      setError({ message: 'Each file must be 10MB or less.', status: 0 });
    } else if (rejectedCap) {
      setError({ message: `You can attach at most ${MAX_FILES_PER_TURN} files per message.`, status: 0 });
    } else if (rejectedDuplicate && accepted.length === 0) {
      setError({ message: 'That file is already attached.', status: 0 });
    }

    if (accepted.length === 0) return;

    setUploads((prev) => [...prev, ...accepted.map((a) => a.entry)]);

    // Upload in parallel — settle each independently so one failure doesn't
    // block the others. Update each slot in place by key.
    await Promise.all(
      accepted.map(async ({ file, entry }) => {
        try {
          const uploadRes = await chatApi.uploadDocument(file);
          setUploads((prev) =>
            prev.map((u) =>
              u.key === entry.key
                ? {
                    ...u,
                    status: 'uploaded',
                    file_id: uploadRes.data.id,
                    file_name: uploadRes.data.original_name,
                    file_size: uploadRes.data.size,
                  }
                : u,
            ),
          );
        } catch (err) {
          const apiError = extractApiError(err);
          setUploads((prev) =>
            prev.map((u) =>
              u.key === entry.key
                ? { ...u, status: 'failed', error: apiError.message }
                : u,
            ),
          );
        }
      }),
    );
  };

  const removeUpload = (key: string) => {
    setUploads((prev) => prev.filter((u) => u.key !== key));
  };

  const inputAreaRef = useRef<HTMLDivElement>(null);

  const handlePromptClick = (prompt: string) => {
    setInput(prompt);
    inputAreaRef.current?.querySelector('textarea')?.focus();
  };

  const suggestedPrompts = [
    'Explain this law',
    'Find a case on',
    'Do I have rights to',
    'Connect me to a lawyer',
  ];

  return (
    <div
      className="flex flex-col h-full md:h-auto md:min-h-[calc(100vh-120px)] md:items-center md:justify-center px-4"
      style={{ fontFamily: 'var(--font-comfortaa), sans-serif' }}
    >
      {/* ── UPPER CONTENT AREA ─────────────────────────────────── */}
      {/* flex-1 on mobile pushes the input to the bottom; md:flex-none restores desktop flow */}
      <div className="flex-1 md:flex-none flex flex-col items-center justify-center overflow-y-auto md:overflow-visible w-full max-w-2xl">

        {/* Study Mode Toggle - Only shown for students */}
        {isStudent && (
          <div className="mb-4 flex items-center gap-3">
            <span className={`text-sm ${!studyMode ? 'text-foreground font-medium' : 'text-muted-foreground'}`}>
              Normal
            </span>
            <Switch
              checked={studyMode}
              onCheckedChange={setStudyMode}
              size="default"
            />
            <span className={`text-sm ${studyMode ? 'text-primary font-medium' : 'text-muted-foreground'}`}>
              Study Mode
            </span>
          </div>
        )}

        {/* Greeting — swaps to a Confidential Chat heading when the user opts in */}
        {isConfidentialPending ? (
          <div className="mb-4 md:mb-6 flex flex-col items-center text-center">
            <h1 className="text-[26px] md:text-[36px] font-medium text-emerald-600 dark:text-emerald-500">
              Confidential Chat
            </h1>
            <p className="mt-1 max-w-md text-sm md:text-base text-muted-foreground">
              This conversation will not be retained on our servers.
            </p>
          </div>
        ) : (
          <h1 className="mb-4 md:mb-6 text-center text-[26px] md:text-[36px] font-medium">
            {isSpecial === '__PULSING_HEART__' ? (
              <PulsingHeart />
            ) : (
              <>
                {greeting}
                {name && (
                  <>
                    , <span className="text-primary">{name}!</span>
                  </>
                )}
              </>
            )}
          </h1>
        )}

        {/* Resource Links */}
        <div
          className={`mb-2 md:mb-8 w-full flex flex-col md:flex-row md:flex-wrap md:justify-center gap-2 md:gap-4 overflow-hidden transition-all duration-700 ease-out ${
            showLinks ? 'max-h-40 opacity-100' : 'max-h-0 opacity-0'
          }`}
        >
          <a
            href="/docs/Lawexa_State_of_Legal_Intelligence_Report.pdf"
            download
            className="flex items-center gap-2 rounded-2xl md:rounded-full border border-primary/30 bg-primary/5 px-4 py-3 md:py-2 text-sm text-primary transition-colors hover:bg-primary/10"
          >
            <FileText className="h-4 w-4" />
            State of Legal Intelligence Report
          </a>
          <a
            href="https://chat.whatsapp.com/CNDMnd0eWYp4Qiy7k4oVlL"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 rounded-2xl md:rounded-full border border-green-500/30 bg-green-500/5 px-4 py-3 md:py-2 text-sm text-green-600 transition-colors hover:bg-green-500/10 dark:text-green-400"
          >
            <MessageCircle className="h-4 w-4" />
            Join WhatsApp Community
          </a>
        </div>

        {/* Block banner — soft amber, server-provided message + reason-aware CTA */}
        {blockedReason && (
          <MessageBlockBanner
            message={blockedReason.message}
            reason={blockedReason.reason}
            planIsFree={limitsData?.data?.plan?.is_free ?? false}
            resetsAt={blockedReason.resets_at}
            className="mb-4 w-full"
          />
        )}

        {/* Generic error display (network, validation, etc.) */}
        {!blockedReason && error && (
          <div className="mb-4 w-full rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3 text-center text-sm text-destructive">
            {error.message}
          </div>
        )}

        {/* Suggested prompts — vertical list on mobile only */}
        <div className="md:hidden w-full flex flex-col gap-2">
          {suggestedPrompts.map((prompt) => (
            <button
              key={prompt}
              type="button"
              className="text-muted-foreground hover:bg-secondary rounded-2xl border px-4 py-3 text-sm transition-colors text-left"
              onClick={() => {
                if (isGuest) {
                  localStorage.setItem('guest_pending_prompt', prompt);
                  setAuthModalOpen(true);
                } else {
                  handlePromptClick(prompt);
                }
              }}
            >
              {prompt}...
            </button>
          ))}
        </div>

        {/* Library shortcuts — mobile only, two side-by-side */}
        <div className="md:hidden w-full grid grid-cols-2 gap-2 mt-2">
          <button
            type="button"
            className="flex items-center gap-2 rounded-2xl border px-4 py-3 text-sm text-muted-foreground hover:bg-secondary transition-colors"
            onClick={() => router.push('/cases')}
          >
            <Scale className="h-4 w-4 shrink-0 text-primary" />
            Case Library
          </button>
          <button
            type="button"
            className="flex items-center gap-2 rounded-2xl border px-4 py-3 text-sm text-muted-foreground hover:bg-secondary transition-colors"
            onClick={() => router.push('/notes')}
          >
            <NotebookPen className="h-4 w-4 shrink-0 text-primary" />
            Notes Library
          </button>
        </div>

      </div>

      {/* ── BOTTOM INPUT AREA ──────────────────────────────────── */}
      {/* shrink-0 keeps the input at its natural size on mobile; it always stays at the bottom */}
      <div ref={inputAreaRef} className="shrink-0 w-full max-w-2xl pb-2 md:pb-0">
        {hasNoFreeMessages && <NoFreeMessagesBanner className="mb-3" />}
        <FileUpload onFilesAdded={isGuest ? () => {} : handleFilesAdded} accept=".pdf,.doc,.docx,.rtf" multiple>
          {/* Mobile-only jurisdiction badge — sits above the input card, top-left */}
          {!isGuest && (
            <div className="md:hidden mb-2 flex items-center">
              <JurisdictionStatus
                value={jurisdictionChoice}
                onChange={setJurisdictionChoice}
                disabled={isSubmitting}
                triggerClassName="bg-background hover:bg-muted"
              />
            </div>
          )}
          <PromptInput
            value={input}
            onValueChange={(value) => {
              setInput(value);
              if (error) setError(null);
              if (blockedReason) setBlockedReason(null);
            }}
            onSubmit={handleSubmit}
            disabled={isSubmitting || hasNoFreeMessages}
            variant={isConfidentialPending ? 'confidential' : 'default'}
          >
            {/* Attachment chips — one per pending/uploaded/failed file (max 10) */}
            {!isGuest && uploads.length > 0 && (
              <div className="flex flex-wrap gap-2 px-3 pt-3">
                {uploads.map((u) => (
                  <div
                    key={u.key}
                    className={cn(
                      'flex items-center gap-2 rounded-lg px-3 py-2 text-sm',
                      u.status === 'failed'
                        ? 'bg-destructive/10 text-destructive'
                        : 'bg-secondary',
                    )}
                    onClick={(e) => e.stopPropagation()}
                  >
                    {u.status === 'uploading' ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : u.status === 'failed' ? (
                      <X className="h-4 w-4" />
                    ) : (
                      <FileUp className="h-4 w-4" />
                    )}
                    <span className="max-w-[140px] truncate" title={u.file_name}>
                      {u.file_name}
                    </span>
                    {u.status === 'uploaded' && (
                      <span className="text-muted-foreground text-xs">{formatFileSize(u.file_size)}</span>
                    )}
                    {u.status === 'failed' && u.error && (
                      <span className="text-xs opacity-80">{u.error}</span>
                    )}
                    <button
                      type="button"
                      onClick={() => removeUpload(u.key)}
                      className="hover:bg-secondary/50 rounded-full p-1"
                      aria-label={`Remove ${u.file_name}`}
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Pasted content preview */}
            {pastedContent && (
              <div className="mx-3 mt-2">
                <PastedContentCard content={pastedContent} onRemove={() => setPastedContent(null)} />
              </div>
            )}

            <PromptInputTextarea
              placeholder={pastedContent ? 'Add a message...' : 'Ask a legal question'}
              className="text-foreground"
              onLargePaste={setPastedContent}
            />

            <PromptInputActions className="flex items-center justify-between px-3 pb-3 gap-2">
              {/* Left actions: Attach + Jurisdiction + Workflow selector — hidden for guests */}
              <div className="flex items-center gap-1.5 min-w-0">
                {!isGuest && (
                  <PromptInputAction tooltip="Attach PDF">
                    <FileUploadTrigger asChild>
                      <div className="hover:bg-secondary-foreground/10 flex h-8 w-8 cursor-pointer items-center justify-center rounded-2xl shrink-0">
                        <Paperclip className="text-primary h-5 w-5" />
                      </div>
                    </FileUploadTrigger>
                  </PromptInputAction>
                )}

                {/* Workflow selector - admin/researcher only */}
                {canSelectWorkflow && workflows.length > 0 && (
                  <Select
                    value={selectedWorkflowId}
                    onValueChange={setSelectedWorkflowId}
                  >
                    <SelectTrigger size="sm" className="h-7 text-xs border-none bg-transparent hover:bg-secondary-foreground/10 px-2 gap-1 min-w-0 max-w-[120px] sm:max-w-none [&>span]:truncate">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {workflows.map((workflow) => (
                        <SelectItem key={workflow.id} value={String(workflow.id)}>
                          {workflow.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>

              {/* Right group: Jurisdiction badge (desktop only) + Send button */}
              <div className="flex items-center gap-2 shrink-0">
                {!isGuest && (
                  <div className="hidden md:flex">
                    <JurisdictionStatus
                      value={jurisdictionChoice}
                      onChange={setJurisdictionChoice}
                      disabled={isSubmitting}
                    />
                  </div>
                )}
                <PromptInputAction tooltip="Send message">
                  <Button
                    size="icon"
                    className="bg-primary hover:bg-primary/90 h-8 w-8 rounded-full"
                    onClick={handleSubmit}
                    disabled={(!input.trim() && uploadedFiles.length === 0 && !pastedContent) || isSubmitting || isUploading}
                  >
                    {isSubmitting ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      <ArrowUp className="h-5 w-5" />
                    )}
                  </Button>
                </PromptInputAction>
              </div>
            </PromptInputActions>
          </PromptInput>

          {/* Suggested prompts — horizontal row on desktop only */}
          <div className="hidden md:flex mt-3 flex-wrap justify-center gap-2">
            {suggestedPrompts.map((prompt) => (
              <button
                key={prompt}
                type="button"
                className="text-muted-foreground hover:bg-secondary rounded-full border px-4 py-2 text-sm transition-colors"
                onClick={() => {
                  if (isGuest) {
                    localStorage.setItem('guest_pending_prompt', prompt);
                    setAuthModalOpen(true);
                  } else {
                    handlePromptClick(prompt);
                  }
                }}
              >
                {prompt}...
              </button>
            ))}
          </div>

          {/* Drag-and-drop overlay — only for authenticated users */}
          {!isGuest && (
            <FileUploadContent>
              <div className="flex min-h-[200px] w-full items-center justify-center">
                <div className="bg-background/90 m-4 w-full max-w-md rounded-lg border p-8 shadow-lg">
                  <div className="mb-4 flex justify-center">
                    <FileUp className="text-muted-foreground h-8 w-8" />
                  </div>
                  <h3 className="mb-2 text-center text-base font-medium">
                    Drop PDF to upload
                  </h3>
                  <p className="text-muted-foreground text-center text-sm">
                    Release to attach PDF to your message
                  </p>
                </div>
              </div>
            </FileUploadContent>
          )}
        </FileUpload>
      </div>

      {/* Auth modal for guests */}
      {isGuest && <AuthModal open={authModalOpen} onOpenChange={setAuthModalOpen} />}
    </div>
  );
}
