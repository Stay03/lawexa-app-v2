'use client';

import { useState } from 'react';
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
import { ArrowUp, Paperclip, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function HomePage() {
  const [input, setInput] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const { greeting, name } = useGreetingParts();

  const handleSubmit = () => {
    if (input.trim() || files.length > 0) {
      console.log('Submitted:', input, files);
      setInput('');
      setFiles([]);
    }
  };

  const handleFilesAdded = (newFiles: File[]) => {
    setFiles((prev) => [...prev, ...newFiles]);
  };

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  return (
    <div className="flex min-h-[calc(100vh-120px)] flex-col items-center justify-center px-4">
      {/* Greeting */}
      <h1 className="mb-8 text-[36px] font-medium">
        {greeting}
        {name && (
          <>
            , <span className="text-primary">{name}!</span>
          </>
        )}
      </h1>

      {/* Prompt Input with FileUpload wrapper */}
      <div className="w-full max-w-2xl">
        <FileUpload onFilesAdded={handleFilesAdded} multiple>
          <PromptInput
            value={input}
            onValueChange={setInput}
            onSubmit={handleSubmit}
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
              placeholder="Ask me anything"
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
                  className="h-8 w-8 rounded-full bg-primary hover:bg-primary/90"
                  onClick={handleSubmit}
                  disabled={!input.trim() && files.length === 0}
                >
                  <ArrowUp className="h-5 w-5" />
                </Button>
              </PromptInputAction>
            </PromptInputActions>
          </PromptInput>

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
