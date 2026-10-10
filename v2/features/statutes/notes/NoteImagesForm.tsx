'use client';

import { useRef, useState, type ChangeEvent, type KeyboardEvent } from 'react';
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ChevronDown, ChevronUp, CircleAlert, GripVertical, ImagePlus, Loader2, Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { formatBytes } from '@/lib/utils/format-bytes';
import type { StatuteAnnotation, StatuteAnnotationImage } from '@/types/statute';
import { FOCUS_RING } from '@/v2/shell/designs/modules';
import {
  NOTE_IMAGE_ACCEPT,
  NOTE_IMAGE_CAPTION_MAX,
  NOTE_IMAGE_MAX,
  checkImageFiles,
  imageAlt,
  isCaptionChanged,
  isCaptionTooLong,
  moveImage,
  normalizeCaption,
  orderImages,
  roomForImages,
  type RefusedFile,
} from './images';
import { useAddNoteImages, useDeleteNoteImage, useUpdateNoteImage } from './mutations';
import { NoteThumb, useFreshImageUrl } from './NoteImages';

/**
 * The note's pictures of the print, to add, caption, put in order and delete.
 * It opens in the row, like Edit and Decide, so the note it changes stays in
 * view. Every change is its own request and the server's answer replaces the
 * note; a move shows at once and lets go when the server answers.
 *
 * Picked files are checked here first (type, 5 MB, 10 a note), and each one
 * refused says why. The server checks again; its refusal rides the global
 * mutation-error toast.
 *
 * Order by the grip (pointer, or keyboard: Space picks up, arrows move,
 * Space drops) or by the up and down buttons. Delete asks first, in the row.
 */
