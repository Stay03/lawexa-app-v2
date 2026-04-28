'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { AxiosError } from 'axios';
import { PastedContentCard } from '@/components/chat/pasted-content-card';
import Link from 'next/link';
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
import { ArrowUp, Paperclip, X, Loader2, FileText, MessageCircle, FileUp, Scale, NotebookPen, Info } from 'lucide-react';
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
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { chatApi } from '@/lib/api/chat';
import { useAuthStore } from '@/lib/stores/authStore';
import { AuthModal } from '@/components/auth/AuthModal';
import { useQuery } from '@tanstack/react-query';
import { adminAiApi } from '@/lib/api/admin-ai';
import { adminAiKeys } from '@/lib/hooks/useAdminAi';
import { extractApiError } from '@/lib/utils/api-error';
import { formatFileSize } from '@/lib/validations/admin-cases';
import { useUserLimits } from '@/lib/hooks/useUserLimits';
import { NoFreeMessagesBanner } from '@/components/chat/no-free-messages-banner';
import {
  useJurisdictionChoice,
  bridgeHomeJurisdictionToConversation,
} from '@/lib/hooks/useJurisdictionChoice';
import { applyJurisdiction } from '@/lib/utils/jurisdiction-payload';
import { JurisdictionStatus } from '@/components/chat/jurisdiction-status';

const MAX_DOCUMENT_SIZE = 10 * 1024 * 1024; // 10MB

// Curated workflow options shown to regular users (non-admin/researcher).
// Hardcoded to avoid hitting the admin-only /ai-workflows endpoint.
const REGULAR_USER_WORKFLOWS = [
  {
    id: 5,
    name: 'Lawexa Lite',
    description:
      'Lawexa Lite is a single agent: fast and lightweight, best for quick questions and short follow-ups.',
  },
  {
    id: 12,
    name: 'Lawexa Expert',
    description:
      'Lawexa Expert orchestrates multiple Lawexa agents to research, cross-check, and ground answers — slower but deeper and more thorough.',
  },
] as const;

