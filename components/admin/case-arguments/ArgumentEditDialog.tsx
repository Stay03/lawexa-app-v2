'use client';

import { useState } from 'react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import type {
  ArgumentSide,
  CaseArgumentReviewItem,
  UpdateArgumentData,
} from '@/types/admin-case-arguments';

interface ArgumentEditDialogProps {
  argument: CaseArgumentReviewItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  saving: boolean;
  onSave: (id: number, data: UpdateArgumentData, approve: boolean) => void;
}

/**
 * The form, remounted per argument.
 *
 * The fields start from the row they are editing, and the way to get that is a
 * fresh mount keyed on the id rather than an effect that copies props into
 * state. That pattern is a lint error in this repo and a cascading render
 * anywhere else, and it is also how a draft for one submission leaks onto the
 * next one a reviewer opens.
 */
function EditForm({
  argument,
  saving,
  onSave,
  onClose,
}: {
  argument: CaseArgumentReviewItem;
  saving: boolean;
  onSave: (id: number, data: UpdateArgumentData, approve: boolean) => void;
  onClose: () => void;
}) {
  const [text, setText] = useState(argument.argument ?? '');
  const [side, setSide] = useState<ArgumentSide | ''>(argument.side ?? '');
  const [status, setStatus] = useState(argument.status ?? '');

  /* Only what changed is sent, so a save never rewrites a field the reviewer
     did not touch. */
  const submit = (approve: boolean) => {
    const data: UpdateArgumentData = {};
    if (text !== (argument.argument ?? '')) data.argument = text;
    if (side && side !== argument.side) data.side = side;
    if (status !== (argument.status ?? '')) data.status = status || null;
    if (approve) data.reviewed = true;
    onSave(argument.id, data, approve);
  };

  return (
    <>
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="argument-text">The submission</Label>
          <Textarea
            id="argument-text"
            value={text}
            onChange={(event) => setText(event.target.value)}
            rows={10}
            className="leading-relaxed"
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="argument-side">Who argued it</Label>
            <Select
              value={side || undefined}
              onValueChange={(value) => setSide(value as ArgumentSide)}
            >
              <SelectTrigger id="argument-side">
                <SelectValue placeholder="Not recorded" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="appellant">Appellant</SelectItem>
                <SelectItem value="respondent">Respondent</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="argument-status">What the court did with it</Label>
            <Select value={status || undefined} onValueChange={setStatus}>
              <SelectTrigger id="argument-status">
                <SelectValue placeholder="Not recorded" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="accepted">Court accepted it</SelectItem>
                <SelectItem value="rejected">Court rejected it</SelectItem>
                <SelectItem value="not_decided">Court did not decide</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              What the judgment did with this submission. Your own decision on
              it is Keep or Throw out.
            </p>
          </div>
        </div>
      </div>

      <DialogFooter className="gap-2">
        <Button type="button" variant="ghost" onClick={onClose} disabled={saving}>
          Cancel
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => submit(false)}
          disabled={saving}
        >
          Save
        </Button>
        <Button type="button" onClick={() => submit(true)} disabled={saving}>
          Save and keep
        </Button>
      </DialogFooter>
    </>
  );
}

/**
 * Fix the wording, then keep it — or fix it and leave it in the queue.
 *
 * Two buttons rather than a checkbox, because "save" and "save and keep" are
 * different decisions and a reviewer moving fast should not have to notice a
 * tick box to make the one they meant. Editing alone never changes the review
 * state; the server is explicit about that and so is this.
 */
export function ArgumentEditDialog({
  argument,
  open,
  onOpenChange,
  saving,
  onSave,
}: ArgumentEditDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Edit this argument</DialogTitle>
          <DialogDescription>
            Change what it says. Saving alone leaves it in the queue.
          </DialogDescription>
        </DialogHeader>

        {argument && (
          <EditForm
            key={argument.id}
            argument={argument}
            saving={saving}
            onSave={onSave}
            onClose={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
