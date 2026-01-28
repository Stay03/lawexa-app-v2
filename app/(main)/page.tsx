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
import { ArrowUp, Paperclip, X, Loader2, FileText, MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { chatApi } from '@/lib/api/chat';

export default function HomePage() {
  const [input, setInput] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { greeting, name } = useGreetingParts();
  const router = useRouter();
  const [showLinks, setShowLinks] = useState(false);

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
    if ((!input.trim() && files.length === 0) || isSubmitting) return;

    const message = input.trim();
    if (!message) return;

    setIsSubmitting(true);

    try {
      // Start chat to get conversation_id
      const response = await chatApi.start({
        message,
        stream: true,
      });

      if (response.success) {
        // Navigate to conversation page with the message and execution_id
        const conversationId = response.data.conversation_id;
        const executionId = response.data.execution_id;

        // Pass initial message and execution_id via URL params
        router.push(`/c/${conversationId}?msg=${encodeURIComponent(message)}&exec=${executionId}`);
      }
    } catch (error) {
      console.error('Failed to start chat:', error);
      setIsSubmitting(false);
    }
  };

  const handleFilesAdded = (newFiles: File[]) => {
    setFiles((prev) => [...prev, ...newFiles]);
  };

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  return (
    <div className="flex min-h-[calc(100vh-120px)] flex-col items-center justify-center px-4" style={{ fontFamily: 'var(--font-comfortaa), sans-serif' }}>
      {/* Greeting */}
      <h1 className="mb-6 text-[36px] font-medium">
        {greeting}
        {name && (
          <>
            , <span className="text-primary">{name}!</span>
          </>
        )}
      </h1>

      {/* Resource Links */}
      <div
        className={`mb-8 flex flex-wrap justify-center gap-4 overflow-hidden transition-all duration-700 ease-out ${
          showLinks ? 'max-h-20 opacity-100' : 'max-h-0 opacity-0'
        }`}
      >
        <a
          href="/docs/Lawexa State of Legal Intelligence Report.pdf"
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

      {/* Prompt Input with FileUpload wrapper */}
      <div className="w-full max-w-2xl">
        <FileUpload onFilesAdded={handleFilesAdded} multiple>
          <PromptInput
            value={input}
            onValueChange={setInput}
            onSubmit={handleSubmit}
            disabled={isSubmitting}
          >
            {/* File Previews inside input */}
            {files.length > 0 && (
              <div className="flex flex-wrap gap-2 px-3 pt-3">
                {files.map((file, index) => (
                  <div
                    key={index}
                    className="bg-secondary flex items-center gap-2 rounded-lg px-3 py-2 text-sm"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Paperclip className="h-4 w-4" />
                    <span className="max-w-[120px] truncate">{file.name}</span>
                    <button
                      onClick={() => removeFile(index)}
                      className="hover:bg-secondary/50 rounded-full p-1"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <PromptInputTextarea
              placeholder="Ask a legal question"
              className="text-foreground"
            />

            <PromptInputActions className="flex items-center justify-between px-3 pb-3">
              {/* Attach button - LEFT */}
              <PromptInputAction tooltip="Attach files">
                <FileUploadTrigger asChild>
                  <div className="hover:bg-secondary-foreground/10 flex h-8 w-8 cursor-pointer items-center justify-center rounded-2xl">
                    <Paperclip className="text-primary h-5 w-5" />
                  </div>
                </FileUploadTrigger>
              </PromptInputAction>

              {/* Send button - RIGHT */}
              <PromptInputAction tooltip="Send message">
                <Button
                  size="icon"
                  className="bg-primary hover:bg-primary/90 h-8 w-8 rounded-full"
                  onClick={handleSubmit}
                  disabled={(!input.trim() && files.length === 0) || isSubmitting}
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
                  <Paperclip className="text-muted-foreground h-8 w-8" />
                </div>
                <h3 className="mb-2 text-center text-base font-medium">
                  Drop files to upload
                </h3>
                <p className="text-muted-foreground text-center text-sm">
                  Release to add files to your message
                </p>
              </div>
            </div>
          </FileUploadContent>
        </FileUpload>
      </div>
    </div>
  );
}
