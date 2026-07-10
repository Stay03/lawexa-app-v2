'use client';

import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useUpdateCasePrinciple } from '@/lib/hooks/useAdminCasePrinciples';
import { extractApiError } from '@/lib/utils/api-error';
import type {
  CasePrincipleReviewItem,
  PrincipleLawType,
  PrincipleType,
  UpdatePrincipleData,
} from '@/types/admin-case-principles';

interface PrincipleEditDialogProps {
  principle: CasePrincipleReviewItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const TYPE_NONE = 'none';
const LAW_TYPES: PrincipleLawType[] = ['procedural', 'substantive'];

/** Inner form, keyed by principle id so each principle initializes fresh state. */
function EditForm({
  principle,
  onClose,
}: {
  principle: CasePrincipleReviewItem;
  onClose: () => void;
}) {
  const [text, setText] = useState(principle.principle);
  const [type, setType] = useState<PrincipleType | typeof TYPE_NONE>(
    principle.type ?? TYPE_NONE
  );
  const [tag, setTag] = useState(principle.tag ?? '');
  const [lawType, setLawType] = useState<PrincipleLawType[]>(principle.law_type ?? []);

  const updateMutation = useUpdateCasePrinciple();

  const buildPayload = (approve: boolean): UpdatePrincipleData => ({
    principle: text.trim(),
    type: type === TYPE_NONE ? null : type,
    tag: tag.trim() ? tag.trim() : null,
    law_type: lawType,
    ...(approve ? { reviewed: true } : {}),
  });

  const submit = (approve: boolean) => {
    if (!text.trim()) {
      toast.error('Principle text is required');
      return;
    }
    updateMutation.mutate(
      { id: principle.id, data: buildPayload(approve) },
      {
        onSuccess: () => {
          toast.success(approve ? 'Principle approved' : 'Changes saved');
          onClose();
        },
        onError: (error) => toast.error(extractApiError(error).message),
      }
    );
  };

  const toggleLawType = (value: PrincipleLawType, checked: boolean) => {
    setLawType((prev) =>
      checked ? [...new Set([...prev, value])] : prev.filter((v) => v !== value)
    );
  };

  const isBusy = updateMutation.isPending;

  return (
    <>
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="principle-text">Principle</Label>
          <Textarea
            id="principle-text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="min-h-[140px] resize-y"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Type</Label>
            <Select value={type} onValueChange={(v) => setType(v as PrincipleType | typeof TYPE_NONE)}>
              <SelectTrigger className="capitalize">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={TYPE_NONE}>Unset</SelectItem>
                <SelectItem value="ratio">Ratio</SelectItem>
                <SelectItem value="obiter">Obiter</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="principle-tag">Tag</Label>
            <Input
              id="principle-tag"
              value={tag}
              onChange={(e) => setTag(e.target.value)}
              placeholder="e.g. stay of execution"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label>Law type</Label>
          <div className="flex gap-4">
            {LAW_TYPES.map((lt) => (
              <label key={lt} className="flex items-center gap-2 text-sm capitalize">
                <Checkbox
                  checked={lawType.includes(lt)}
                  onCheckedChange={(c) => toggleLawType(lt, c === true)}
                />
                {lt}
              </label>
            ))}
          </div>
        </div>
      </div>

      <DialogFooter className="gap-2 sm:gap-2">
        <Button variant="outline" onClick={onClose} disabled={isBusy}>
          Cancel
        </Button>
        <Button variant="secondary" onClick={() => submit(false)} disabled={isBusy}>
          {isBusy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Save
        </Button>
        <Button onClick={() => submit(true)} disabled={isBusy}>
          {isBusy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Save &amp; Approve
        </Button>
      </DialogFooter>
    </>
  );
}

export function PrincipleEditDialog({
  principle,
  open,
  onOpenChange,
}: PrincipleEditDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Edit principle</DialogTitle>
          <DialogDescription>
            {principle?.case?.title ?? 'Refine the extracted principle before approving.'}
          </DialogDescription>
        </DialogHeader>
        {principle && (
          <EditForm
            key={principle.id}
            principle={principle}
            onClose={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