export function NoteImagesForm({
  note,
  slug,
  onDone,
}: {
  note: StatuteAnnotation;
  slug: string;
  onDone: () => void;
}) {
  const add = useAddNoteImages(slug);
  const update = useUpdateNoteImage(slug);
  const freshUrl = useFreshImageUrl(slug, note.uuid);
  const inputRef = useRef<HTMLInputElement | null>(null);

  /** The order while a move is on its way; null shows the server's. */
  const [order, setOrder] = useState<readonly number[] | null>(null);
  const [refused, setRefused] = useState<readonly RefusedFile[]>([]);
  const [uploading, setUploading] = useState<{ count: number; share: number } | null>(null);

  const images = orderImages(note.images ?? [], order);
  const ids = images.map((image) => image.id);
  const room = roomForImages(images.length);
  const moving = order !== null;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const sendMove = (nextIds: readonly number[], imageId: number, position: number) => {
    setOrder(nextIds);
    update.mutate({ uuid: note.uuid, imageId, position }, { onSettled: () => setOrder(null) });
  };

  const step = (imageId: number, direction: -1 | 1) => {
    const moved = moveImage(ids, imageId, direction);
    if (moved) sendMove(moved.ids, imageId, moved.position);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const from = ids.indexOf(Number(active.id));
    const to = ids.indexOf(Number(over.id));
    if (from === -1 || to === -1) return;
    sendMove(arrayMove([...ids], from, to), Number(active.id), to + 1);
  };

  const handlePick = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    // Cleared so picking the same file again still fires a change.
    event.target.value = '';
    if (files.length === 0) return;
    const checked = checkImageFiles(files, images.length);
    setRefused(checked.refused);
    if (checked.accepted.length === 0) return;
    setUploading({ count: checked.accepted.length, share: 0 });
    add.mutate(
      {
        uuid: note.uuid,
        files: checked.accepted,
        onProgress: (sent, total) =>
          setUploading((current) => (current ? { ...current, share: total > 0 ? sent / total : 0 } : current)),
      },
      { onSettled: () => setUploading(null) },
    );
  };

  return (
    <div className="flex flex-col gap-2.5 rounded-lg border border-border p-3 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-top-1 motion-safe:duration-200">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-sm font-medium">Images of the print</span>
        <span className="text-xs text-muted-foreground">
          {images.length} of {NOTE_IMAGE_MAX}
        </span>
      </div>

      {images.length > 0 ? (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={ids} strategy={verticalListSortingStrategy}>
            <ul className="flex flex-col gap-2">
              {images.map((image, index) => (
                <ImageItem
                  key={image.id}
                  note={note}
                  slug={slug}
                  image={image}
                  index={index}
                  count={images.length}
                  locked={moving}
                  freshUrl={freshUrl}
                  onStep={(direction) => step(image.id, direction)}
                />
              ))}
            </ul>
          </SortableContext>
        </DndContext>
      ) : (
        <p className="text-sm text-muted-foreground">
          No images yet. Add screenshots of the printed page, so others can check what the print shows.
        </p>
      )}

      {uploading ? (
        <div role="status" className="flex items-center gap-2 text-[13px] text-muted-foreground motion-safe:animate-in motion-safe:fade-in">
          <Loader2 aria-hidden className="size-3.5 animate-spin" />
          <span>{uploading.count === 1 ? 'Adding 1 image' : `Adding ${uploading.count} images`}</span>
          <span aria-hidden className="h-1 flex-1 overflow-hidden rounded-full bg-muted">
            <span
              className="block h-full rounded-full bg-primary transition-[width] duration-200 motion-reduce:transition-none"
              style={{ width: `${Math.round(uploading.share * 100)}%` }}
            />
          </span>
        </div>
      ) : null}

      {refused.length > 0 ? (
        <ul role="status" className="flex flex-col gap-1 motion-safe:animate-in motion-safe:fade-in">
          {refused.map((file, index) => (
            <li key={`${file.name}-${index}`} className="flex items-start gap-1.5 text-[13px] text-destructive">
              <CircleAlert aria-hidden className="mt-0.5 size-3.5 shrink-0" />
              <span>{file.reason}</span>
            </li>
          ))}
        </ul>
      ) : null}

      <input
        ref={inputRef}
        type="file"
        accept={NOTE_IMAGE_ACCEPT}
        multiple
        tabIndex={-1}
        aria-hidden
        className="sr-only"
        onChange={handlePick}
      />
      <button
        type="button"
        disabled={room === 0 || add.isPending}
        onClick={() => inputRef.current?.click()}
        className={cn(
          'v2-interactive flex items-center gap-3 rounded-lg border-[1.5px] border-dashed border-border px-3 py-2.5 text-left',
          'transition-colors duration-150 hover:bg-secondary disabled:pointer-events-none disabled:opacity-60',
          FOCUS_RING,
        )}
      >
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-secondary">
          <ImagePlus aria-hidden className="size-5" />
        </span>
        <span className="flex flex-col gap-0.5">
          <span className="text-sm font-medium">Add images</span>
          <span className="text-xs text-muted-foreground">
            {room === 0
              ? `This note has ${NOTE_IMAGE_MAX} images, the most it can hold.`
              : `PNG, JPG or WebP, up to 5 MB each. ${room} more allowed.`}
          </span>
        </span>
      </button>

      <div className="flex justify-end">
        <Button type="button" variant="ghost" size="sm" onClick={onDone}>
          Done
        </Button>
      </div>
    </div>
  );
}

