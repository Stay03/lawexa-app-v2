'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
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
import { ArrowUp, Paperclip, X, Loader2, FileText, MessageCircle, FileUp } from 'lucide-react';
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
import { useQuery } from '@tanstack/react-query';
import { adminAiApi } from '@/lib/api/admin-ai';
import { adminAiKeys } from '@/lib/hooks/useAdminAi';
import { extractApiError } from '@/lib/utils/api-error';
import { formatFileSize } from '@/lib/validations/admin-cases';

const MAX_PDF_SIZE = 10 * 1024 * 1024; // 10MB

export default function HomePage() {
  const [input, setInput] = useState('');
  const [uploadedFile, setUploadedFile] = useState<{ file_id: number; file_name: string; file_size: number } | null>(null);
  const [uploadingFileName, setUploadingFileName] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [studyMode, setStudyMode] = useState(false);
  const [selectedWorkflowId, setSelectedWorkflowId] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const { greeting, name, isSpecial } = useGreetingParts();
  const router = useRouter();
  const [showLinks, setShowLinks] = useState(false);
  const user = useAuthStore((state) => state.user);

  // Check if user is a student (profession === 'student')
  const isStudent = user?.profile?.profession === 'student';

  // Workflow selector - only for superadmin, admin, researcher
  const canSelectWorkflow = !!user?.role && ['superadmin', 'admin', 'researcher'].includes(user.role);
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
    if (workflows.length > 0 && !selectedWorkflowId) {
      const defaultWorkflow = workflows.find((w) => w.is_default);
      if (defaultWorkflow) {
        setSelectedWorkflowId(String(defaultWorkflow.id));
      } else {
        setSelectedWorkflowId(String(workflows[0].id));
      }
    }
  }, [workflows, selectedWorkflowId]);

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

  const handleSubmit = async () => {
    if ((!input.trim() && !uploadedFile) || isSubmitting || isUploading) return;

    const message = input.trim();
    if (!message) return;

    setIsSubmitting(true);

    try {
      // Start chat to get conversation_id
      const response = await chatApi.start({
        message,
        stream: true,
        ...(studyMode && { study_mode: true }),
        ...(selectedWorkflowId && canSelectWorkflow && { workflow_id: Number(selectedWorkflowId) }),
        ...(uploadedFile && { file_id: uploadedFile.file_id }),
      });

      if (response.success) {
        const conversationId = response.data.conversation_id;
        const executionId = response.data.execution_id;
        router.push(`/c/${conversationId}?msg=${encodeURIComponent(message)}&exec=${executionId}`);
      }
    } catch (err) {
      const apiError = extractApiError(err);
      setError(apiError.message);
      setIsSubmitting(false);
    }
  };

  const handleFilesAdded = async (newFiles: File[]) => {
    const pdfFile = newFiles[0];
    if (!pdfFile) return;

    if (pdfFile.type !== 'application/pdf') {
      setError('Only PDF files are supported.');
      return;
    }
    if (pdfFile.size > MAX_PDF_SIZE) {
      setError('File size must be 10MB or less.');
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
      setError(apiError.message);
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

  return (
    <div className="flex min-h-[calc(100vh-120px)] flex-col items-center justify-center px-4" style={{ fontFamily: 'var(--font-comfortaa), sans-serif' }}>
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
      <h1 className="mb-6 text-center text-[36px] font-medium">
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
        className={`mb-8 flex flex-wrap justify-center gap-4 overflow-hidden transition-all duration-700 ease-out ${
          showLinks ? 'max-h-40 opacity-100' : 'max-h-0 opacity-0'
        }`}
      >
        <a
          href="/docs/Lawexa_State_of_Legal_Intelligence_Report.pdf"
          download
          className="flex items-center gap-2 rounded-full border border-primary/30 bg-primary/5 px-4 py-2 text-sm text-primary transition-colors hover:bg-primary/10"
        >
          <FileText className="h-4 w-4" />
          State of Legal Intelligence Report
        </a>
        <a
          href="https://chat.whatsapp.com/CNDMnd0eWYp4Qiy7k4oVlL"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 rounded-full border border-green-500/30 bg-green-500/5 px-4 py-2 text-sm text-green-600 transition-colors hover:bg-green-500/10 dark:text-green-400"
        >
          <MessageCircle className="h-4 w-4" />
          Join WhatsApp Community
        </a>
      </div>

      {/* Error display */}
      {error && (
        <div className="mb-4 w-full max-w-2xl rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3 text-center text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Prompt Input with FileUpload wrapper */}
      <div className="w-full max-w-2xl">
        <FileUpload onFilesAdded={handleFilesAdded} accept="application/pdf" multiple={false}>
          <PromptInput
            value={input}
            onValueChange={(value) => {
              setInput(value);
              if (error) setError(null);
            }}
            onSubmit={handleSubmit}
            disabled={isSubmitting}
          >
            {/* PDF File Preview inside input */}
            {(isUploading || uploadedFile) && (
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

            <PromptInputTextarea
              placeholder="Ask a legal question"
              className="text-foreground"
            />

            <PromptInputActions className="flex items-center justify-between px-3 pb-3">
              {/* Left actions: Attach + Workflow selector */}
              <div className="flex items-center gap-1">
                <PromptInputAction tooltip="Attach PDF">
                  <FileUploadTrigger asChild>
                    <div className="hover:bg-secondary-foreground/10 flex h-8 w-8 cursor-pointer items-center justify-center rounded-2xl">
                      <Paperclip className="text-primary h-5 w-5" />
                    </div>
                  </FileUploadTrigger>
                </PromptInputAction>

                {/* Workflow selector - only for superadmin, admin, researcher */}
                {canSelectWorkflow && workflows.length > 0 && (
                  <Select
                    value={selectedWorkflowId}
                    onValueChange={setSelectedWorkflowId}
                  >
                    <SelectTrigger size="sm" className="h-7 text-xs border-none bg-transparent hover:bg-secondary-foreground/10 px-2 gap-1">
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

              {/* Send button - RIGHT */}
              <PromptInputAction tooltip="Send message">
                <Button
                  size="icon"
                  className="bg-primary hover:bg-primary/90 h-8 w-8 rounded-full"
                  onClick={handleSubmit}
                  disabled={(!input.trim() && !uploadedFile) || isSubmitting || isUploading}
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

          {/* Suggested prompts */}
          <div className="mt-3 flex flex-wrap justify-center gap-2">
            {[
              'Explain this law',
              'Find a case on',
              'Do I have rights to',
              'Connect me to a lawyer',
            ].map((prompt) => (
              <button
                key={prompt}
                type="button"
                className="text-muted-foreground hover:bg-secondary rounded-full border px-4 py-2 text-sm transition-colors"
                onClick={() => setInput(prompt)}
              >
                {prompt}
              </button>
            ))}
          </div>

          {/* Drag-and-drop overlay */}
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
        </FileUpload>
      </div>
    </div>
  );
}
