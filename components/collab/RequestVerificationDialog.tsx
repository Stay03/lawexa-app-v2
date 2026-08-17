'use client';

import { type ChangeEvent, useRef, useState } from 'react';
import { FileText, Loader2, Upload } from 'lucide-react';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useRequestVerification } from '@/lib/hooks/useCollab';
import { extractApiError } from '@/lib/utils/api-error';

const ACCEPTED_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'];
const MAX_BYTES = 10 * 1024 * 1024;

interface RequestVerificationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orgUuid: string;
  orgName: string;
}

/** Submit BN number + CAC document to request organization verification. */
export function RequestVerificationDialog({
  open,
  onOpenChange,
  orgUuid,
  orgName,
}: RequestVerificationDialogProps) {
  const request = useRequestVerification(orgUuid);
  const inputRef = useRef<HTMLInputElement>(null);
  const [bnNumber, setBnNumber] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFile = (event: ChangeEvent<HTMLInputElement>) => {
    const selected = event.target.files?.[0] ?? null;
    if (selected) {
      if (!ACCEPTED_TYPES.includes(selected.type)) {
        setError('Upload a PDF, JPG or PNG file.');
        return;
      }
      if (selected.size > MAX_BYTES) {
        setError('File must be 10 MB or smaller.');
        return;
      }
    }
    setError(null);
    setFile(selected);
  };

  const handleSubmit = async () => {
    const bn = bnNumber.trim();
    if (!bn || !file || request.isPending) return;
    setError(null);
    try {
      await request.mutateAsync({ bn_number: bn, cac_document: file });
      toast.success('Verification submitted', {
        description: 'A reviewer will confirm your organization shortly.',
      });
      onOpenChange(false);
    } catch (err) {
      setError(extractApiError(err).message);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Verify {orgName}</DialogTitle>
          <DialogDescription>
            Submit your business number and CAC document. Verification unlocks a
            trusted badge for your organization.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="bn-number">BN or RC number</Label>
            <Input
              id="bn-number"
              maxLength={50}
              placeholder="e.g. RC 1716380 or BN1234567"
              value={bnNumber}
              onChange={(event) => setBnNumber(event.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>CAC document</Label>
            <input
              ref={inputRef}
              type="file"
              accept=".pdf,.jpg,.jpeg,.png"
              className="hidden"
              onChange={handleFile}
            />
            <Button
              type="button"
              variant="outline"
              className="w-full justify-start font-normal"
              onClick={() => inputRef.current?.click()}
            >
              {file ? (
                <FileText className="h-4 w-4 shrink-0" />
              ) : (
                <Upload className="h-4 w-4 shrink-0" />
              )}
              <span className="truncate">
                {file ? file.name : 'Choose file — PDF, JPG or PNG (≤10 MB)'}
              </span>
            </Button>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={request.isPending}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={request.isPending || !bnNumber.trim() || !file}
          >
            {request.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Submit for review
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
