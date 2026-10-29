'use client';

import { useState } from 'react';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

import { useChangeUserRole } from '@/lib/hooks/useAdmin';
import { extractApiError } from '@/lib/utils/api-error';
import { cn } from '@/lib/utils';
import type { UserRole } from '@/types/auth';
import {
  CHANGEABLE_ROLES,
  ROLE_DESCRIPTIONS,
  ROLE_LABELS,
  asRole,
  assignableRoles,
  displayName,
  roleWithArticle,
  type ChangeableRole,
} from './change-role-model';

interface ChangeRoleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  actorRole: UserRole | null;
  user: { uuid: string; name: string; role: string };
}

/**
 * The admin "Change role" dialog (Arthur chose option 3 on 29 October 2026;
 * the techlead approved design d0ed4466 the same day). Picking a role and
 * pressing the named button is the confirmation. The target's current role is
 * listed as "Current" and is never pickable; only roles the actor may set are
 * offered (see change-role-model.ts).
 */
export function ChangeRoleDialog({
  open,
  onOpenChange,
  actorRole,
  user,
}: ChangeRoleDialogProps) {
  const mutation = useChangeUserRole();
  const saving = mutation.isPending;

  const handleOpenChange = (next: boolean) => {
    if (!next && saving) return;
    onOpenChange(next);
  };

  // Radix unmounts the content on close, so the body (keyed by user) starts
  // fresh on every open: no picked role, no old error, no setState in an effect.
  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <ChangeRoleBody
          key={user.uuid}
          actorRole={actorRole}
          user={user}
          saving={saving}
          save={(role) => mutation.mutateAsync({ uuid: user.uuid, role })}
          onDone={() => onOpenChange(false)}
          onCancel={() => handleOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}

function ChangeRoleBody({
  actorRole,
  user,
  saving,
  save,
  onDone,
  onCancel,
}: {
  actorRole: UserRole | null;
  user: { uuid: string; name: string; role: string };
  saving: boolean;
  save: (role: ChangeableRole) => Promise<unknown>;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [picked, setPicked] = useState<ChangeableRole | null>(null);
  const [error, setError] = useState<string | null>(null);

  const name = displayName(user.name);
  const current = asRole(user.role);
  // "is a User now", as the approved design reads and as the toast says it.
  const currentLabel = current ? roleWithArticle(current) : user.role;
  const offered = assignableRoles(actorRole, user.role);
  const rows = CHANGEABLE_ROLES.filter(
    (role) => role === current || offered.includes(role)
  );

  const handleSave = async () => {
    if (picked === null || picked === current) return;
    setError(null);
    try {
      await save(picked);
      toast.success(`${name} is now ${roleWithArticle(picked)}`);
      onDone();
    } catch (err) {
      // The app's QueryClient (providers/QueryProvider.tsx) has no global
      // mutation error toast, so the server's message shows here alone and the
      // dialog stays open.
      setError(extractApiError(err).message);
    }
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>Change role</DialogTitle>
        <DialogDescription>
          {name} is {currentLabel} now.
        </DialogDescription>
      </DialogHeader>

      <fieldset className="space-y-1.5" disabled={saving}>
        <legend className="sr-only">New role</legend>
        {rows.map((role) => {
          const isCurrent = role === current;
          const selected = role === picked;
          return (
            <label
              key={role}
              className={cn(
                'flex items-start gap-3 rounded-lg border px-3 py-2.5 text-sm transition-colors',
                isCurrent
                  ? 'cursor-not-allowed bg-muted/40 opacity-70'
                  : 'cursor-pointer hover:bg-muted/50',
                selected && 'border-primary bg-primary/5',
                'has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring'
              )}
            >
              <input
                type="radio"
                name={`change-role-${user.uuid}`}
                value={role}
                checked={selected}
                disabled={isCurrent}
                onChange={() => setPicked(role)}
                className="mt-0.5 h-4 w-4 shrink-0 accent-primary"
              />
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2 font-medium">
                  {ROLE_LABELS[role]}
                  {isCurrent && (
                    <Badge variant="secondary" className="h-5 px-1.5 text-[11px]">
                      Current
                    </Badge>
                  )}
                </span>
                <span className="mt-0.5 block text-xs text-muted-foreground">
                  {ROLE_DESCRIPTIONS[role]}
                </span>
              </span>
            </label>
          );
        })}
      </fieldset>

      {picked === 'superadmin' && (
        <p className="flex items-start gap-2 text-sm text-amber-600 dark:text-amber-500">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          They will be able to change every account’s role, including yours.
        </p>
      )}

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}

      <DialogFooter>
        <Button variant="outline" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
        <Button
          onClick={handleSave}
          disabled={picked === null || picked === current || saving}
        >
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {picked ? `Change to ${ROLE_LABELS[picked]}` : 'Change role'}
        </Button>
      </DialogFooter>
    </>
  );
}