export default function HomePage() {
  const [input, setInput] = useState(() => {
    if (typeof window === 'undefined') return '';
    return localStorage.getItem('home_input_draft') ?? '';
  });
  const [pastedContent, setPastedContent] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('home_input_pasted') || null;
  });
  const [uploadedFile, setUploadedFile] = useState<{ file_id: number; file_name: string; file_size: number } | null>(null);
  const [uploadingFileName, setUploadingFileName] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [studyMode, setStudyMode] = useState(false);
  const [selectedWorkflowId, setSelectedWorkflowId] = useState<string>('');
  const [error, setError] = useState<{ message: string; status: number } | null>(null);
  const { greeting, name, isSpecial } = useGreetingParts();
  const router = useRouter();
  const [showLinks, setShowLinks] = useState(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const user = useAuthStore((state) => state.user);
  const isGuest = useAuthStore((state) => state.isGuest);

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

  // Workflow selector - admin/researcher get the full list from the API;
  // everyone else (including guests) gets the curated Lite/Expert pair.
  const canSelectWorkflow = !!user?.role && ['superadmin', 'admin', 'researcher'].includes(user.role);
  const showRegularUserWorkflows = !canSelectWorkflow;
  const workflowParams = { active_only: true, per_page: 50 };
  const { data: workflowsData } = useQuery({
    queryKey: adminAiKeys.workflowsList(workflowParams),
    queryFn: () => adminAiApi.getWorkflows(workflowParams),
    enabled: canSelectWorkflow,
    staleTime: 30 * 1000,
  });
  const workflows = workflowsData?.data ?? [];

  // Pre-select the default workflow when data loads
  useEffect(() => {
    if (selectedWorkflowId) return;
    if (showRegularUserWorkflows) {
      // Default to Lawexa Lite for regular users / guests
      setSelectedWorkflowId(String(REGULAR_USER_WORKFLOWS[0].id));
      return;
    }
    if (workflows.length > 0) {
      const defaultWorkflow = workflows.find((w) => w.is_default);
      setSelectedWorkflowId(String((defaultWorkflow ?? workflows[0]).id));
    }
  }, [workflows, selectedWorkflowId, showRegularUserWorkflows]);

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
    if ((!input.trim() && !uploadedFile && !pastedContent) || isSubmitting || isUploading) return;

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

    try {
      // Start chat to get conversation_id
      const baseBody = {
        message: fullMessage,
        stream: true as const,
        // Token-level streaming is on by default for everyone.
        stream_mode: 'v2_stream' as const,
        ...(studyMode && { study_mode: true }),
        ...(selectedWorkflowId && { workflow_id: Number(selectedWorkflowId) }),
        ...(uploadedFile && { file_id: uploadedFile.file_id }),
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

        // Store message in sessionStorage to avoid URL length limits
        sessionStorage.setItem(`conv_init_${conversationId}`, JSON.stringify({
          msg: fullMessage,
          exec: executionId,
          stream_mode: 'v2_stream',
          ...(uploadedFile && {
            file_id: uploadedFile.file_id,
            file_name: uploadedFile.file_name,
            file_size: uploadedFile.file_size,
          }),
        }));
        router.push(`/c/${conversationId}?init=1`);
      } else {
        // Backend returned success: false
        setError({ message: response.message || 'Failed to start conversation', status: 0 });
        setIsSubmitting(false);
      }
    } catch (err) {
      // Handle 409 — user already has a pending conversation (e.g., navigated back and resent)
      if (err instanceof AxiosError && err.response?.status === 409) {
        const data = err.response.data?.data;
        if (data?.conversation_id) {
          router.push(`/c/${data.conversation_id}`);
          return;
        }
      }

      const apiError = extractApiError(err);
      setError({ message: apiError.message, status: apiError.status });
      setIsSubmitting(false);
    }
  };

  const handleFilesAdded = async (newFiles: File[]) => {
    const pdfFile = newFiles[0];
    if (!pdfFile) return;

    const allowedTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/rtf',
      'text/rtf'
    ];
    if (!allowedTypes.includes(pdfFile.type)) {
      setError({ message: 'Only PDF, DOC, DOCX, and RTF files are supported.', status: 0 });
      return;
    }
    if (pdfFile.size > MAX_DOCUMENT_SIZE) {
      setError({ message: 'File size must be 10MB or less.', status: 0 });
      return;
    }

    if (error) setError(null);
    setUploadingFileName(pdfFile.name);
    setIsUploading(true);

    try {
      const uploadRes = await chatApi.uploadDocument(pdfFile);
      setUploadedFile({
        file_id: uploadRes.data.id,
        file_name: uploadRes.data.original_name,
        file_size: uploadRes.data.size,
      });
    } catch (err) {
      const apiError = extractApiError(err);
      setError({ message: apiError.message, status: apiError.status });
    } finally {
      setIsUploading(false);
      setUploadingFileName(null);
    }
  };

  const removeFile = () => {
    setUploadedFile(null);
    setUploadingFileName(null);
    setIsUploading(false);
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

        {/* Greeting */}
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

        {/* Error display */}
        {error && (
          <div className="mb-4 w-full rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3 text-center text-sm text-destructive">
            {error.status === 403 && error.message.toLowerCase().includes('messages remaining') ? (
              <>
                You&apos;ve reached your AI message limit for this plan.{' '}
                <Link href="/pricing" className="font-semibold underline hover:text-destructive/80">
                  Upgrade to Pro
                </Link>{' '}
                for a higher monthly limit, or{' '}
                <Link href="/pricing?tab=payg" className="font-semibold underline hover:text-destructive/80">
                  Buy more messages
                </Link>{' '}
                to keep the conversation going right now.
              </>
            ) : (
              error.message
            )}
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
        <FileUpload onFilesAdded={isGuest ? () => {} : handleFilesAdded} accept=".pdf,.doc,.docx,.rtf" multiple={false}>
          <PromptInput
            value={input}
            onValueChange={(value) => {
              setInput(value);
              if (error) setError(null);
            }}
            onSubmit={handleSubmit}
            disabled={isSubmitting || hasNoFreeMessages}
          >
            {/* Document File Preview inside input — hidden for guests */}
            {!isGuest && (isUploading || uploadedFile) && (
              <div className="flex flex-wrap gap-2 px-3 pt-3">
                <div
                  className="bg-secondary flex items-center gap-2 rounded-lg px-3 py-2 text-sm"
                  onClick={(e) => e.stopPropagation()}
                >
                  {isUploading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <FileUp className="h-4 w-4" />
                  )}
                  <span className="max-w-[120px] truncate">
                    {uploadedFile?.file_name || uploadingFileName}
                  </span>
                  {uploadedFile && (
                    <span className="text-muted-foreground text-xs">{formatFileSize(uploadedFile.file_size)}</span>
                  )}
                  <button
                    onClick={removeFile}
                    className="hover:bg-secondary/50 rounded-full p-1"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
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

                {!isGuest && (
                  <JurisdictionStatus
                    value={jurisdictionChoice}
                    onChange={setJurisdictionChoice}
                    disabled={isSubmitting}
                  />
                )}

                {/* Workflow selector - admin/researcher get the full list from the API */}
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

                {/* Curated Lite/Expert selector - everyone else (incl. guests) */}
                {showRegularUserWorkflows && (() => {
                  const activeWorkflow =
                    REGULAR_USER_WORKFLOWS.find((wf) => String(wf.id) === selectedWorkflowId) ??
                    REGULAR_USER_WORKFLOWS[0];
                  return (
                    <div className="flex items-center gap-0.5">
                      <Select
                        value={selectedWorkflowId}
                        onValueChange={setSelectedWorkflowId}
                      >
                        <SelectTrigger size="sm" className="h-7 text-xs border-none bg-transparent hover:bg-secondary-foreground/10 px-2 gap-1 min-w-0 max-w-[140px] sm:max-w-none [&>span]:truncate">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {REGULAR_USER_WORKFLOWS.map((wf) => (
                            <SelectItem key={wf.id} value={String(wf.id)}>
                              {wf.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            type="button"
                            aria-label={`About ${activeWorkflow.name}`}
                            className="text-muted-foreground hover:text-foreground rounded-full p-1"
                          >
                            <Info className="h-3.5 w-3.5" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs">
                          {activeWorkflow.description}
                        </TooltipContent>
                      </Tooltip>
                    </div>
                  );
                })()}
              </div>

              {/* Send button - RIGHT */}
              <PromptInputAction tooltip="Send message">
                <Button
                  size="icon"
                  className="bg-primary hover:bg-primary/90 h-8 w-8 rounded-full"
                  onClick={handleSubmit}
                  disabled={(!input.trim() && !uploadedFile && !pastedContent) || isSubmitting || isUploading}
                >
                  {isSubmitting ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <ArrowUp className="h-5 w-5" />
                  )}
                </Button>
              </PromptInputAction>
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
