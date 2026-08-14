'use client';

import { useState } from 'react';
import { Loader2 } from 'lucide-react';

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
import { extractApiError } from '@/lib/utils/api-error';
import type { Organization, OrganizationType } from '@/types/collab';
import { ResponsiveOverlay } from '@/v2/shell/overlay/ResponsiveOverlay';
import {
  ORGANIZATION_DESCRIPTION_MAX,
  ORGANIZATION_NAME_MAX,
  ORGANIZATION_TYPES,
  isTypeLocked,
} from './model';
import { useCreateOrganization, useUpdateOrganization } from './mutations';

/**
 * OrganizationFormDialog — create or edit the caller's organization (study A8:
 * KEEP).
 *
 * THE TYPE IS FROZEN ONCE VERIFIED — a server rule, so the control is
 * DISABLED and says why, rather than letting the reader make a change that
 * would come back as a 422 they did nothing to deserve. Everything else stays
 * editable at every stage.
 *
 * The contact fields are optional and grouped after the identity pair, because
 * an organization is real the moment it has a name and a type; asking for an
 * address before that is asking for a form to be filled rather than a thing to
 * be made. Failures surface inline (`silentError` mutations). Phase-5 W4,
 * 2026-08-04.
 */
export function OrganizationFormDialog({
  open,
  onOpenChange,
  organization,
  viewerId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Presence switches the dialog into edit mode. */
  organization?: Organization;
  viewerId: number | null;
}) {
  const isEdit = !!organization;
  const createOrganization = useCreateOrganization(viewerId);
  const updateOrganization = useUpdateOrganization(organization?.uuid ?? '', viewerId);

  const [name, setName] = useState(organization?.name ?? '');
  const [type, setType] = useState<OrganizationType>(organization?.type ?? 'law_firm');
  const [email, setEmail] = useState(organization?.email ?? '');
  const [website, setWebsite] = useState(organization?.website ?? '');
  const [city, setCity] = useState(organization?.city ?? '');
  const [country, setCountry] = useState(organization?.country ?? '');
  const [description, setDescription] = useState(organization?.description ?? '');
  const [error, setError] = useState<string | null>(null);

  const typeLocked = isTypeLocked(organization);
  const submitting = createOrganization.isPending || updateOrganization.isPending;
  const canSubmit = name.trim().length > 0 && !submitting;

  const handleSubmit = () => {
    if (!canSubmit) return;
    setError(null);
    const payload = {
      name: name.trim(),
      type,
      email: email.trim() || undefined,
      website: website.trim() || undefined,
      city: city.trim() || undefined,
      country: country.trim() || undefined,
      description: description.trim() || undefined,
    };
    const handlers = {
      onSuccess: () => onOpenChange(false),
      onError: (failure: Error) => setError(extractApiError(failure).message),
    };

    if (isEdit) updateOrganization.mutate(payload, handlers);
    else createOrganization.mutate(payload, handlers);
  };

  return (
    <ResponsiveOverlay
      open={open}
      onOpenChange={onOpenChange}
      title={isEdit ? 'Edit organization' : 'Create an organization'}
      description={
        isEdit
          ? 'Update your organization’s details.'
          : 'An organization can own shared spaces and earn a verified badge.'
      }
      footer={
        <>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!canSubmit}>
            {submitting && <Loader2 aria-hidden className="size-4 animate-spin" />}
            {isEdit ? 'Save changes' : 'Create organization'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="org-name">Name</Label>
          <Input
            id="org-name"
            maxLength={ORGANIZATION_NAME_MAX}
            placeholder="e.g. Lawexa Partners"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="org-type">Type</Label>
          <Select
            value={type}
            onValueChange={(value) => setType(value as OrganizationType)}
            disabled={typeLocked}
          >
            <SelectTrigger id="org-type" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ORGANIZATION_TYPES.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {typeLocked && (
            <p className="text-xs text-muted-foreground">
              The type is fixed once an organization is verified.
            </p>
          )}
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="org-email">Email</Label>
            <Input
              id="org-email"
              type="email"
              autoComplete="off"
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
              autoComplete="off"
              placeholder="https://example.com"
              value={website}
              onChange={(event) => setWebsite(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="org-city">City</Label>
            <Input
              id="org-city"
              autoComplete="off"
              value={city}
              onChange={(event) => setCity(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="org-country">Country</Label>
            <Input
              id="org-country"
              autoComplete="off"
              value={country}
              onChange={(event) => setCountry(event.target.value)}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="org-description">Description</Label>
          <Textarea
            id="org-description"
            maxLength={ORGANIZATION_DESCRIPTION_MAX}
            rows={3}
            placeholder="What does this organization do?"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
          />
        </div>

        {error && (
          <p
            role="alert"
            className="text-sm text-destructive motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200"
          >
            {error}
          </p>
        )}
      </div>
    </ResponsiveOverlay>
  );
}
