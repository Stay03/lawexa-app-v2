'use client';

import { useState, useCallback } from 'react';
import { ArrowLeft, Upload, Globe, Lock, DollarSign, Gift, Loader2, X, Home } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/lib/stores/authStore';
import { canSetPrice } from '@/lib/utils/note-utils';

interface NotePublishPageProps {
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
  onCancel: () => void;
  isSubmitting?: boolean;
}

interface PublishData {
  tags: string;
  is_private: boolean;
  price_ngn?: number;
  price_usd?: number;
  status: 'draft' | 'published';
}

function NotePublishPage({
  title,
  content,
  initialData,
  onPublish,
  onSaveDraft,
  onCancel,
  isSubmitting = false,
}: NotePublishPageProps) {
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
    <div className="min-h-screen">
      <div className="max-w-6xl mx-auto px-6 lg:px-12 py-8">
        {/* Header */}
        <div className="flex items-center justify-between py-4 border-b border-border mb-12">
          <Button
            variant="ghost"
            size="sm"
            onClick={onCancel}
            disabled={isSubmitting}
            className="gap-2"
          >
            <X className="h-4 w-4" />
            Cancel
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

        {/* Main content - Two column layout */}
        <div className="grid gap-12 lg:gap-16 md:grid-cols-2">
          {/* Left column - Preview, Tags, Visibility */}
          <div className="space-y-8">
            {/* Story Preview */}
            <div className="space-y-4">
              <h3 className="text-sm font-medium text-muted-foreground">Story Preview</h3>
              <div className="rounded-lg border p-5 space-y-4">
                <h4 className="font-semibold text-lg">{title || 'Untitled'}</h4>
                <div className="flex gap-4">
                  {/* Thumbnail upload placeholder */}
                  <div className="flex-shrink-0 w-24 h-24 rounded border-2 border-dashed border-muted-foreground/25 flex flex-col items-center justify-center text-muted-foreground cursor-pointer hover:border-muted-foreground/50 transition-colors">
                    <Upload className="h-5 w-5 mb-1" />
                    <span className="text-xs">Upload</span>
                  </div>
                  {/* Content preview */}
                  <p className="text-sm text-muted-foreground line-clamp-4">
                    {contentPreview || 'No content yet...'}
                  </p>
                </div>
              </div>
            </div>

            {/* Tags */}
            <div className="space-y-4">
              <Label className="text-base">Tags</Label>
              <div className="space-y-3">
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
                  <div className="flex flex-wrap gap-2 pt-1">
                    {tagList.map((tag, index) => (
                      <span
                        key={index}
                        className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1.5 text-sm text-primary"
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
            <div className="space-y-4">
              <Label className="text-base">Visibility</Label>
              <div
                className={cn(
                  'rounded-lg border p-5 flex items-center justify-between transition-colors duration-200',
                  isPublic ? 'border-green-500/30 bg-green-500/5' : 'border-amber-500/30 bg-amber-500/5'
                )}
              >
                <div className="flex items-center gap-4">
                  <div
                    className={cn(
                      'transition-colors duration-200',
                      isPublic ? 'text-green-500' : 'text-amber-500'
                    )}
                  >
                    {isPublic ? (
                      <Globe className="h-5 w-5" />
                    ) : (
                      <Lock className="h-5 w-5" />
                    )}
                  </div>
                  <div>
                    <p className="font-medium">{isPublic ? 'Public' : 'Private'}</p>
                    <p className="text-sm text-muted-foreground">
                      {isPublic ? 'Anyone can view this note' : 'Only you can view this note'}
                    </p>
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
          <div className="space-y-8">
            <div className="space-y-4">
              <h3 className="text-sm font-medium text-muted-foreground">Monetization</h3>

              {/* Paid/Free toggle */}
              <div
                className={cn(
                  'rounded-lg border p-5 flex items-center justify-between transition-colors duration-200',
                  isPaid ? 'border-blue-500/30 bg-blue-500/5' : 'border-emerald-500/30 bg-emerald-500/5'
                )}
              >
                <div className="flex items-center gap-4">
                  <div
                    className={cn(
                      'transition-colors duration-200',
                      isPaid ? 'text-blue-500' : 'text-emerald-500'
                    )}
                  >
                    {isPaid ? (
                      <DollarSign className="h-5 w-5" />
                    ) : (
                      <Gift className="h-5 w-5" />
                    )}
                  </div>
                  <div>
                    <p className="font-medium">{isPaid ? 'Paid' : 'Free'}</p>
                    <p className="text-sm text-muted-foreground">
                      {isPaid ? 'Readers must pay to access' : 'Anyone can read for free'}
                    </p>
                  </div>
                </div>
                <Switch
                  checked={isPaid}
                  onCheckedChange={setIsPaid}
                  disabled={isSubmitting || !canPrice}
                />
              </div>

              {/* Pricing inputs with smooth transition */}
              <div
                className={cn(
                  'grid transition-all duration-300 ease-in-out',
                  isPaid && canPrice
                    ? 'grid-rows-[1fr] opacity-100'
                    : 'grid-rows-[0fr] opacity-0'
                )}
              >
                <div className="overflow-hidden">
                  <div className="rounded-lg border p-5 space-y-5">
                    {/* Price inputs - always 2 column grid */}
                    <div className="grid grid-cols-2 gap-6">
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
                        <p className="text-xs text-muted-foreground">
                          {hasIntlPricing ? 'Local pricing in Nigerian Naira' : 'Price for all readers'}
                        </p>
                      </div>

                      {/* Price in USD - only show when international pricing is enabled */}
                      <div
                        className={cn(
                          'space-y-2 transition-all duration-300',
                          hasIntlPricing
                            ? 'opacity-100'
                            : 'opacity-0 pointer-events-none'
                        )}
                      >
                        <Label>Price in US Dollars ($)</Label>
                        <Input
                          type="number"
                          placeholder="0.00"
                          min={0}
                          step={0.5}
                          value={priceUsd}
                          onChange={(e) => setPriceUsd(e.target.value)}
                          disabled={isSubmitting}
                        />
                        <p className="text-xs text-muted-foreground">International pricing in US Dollars</p>
                      </div>
                    </div>

                    {/* International/Local pricing toggle */}
                    <div
                      className={cn(
                        'flex items-center justify-between pt-4 border-t transition-colors duration-200'
                      )}
                    >
                      <div className="flex items-center gap-4">
                        <div
                          className={cn(
                            'transition-colors duration-200',
                            hasIntlPricing ? 'text-violet-500' : 'text-amber-500'
                          )}
                        >
                          {hasIntlPricing ? (
                            <Globe className="h-4 w-4" />
                          ) : (
                            <Home className="h-4 w-4" />
                          )}
                        </div>
                        <div>
                          <p className="text-sm font-medium">
                            {hasIntlPricing ? 'International Pricing' : 'Local Pricing Only'}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {hasIntlPricing
                              ? 'Set a separate USD price for international readers'
                              : 'International readers pay the Naira equivalent'}
                          </p>
                        </div>
                      </div>
                      <Switch
                        checked={hasIntlPricing}
                        onCheckedChange={setHasIntlPricing}
                        disabled={isSubmitting}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {!canPrice && (
                <p className="text-sm text-muted-foreground">
                  Upgrade to a creator account to monetize your notes.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export { NotePublishPage };
export type { PublishData };
