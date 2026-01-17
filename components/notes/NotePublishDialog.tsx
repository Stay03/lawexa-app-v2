'use client';

import { useState, useCallback } from 'react';
import { X, Upload, Globe, DollarSign, Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { useAuthStore } from '@/lib/stores/authStore';
import { canSetPrice } from '@/lib/utils/note-utils';

interface NotePublishDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  content: string;
  initialData?: {
    tags?: string;
    is_private?: boolean;
    price_ngn?: string | number;
    price_usd?: string | number;
  };
  onPublish: (data: PublishData) => void;
  onSaveDraft: (data: PublishData) => void;
  isSubmitting?: boolean;
}

interface PublishData {
  tags: string;
  is_private: boolean;
  price_ngn?: number;
  price_usd?: number;
  status: 'draft' | 'published';
}

function NotePublishDialog({
  open,
  onOpenChange,
  title,
  content,
  initialData,
  onPublish,
  onSaveDraft,
  isSubmitting = false,
}: NotePublishDialogProps) {
  const { user } = useAuthStore();
  const canPrice = canSetPrice(user);

  // Helper to parse price value
  const parseInitialPrice = (val?: string | number): number => {
    if (val === undefined || val === '') return 0;
    return typeof val === 'string' ? parseFloat(val) || 0 : val;
  };

  const initialPriceNgn = parseInitialPrice(initialData?.price_ngn);
  const initialPriceUsd = parseInitialPrice(initialData?.price_usd);

  // Local form state
  const [tags, setTags] = useState(initialData?.tags || '');
  const [tagInput, setTagInput] = useState('');
  const [isPublic, setIsPublic] = useState(!initialData?.is_private);
  const [isPaid, setIsPaid] = useState(initialPriceNgn > 0 || initialPriceUsd > 0);
  const [priceNgn, setPriceNgn] = useState(initialPriceNgn > 0 ? initialPriceNgn.toString() : '0.00');
  const [priceUsd, setPriceUsd] = useState(initialPriceUsd > 0 ? initialPriceUsd.toString() : '0.00');
  const [hasIntlPricing, setHasIntlPricing] = useState(initialPriceUsd > 0);

  // Parse tags from comma-separated string
  const tagList = tags ? tags.split(',').map(t => t.trim()).filter(Boolean) : [];

  // Handle adding a tag
  const handleAddTag = useCallback(() => {
    const newTag = tagInput.trim();
    if (newTag && tagList.length < 10 && newTag.length <= 50) {
      const newTags = [...tagList, newTag].join(', ');
      setTags(newTags);
      setTagInput('');
    }
  }, [tagInput, tagList]);

  // Handle tag input keydown
  const handleTagKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      handleAddTag();
    }
  };

  // Handle removing a tag
  const handleRemoveTag = (indexToRemove: number) => {
    const newTags = tagList.filter((_, index) => index !== indexToRemove).join(', ');
    setTags(newTags);
  };

  // Get publish data
  const getPublishData = (status: 'draft' | 'published'): PublishData => ({
    tags,
    is_private: !isPublic,
    price_ngn: isPaid && canPrice ? parseFloat(priceNgn) || undefined : undefined,
    price_usd: isPaid && canPrice && hasIntlPricing ? parseFloat(priceUsd) || undefined : undefined,
    status,
  });

  // Handle publish
  const handlePublish = () => {
    onPublish(getPublishData('published'));
  };

  // Handle save as draft
  const handleSaveDraft = () => {
    onSaveDraft(getPublishData('draft'));
  };

  // Get content preview (strip HTML and truncate)
  const contentPreview = content
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 150);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto p-0">
        {/* Close button */}
        <button
          type="button"
          onClick={() => onOpenChange(false)}
          className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
        >
          <X className="h-5 w-5" />
          <span className="sr-only">Close</span>
        </button>

        <div className="grid gap-6 p-6 md:grid-cols-2">
          {/* Left column - Preview, Tags, Visibility */}
          <div className="space-y-6">
            {/* Story Preview */}
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-muted-foreground">Story Preview</h3>
              <div className="rounded-lg border p-4 space-y-3">
                <h4 className="font-semibold text-lg">{title || 'Untitled'}</h4>
                <div className="flex gap-3">
                  {/* Thumbnail upload placeholder */}
                  <div className="flex-shrink-0 w-20 h-20 rounded border-2 border-dashed border-muted-foreground/25 flex flex-col items-center justify-center text-muted-foreground cursor-pointer hover:border-muted-foreground/50 transition-colors">
                    <Upload className="h-5 w-5 mb-1" />
                    <span className="text-xs">Upload</span>
                  </div>
                  {/* Content preview */}
                  <p className="text-sm text-muted-foreground line-clamp-3">
                    {contentPreview || 'No content yet...'}
                  </p>
                </div>
              </div>
            </div>

            {/* Tags */}
            <div className="space-y-3">
              <Label>Tags</Label>
              <div className="space-y-2">
                <Input
                  placeholder="Add a tag..."
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={handleTagKeyDown}
                  onBlur={handleAddTag}
                  disabled={isSubmitting || tagList.length >= 10}
                />
                <p className="text-xs text-muted-foreground">
                  {tagList.length}/10 tags - Press Enter or comma to add - Max 50 characters per tag
                </p>
                {tagList.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {tagList.map((tag, index) => (
                      <span
                        key={index}
                        className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-sm text-primary"
                      >
                        {tag}
                        <button
                          type="button"
                          onClick={() => handleRemoveTag(index)}
                          className="hover:text-primary/70"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Visibility */}
            <div className="space-y-3">
              <Label>Visibility</Label>
              <div className="rounded-lg border p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Globe className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="font-medium">Public</p>
                    <p className="text-sm text-muted-foreground">Anyone can view this note</p>
                  </div>
                </div>
                <Switch
                  checked={isPublic}
                  onCheckedChange={setIsPublic}
                  disabled={isSubmitting}
                />
              </div>
            </div>
          </div>

          {/* Right column - Monetization */}
          <div className="space-y-6">
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-muted-foreground">Monetization</h3>

              {/* Paid toggle */}
              <div className="rounded-lg border p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <DollarSign className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="font-medium">Paid</p>
                    <p className="text-sm text-muted-foreground">Readers must pay to access</p>
                  </div>
                </div>
                <Switch
                  checked={isPaid}
                  onCheckedChange={setIsPaid}
                  disabled={isSubmitting || !canPrice}
                />
              </div>

              {/* Pricing inputs (only show when paid is enabled) */}
              {isPaid && canPrice && (
                <div className="rounded-lg border p-4 space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    {/* Price in Naira */}
                    <div className="space-y-2">
                      <Label>Price in Naira (₦)</Label>
                      <Input
                        type="number"
                        placeholder="0.00"
                        min={0}
                        step={100}
                        value={priceNgn}
                        onChange={(e) => setPriceNgn(e.target.value)}
                        disabled={isSubmitting}
                      />
                      <p className="text-xs text-muted-foreground">Local pricing in Nigerian Naira</p>
                    </div>

                    {/* Price in USD */}
                    <div className="space-y-2">
                      <Label>Price in US Dollars ($)</Label>
                      <Input
                        type="number"
                        placeholder="0.00"
                        min={0}
                        step={0.5}
                        value={priceUsd}
                        onChange={(e) => setPriceUsd(e.target.value)}
                        disabled={isSubmitting || !hasIntlPricing}
                      />
                      <p className="text-xs text-muted-foreground">International pricing in US Dollars</p>
                    </div>
                  </div>

                  {/* International pricing toggle */}
                  <div className="flex items-center justify-between pt-2 border-t">
                    <div className="flex items-center gap-3">
                      <Globe className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-sm font-medium">International Pricing</p>
                        <p className="text-xs text-muted-foreground">Set a separate USD price for international readers</p>
                      </div>
                    </div>
                    <Switch
                      checked={hasIntlPricing}
                      onCheckedChange={setHasIntlPricing}
                      disabled={isSubmitting}
                    />
                  </div>
                </div>
              )}

              {!canPrice && (
                <p className="text-sm text-muted-foreground">
                  Upgrade to a creator account to monetize your notes.
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Footer with action buttons */}
        <div className="flex items-center justify-end gap-3 border-t px-6 py-4 bg-muted/30">
          <Button
            variant="outline"
            onClick={handleSaveDraft}
            disabled={isSubmitting}
          >
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Draft
          </Button>
          <Button
            onClick={handlePublish}
            disabled={isSubmitting}
            className="bg-green-600 hover:bg-green-700"
          >
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Publish
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export { NotePublishDialog };
export type { PublishData };
