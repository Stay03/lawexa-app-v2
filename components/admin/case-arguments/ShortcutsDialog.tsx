'use client';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface ShortcutsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const SHORTCUTS: Array<[string, string]> = [
  ['j / ↓', 'Next argument'],
  ['k / ↑', 'Previous argument'],
  ['a', 'Keep this one'],
  ['e', 'Edit this one'],
  ['x', 'Throw this one out'],
  ['A', 'Keep everything left on this case'],
  ['g', 'Show the judgment'],
  [']', 'Next case'],
  ['[', 'Previous case'],
  ['?', 'This list'],
];

/** The keys, because a reviewer doing 512 cases will not use the mouse for long. */
export function ShortcutsDialog({ open, onOpenChange }: ShortcutsDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Keyboard shortcuts</DialogTitle>
          <DialogDescription>
            They work whenever you are not typing in a box.
          </DialogDescription>
        </DialogHeader>
        <dl className="divide-y text-sm">
          {SHORTCUTS.map(([key, meaning]) => (
            <div key={key} className="flex items-center justify-between gap-4 py-2">
              <dt>
                <kbd className="rounded border bg-muted px-1.5 py-0.5 font-mono text-xs">
                  {key}
                </kbd>
              </dt>
              <dd className="text-muted-foreground">{meaning}</dd>
            </div>
          ))}
        </dl>
      </DialogContent>
    </Dialog>
  );
}
