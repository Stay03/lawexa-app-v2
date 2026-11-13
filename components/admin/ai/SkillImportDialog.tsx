'use client';

import { useState } from 'react';
import Link from 'next/link';
import { FileArchive, Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { useImportSkillZip } from '@/lib/hooks/useAdminAi';
import { extractApiError } from '@/lib/utils/api-error';
import type { AdminSkillDraftImportResponse } from '@/types/skill-draft';
import { importFileProblem, importProblem } from './skill-draft-model';

/**
 * Import a SKILL.md zip as a draft (the skills tool, Arthur's option 3): the
 * server reads the one SKILL.md in it and lists every other file it skipped.
 * The draft then waits for review like one saved from a chat. A refused zip
 * shows the server's reason (no SKILL.md, two of them, a path outside the
 * zip, no front matter, a field too long, too many files, too big).
 */
export function SkillImportDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const importZip = useImportSkillZip();
  const [file, setFile] = useState<File | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [result, setResult] = useState<AdminSkillDraftImportResponse | null>(null);

  const reset = () => {
    setFile(null);
    setProblem(null);
    setResult(null);
    importZip.reset();
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) reset();
    onOpenChange(next);
  };

  const choose = (chosen: File | null) => {
    setResult(null);
    setFile(chosen);
    setProblem(chosen ? importFileProblem(chosen) : null);
  };

  const submit = () => {
    if (!file || importFileProblem(file)) return;
    setProblem(null);
    importZip.mutate(file, {
      onSuccess: (response) => setResult(response),
      onError: (error) => setProblem(importProblem(extractApiError(error))),
    });
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Import SKILL.md zip</DialogTitle>
          <DialogDescription>
            A zip with one SKILL.md, at most 1 MB. It becomes a draft waiting for review. Other files are listed and skipped.
          </DialogDescription>
        </DialogHeader>

        {result ? (
          <div className="space-y-3">
            <p role="status" className="text-sm">
              {result.message}
            </p>
            {result.data.skipped_files.length > 0 ? (
              <div>
                <p className="text-xs font-medium text-muted-foreground">Skipped files</p>
                <ul className="mt-1 max-h-40 overflow-y-auto rounded-md border px-3 py-2 font-mono text-xs">
                  {result.data.skipped_files.map((path) => (
                    <li key={path} className="truncate">
                      {path}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        ) : (
          <div className="space-y-2">
            <Label htmlFor="skill-zip">Zip file</Label>
            <input
              id="skill-zip"
              type="file"
              accept=".zip,application/zip"
              onChange={(e) => choose(e.target.files?.[0] ?? null)}
              className="block w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-secondary file:px-3 file:py-1.5 file:text-sm file:font-medium"
            />
            {file && !problem ? (
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <FileArchive aria-hidden className="h-3.5 w-3.5" />
                {file.name} · {(file.size / 1024).toFixed(0)} KB
              </p>
            ) : null}
            {problem ? (
              <p role="alert" className="text-sm text-destructive">
                {problem}
              </p>
            ) : null}
          </div>
        )}

        <DialogFooter>
          {result ? (
            <>
              <Button type="button" variant="outline" onClick={reset}>
                Import another
              </Button>
              <Button asChild>
                <Link href={`/admin/ai/skills/drafts/${result.data.draft.uuid}`}>Open the draft</Link>
              </Button>
            </>
          ) : (
            <>
              <Button type="button" variant="outline" onClick={() => handleOpenChange(false)} disabled={importZip.isPending}>
                Cancel
              </Button>
              <Button type="button" onClick={submit} disabled={!file || !!problem || importZip.isPending}>
                {importZip.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Import
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
