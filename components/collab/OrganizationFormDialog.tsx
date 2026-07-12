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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import {
  useCreateOrganization,
  useUpdateOrganization,
} from '@/lib/hooks/useCollab';
import { extractApiError } from '@/lib/utils/api-error';
import type { Organization, OrganizationType } from '@/types/collab';

const ORG_TYPES: { value: OrganizationType; label: string }[] = [
  { value: 'law_firm', label: 'Law Firm' },
  { value: 'university', label: 'University' },
  { value: 'company', label: 'Company' },
  { value: 'bank', label: 'Bank' },
  { value: 'other', label: 'Other' },
];

interface OrganizationFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Presence switches the dialog into edit mode. */
  organization?: Organization;
}

/** Create or edit an organization. Type is locked once the org is verified. */
export function OrganizationFormDialog({
  open,
  onOpenChange,
  organization,
}: OrganizationFormDialogProps) {
  const isEdit = !!organization;
  const createOrg = useCreateOrganization();
  const updateOrg = useUpdateOrganization();

  const [name, setName] = useState(organization?.name ?? '');
  const [type, setType] = useState<OrganizationType>(
    organization?.type ?? 'law_firm'
  );
  const [email, setEmail] = useState(organization?.email ?? '');
  const [website, setWebsite] = useState(organization?.website ?? '');
  const [city, setCity] = useState(organization?.city ?? '');
  const [country, setCountry] = useState(organization?.country ?? '');
  const [description, setDescription] = useState(
    organization?.description ?? ''
  );
  const [error, setError] = useState<string | null>(null);

  const submitting = createOrg.isPending || updateOrg.isPending;
  const typeLocked = isEdit && !!organization?.is_verified;

  const handleSubmit = async () => {
    const trimmed = name.trim();
    if (!trimmed || submitting) return;
    setError(null);
    const payload = {
      name: trimmed,
      type,
      email: email.trim() || undefined,
      website: website.trim() || undefined,
      city: city.trim() || undefined,
      country: country.trim() || undefined,
      description: description.trim() || undefined,
    };
    try {
      if (isEdit && organization) {
        await updateOrg.mutateAsync({ uuid: organization.uuid, payload });
        toast.success('Organization updated');
      } else {
        await createOrg.mutateAsync(payload);
        toast.success('Organization created');
      }
      onOpenChange(false);
    } catch (err) {
      setError(extractApiError(err).message);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? 'Edit organization' : 'Create an organization'}
          </DialogTitle>
          <DialogDescription>
            {isEdit
              ? 'Update your organization’s details.'
              : 'Set up an organization to own shared spaces and get verified.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="org-name">Name</Label>
            <Input
              id="org-name"
              autoFocus
              maxLength={255}
              placeholder="e.g. Lawexa Partners"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>Type</Label>
            <Select
              value={type}
              onValueChange={(value) => setType(value as OrganizationType)}
              disabled={typeLocked}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ORG_TYPES.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {typeLocked && (
              <p className="text-xs text-muted-foreground">
                Type can’t change once the organization is verified.
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="org-email">Email</Label>
              <Input
                id="org-email"
                type="email"
                placeholder="contact@example.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="org-website">Website</Label>
              <Input
                id="org-website"
                type="url"
                placeholder="https://example.com"
                value={website}
                onChange={(event) => setWebsite(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="org-city">City</Label>
              <Input
                id="org-city"
                value={city}
                onChange={(event) => setCity(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="org-country">Country</Label>
              <Input
                id="org-country"
                value={country}
                onChange={(event) => setCountry(event.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="org-description">Description</Label>
            <Textarea
              id="org-description"
              maxLength={5000}
              rows={3}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={submitting || !name.trim()}>
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            {isEdit ? 'Save changes' : 'Create organization'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