function ImageItem({
  note,
  slug,
  image,
  index,
  count,
  locked,
  freshUrl,
  onStep,
}: {
  note: StatuteAnnotation;
  slug: string;
  image: StatuteAnnotationImage;
  index: number;
  count: number;
  /** A move is on its way: no other move until it lands. */
  locked: boolean;
  freshUrl: (imageId: number) => Promise<string | null>;
  onStep: (direction: -1 | 1) => void;
}) {
  const recaption = useUpdateNoteImage(slug);
  const remove = useDeleteNoteImage(slug);
  const [draft, setDraft] = useState(image.caption ?? '');
  const [confirming, setConfirming] = useState(false);
  const busy = recaption.isPending || remove.isPending;
  const canDrag = !locked && !busy && !confirming;

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: image.id,
    disabled: !canDrag,
  });

  const changed = isCaptionChanged(draft, image.caption);
  const tooLong = isCaptionTooLong(draft);
  const name = imageAlt(image);
  const captionId = `note-image-${image.id}-caption`;

  const saveCaption = () => {
    if (!changed || tooLong || recaption.isPending) return;
    recaption.mutate(
      { uuid: note.uuid, imageId: image.id, caption: normalizeCaption(draft) },
      { onSuccess: (response) => setDraft(response.data.images?.find((row) => row.id === image.id)?.caption ?? '') },
    );
  };

  const handleCaptionKey = (event: KeyboardEvent<HTMLInputElement>) => {
    // IME composition's Enter confirms the composition, never the save.
    if (event.key === 'Enter' && !event.nativeEvent.isComposing) {
      event.preventDefault();
      saveCaption();
    }
  };

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        'flex flex-col gap-2 rounded-lg bg-secondary/60 p-2 motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200',
        isDragging && 'relative z-10 bg-background shadow-lg ring-1 ring-border',
      )}
    >
      <div className="flex items-center gap-2">
        <button
          type="button"
          aria-label={`Reorder ${name}`}
          disabled={!canDrag}
          data-press="none"
          {...attributes}
          {...listeners}
          className={cn(
            'flex h-10 w-6 shrink-0 touch-none items-center justify-center rounded-md text-muted-foreground',
            'transition-colors duration-150 disabled:opacity-40',
            canDrag ? 'cursor-grab' : 'cursor-default',
            isDragging && 'cursor-grabbing bg-secondary text-foreground',
            FOCUS_RING,
          )}
        >
          <GripVertical aria-hidden className="size-4" />
        </button>
        <span className="block h-14 w-[2.625rem] shrink-0 overflow-hidden rounded border border-border">
          <NoteThumb image={image} freshUrl={freshUrl} />
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-px">
          <span title={image.original_name} className="truncate text-[13px] font-medium leading-snug">
            {image.original_name}
          </span>
          <span className="text-xs text-muted-foreground">{formatBytes(image.size_bytes)}</span>
        </span>
        {!confirming ? (
          <>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={`Move ${name} up`}
              aria-disabled={index === 0 || !canDrag}
              onClick={() => {
                if (index > 0 && canDrag) onStep(-1);
              }}
              className="text-muted-foreground aria-disabled:opacity-40"
            >
              <ChevronUp aria-hidden className="size-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={`Move ${name} down`}
              aria-disabled={index === count - 1 || !canDrag}
              onClick={() => {
                if (index < count - 1 && canDrag) onStep(1);
              }}
              className="text-muted-foreground aria-disabled:opacity-40"
            >
              <ChevronDown aria-hidden className="size-4" />
            </Button>
          </>
        ) : null}
      </div>

      {confirming ? (
        <div className="flex items-center gap-2 motion-safe:animate-in motion-safe:fade-in motion-safe:duration-150">
          <span className="mr-auto text-[13px]">Delete this image?</span>
          <Button type="button" variant="outline" size="sm" disabled={remove.isPending} onClick={() => setConfirming(false)}>
            Keep
          </Button>
          <Button
            type="button"
            variant="destructive"
            size="sm"
            disabled={remove.isPending}
            onClick={() => remove.mutate({ uuid: note.uuid, imageId: image.id }, { onError: () => setConfirming(false) })}
          >
            {remove.isPending ? <Loader2 aria-hidden className="size-4 animate-spin" /> : null}
            Delete
          </Button>
        </div>
      ) : (
        <div className="flex items-center gap-1.5">
          <label htmlFor={captionId} className="sr-only">
            Caption for {image.original_name}
          </label>
          <Input
            id={captionId}
            value={draft}
            maxLength={NOTE_IMAGE_CAPTION_MAX}
            placeholder="Add a caption, for example the page number"
            aria-invalid={tooLong || undefined}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={handleCaptionKey}
            className="h-9 bg-background text-sm"
          />
          {changed ? (
            <Button
              type="button"
              size="sm"
              disabled={tooLong || recaption.isPending}
              onClick={saveCaption}
              className="motion-safe:animate-in motion-safe:fade-in motion-safe:duration-150"
            >
              {recaption.isPending ? <Loader2 aria-hidden className="size-4 animate-spin" /> : null}
              Save
            </Button>
          ) : null}
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={`Delete ${name}`}
            disabled={busy}
            onClick={() => setConfirming(true)}
            className="text-destructive hover:bg-destructive/10 hover:text-destructive"
          >
            <Trash2 aria-hidden className="size-4" />
          </Button>
        </div>
      )}
    </li>
  );
}
