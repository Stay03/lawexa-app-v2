'use client';

import { useDeferredValue, useRef, useState } from 'react';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import {
  Copy,
  Download,
  Eye,
  FileText,
  FileUp,
  History,
  Loader2,
  MessageSquarePlus,
  MoreHorizontal,
  Pencil,
  PencilLine,
  RotateCw,
  Search,
  Trash2,
  TriangleAlert,
  Upload,
} from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { saveExportedFile } from '@/lib/certificates/save-file';
import { cn } from '@/lib/utils';
import { extractApiError } from '@/lib/utils/api-error';
import { myTemplatesApi } from '@/lib/api/private-items';
import { TEMPLATE_UPLOAD, type MyTemplate, type TemplateSort } from '@/types/private-items';
import { useMinuteNow } from '@/v2/features/channels/use-minute-now';
import { FOCUS_RING } from '@/v2/shell/designs/modules';
import { SettingsState } from '../settings/SettingsState';
import { AllowedInChips } from './AllowedInChips';
import { CheckBlanks } from './CheckBlanks';
import { DeleteItemDialog, RenameDialog } from './ItemDialogs';
import { templateStatusLine } from './model';
import { usedLine } from './pages-model';
import { privateItemsQueries, useTemplateMutations } from './queries';
import { ItemsFallback } from './states';
import { TemplatePreview } from './TemplatePreview';
import { TemplateTags } from './TemplateTags';
import { UploadRefusals, useTemplateUpload } from './use-template-upload';
import { UseInChat } from './UseInChat';
import { VersionHistory } from './VersionHistory';

/** The page is wider than a settings form: rows carry tags, a button and a menu. */
export const ITEMS_COLUMN = 'mx-auto w-full max-w-3xl px-4 pb-16 pt-4 sm:pt-6';

const ALL = '__all';
const SORTS: { value: TemplateSort; label: string }[] = [
  { value: 'last_used', label: 'Last used' },
  { value: 'name', label: 'Name' },
  { value: 'created', label: 'Date added' },
];

type Open =
  | { what: 'preview' | 'blanks' | 'versions' | 'use' | 'rename' | 'delete'; row: MyTemplate }
  | null;

/**
 * Settings > My templates (Arthur agreed the page, 19 November 2026, thread
 * 9ae498ae): only the person's own templates. Search (name, type, area and
 * the text), a type and an area filter, an order, and the five used last at
 * the top. Each row says what it is, how many blanks it has and when it was
 * last used, with Use in chat, and a menu for everything else. A template
 * whose blanks nobody has checked says so, and its button is Check the blanks.
 */
export function MyTemplatesScreen() {
  const [search, setSearch] = useState('');
  const [documentType, setDocumentType] = useState('');
  const [practiceArea, setPracticeArea] = useState('');
  const [sort, setSort] = useState<TemplateSort>('last_used');
  const filters = { search: useDeferredValue(search.trim()), documentType, practiceArea, sort };
  const filtered = Boolean(filters.search || documentType || practiceArea);

  const query = useInfiniteQuery(privateItemsQueries.myTemplates(filters));
  const recent = useQuery(privateItemsQueries.recentTemplates());
  const facets = useQuery(privateItemsQueries.templateFacets());
  const mutations = useTemplateMutations();
  const upload = useTemplateUpload((files) => mutations.upload.mutateAsync(files));
  const now = useMinuteNow();
  const [open, setOpen] = useState<Open>(null);
  const [renameError, setRenameError] = useState<string | null>(null);
  const replaceInput = useRef<HTMLInputElement>(null);
  const [replacing, setReplacing] = useState<MyTemplate | null>(null);

  const rows = query.data?.pages.flatMap((page) => page.data) ?? [];
  const recentRows = (recent.data ?? []).filter((row) => row.last_used_at);
  const hasAny = rows.length > 0 || filtered;
  const close = () => setOpen(null);

  const download = async (row: MyTemplate) => {
    try {
      saveExportedFile({ blob: await myTemplatesApi.download(row.uuid), filename: row.file?.original_name ?? row.name });
    } catch (error) {
      toast.error(extractApiError(error).message || 'The file did not download.');
    }
  };

  const uploadButton = (
    <Button onClick={upload.pick} disabled={upload.uploading} className="rounded-full">
      {upload.uploading ? <Loader2 aria-hidden className="size-4 animate-spin" /> : <Upload aria-hidden className="size-4" />}
      {upload.uploading ? 'Uploading…' : 'Upload'}
    </Button>
  );

  return (
    <div className={ITEMS_COLUMN}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h1 className="text-xl font-semibold tracking-tight text-foreground md:text-2xl">My templates</h1>
        {hasAny ? uploadButton : null}
      </div>
      {upload.input}
      <input
        ref={replaceInput}
        type="file"
        accept={TEMPLATE_UPLOAD.accept}
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = '';
          if (!file || !replacing) return;
          mutations.replace.mutate(
            { uuid: replacing.uuid, file },
            {
              onSuccess: () => toast.success(`New file for ${replacing.name}. Lawexa is reading it; the old one stays in its history.`),
              onError: (error) => toast.error(extractApiError(error).message),
            },
          );
        }}
      />
      <UploadRefusals lines={upload.lines} />

      {hasAny ? (
        <div className="mb-5 flex flex-col gap-2.5">
          <div className="relative">
            <Search aria-hidden className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search names, types and the text"
              aria-label="Search your templates"
              className="h-10 rounded-full pl-9"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <FacetSelect label="Type" all="All types" value={documentType} onChange={setDocumentType} options={facets.data?.document_types ?? []} />
            <FacetSelect label="Area" all="All areas" value={practiceArea} onChange={setPracticeArea} options={facets.data?.practice_areas ?? []} />
            <Select value={sort} onValueChange={(value) => setSort(value as TemplateSort)}>
              <SelectTrigger aria-label="Order" className="ml-auto h-9 w-auto gap-1.5 rounded-full text-[13px]">
                <span className="text-muted-foreground">Sort:</span>
                <SelectValue />
              </SelectTrigger>
              <SelectContent align="end">
                {SORTS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      ) : null}

      {!filtered && recentRows.length > 1 ? (
        <section aria-labelledby="recent-templates" className="mb-6">
          <h2 id="recent-templates" className="mb-2 px-1 text-[13px] font-medium text-muted-foreground">
            Recently used
          </h2>
          <ul data-v2-strip="" className="-mx-4 flex gap-2.5 overflow-x-auto px-4 pb-1">
            {recentRows.map((row) => (
              <li key={row.uuid} className="w-52 shrink-0">
                <button
                  type="button"
                  onClick={() => setOpen({ what: 'preview', row })}
                  className={cn('v2-interactive flex h-full w-full flex-col gap-1.5 rounded-xl border border-border bg-card p-3 text-left transition-colors hover:bg-muted/50', FOCUS_RING)}
                >
                  <FileText aria-hidden className="size-4 text-blue-600 dark:text-blue-400" />
                  <span className="line-clamp-2 text-[13px] leading-snug font-medium text-foreground">{row.name}</span>
                  <span className="mt-auto text-xs text-muted-foreground">{usedLine(row.last_used_at, now)}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {query.isPending ? (
        <ItemsFallback label="Loading your templates" />
      ) : query.isError ? (
        <SettingsState
          icon={TriangleAlert}
          tone="alarm"
          title="Your templates did not load"
          description="Check your connection and try again."
          action={
            <Button size="sm" variant="outline" onClick={() => void query.refetch()} disabled={query.isFetching}>
              <RotateCw aria-hidden className={cn('size-4', query.isFetching && 'animate-spin')} />
              Try again
            </Button>
          }
        />
      ) : rows.length === 0 && filtered ? (
        <SettingsState icon={Search} title="No templates match" description="Try other words, or clear the filters." />
      ) : rows.length === 0 ? (
        <EmptyTemplates action={uploadButton} />
      ) : (
        <section aria-labelledby="all-templates">
          <h2 id="all-templates" className="mb-2 px-1 text-[13px] font-medium text-muted-foreground">
            {filtered ? `${query.data?.pages[0]?.pagination.total ?? rows.length} found` : 'All templates'}
          </h2>
          <ul className="divide-y divide-border/70 overflow-hidden rounded-2xl border border-border bg-card">
            {rows.map((row) => (
              <TemplateItem
                key={row.uuid}
                row={row}
                now={now}
                onOpen={(what) => {
                  setRenameError(null);
                  setOpen({ what, row });
                }}
                onDuplicate={() =>
                  mutations.duplicate.mutate(row.uuid, {
                    onSuccess: (copy) => toast.success(`${copy.name} added.`),
                    onError: (error) => toast.error(extractApiError(error).message),
                  })
                }
                onReplace={() => {
                  setReplacing(row);
                  replaceInput.current?.click();
                }}
                onDownload={() => void download(row)}
                onRetry={() => mutations.retry.mutate(row.uuid, { onError: (error) => toast.error(extractApiError(error).message) })}
              />
            ))}
          </ul>
        </section>
      )}

      {query.hasNextPage ? (
        <div className="mt-4 flex justify-center">
          <Button variant="outline" size="sm" onClick={() => void query.fetchNextPage()} disabled={query.isFetchingNextPage}>
            {query.isFetchingNextPage ? <Loader2 aria-hidden className="size-4 animate-spin" /> : null}
            Show more
          </Button>
        </div>
      ) : null}

      {open?.what === 'preview' ? (
        <TemplatePreview
          uuid={open.row.uuid}
          open
          onClose={close}
          onUse={() => setOpen({ what: 'use', row: open.row })}
          onEditBlanks={() => setOpen({ what: 'blanks', row: open.row })}
        />
      ) : null}
      {open?.what === 'blanks' ? <CheckBlanks uuid={open.row.uuid} open onClose={close} /> : null}
      {open?.what === 'versions' ? <VersionHistory kind="template" uuid={open.row.uuid} name={open.row.name} open onClose={close} /> : null}
      {open?.what === 'use' ? <UseInChat kind="template" uuid={open.row.uuid} name={open.row.name} open onClose={close} /> : null}
      {open?.what === 'rename' ? (
        <RenameDialog
          key={open.row.uuid}
          open
          current={open.row.name}
          pending={mutations.rename.isPending}
          error={renameError}
          onClose={close}
          onSave={(name) =>
            mutations.rename.mutate(
              { uuid: open.row.uuid, name },
              { onSuccess: close, onError: (error) => setRenameError(extractApiError(error).message) },
            )
          }
        />
      ) : null}
      {open?.what === 'delete' ? (
        <DeleteItemDialog
          open
          kind="template"
          name={open.row.name}
          spaces={open.row.allowed_in.length}
          pending={mutations.remove.isPending}
          onClose={close}
          onDelete={() =>
            mutations.remove.mutate(open.row.uuid, {
              onSuccess: () => {
                toast.success(`${open.row.name} deleted.`);
                close();
              },
              onError: (error) => toast.error(extractApiError(error).message),
            })
          }
        />
      ) : null}
    </div>
  );
}

function FacetSelect({
  label,
  all,
  value,
  onChange,
  options,
}: {
  label: string;
  all: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; count: number }[];
}) {
  return (
    <Select value={value || ALL} onValueChange={(next) => onChange(next === ALL ? '' : next)}>
      <SelectTrigger aria-label={label} className={cn('h-9 w-auto rounded-full text-[13px]', value && 'border-primary/50 bg-accent/60')}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL}>{all}</SelectItem>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.value} ({option.count})
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function TemplateItem({
  row,
  now,
  onOpen,
  onDuplicate,
  onReplace,
  onDownload,
  onRetry,
}: {
  row: MyTemplate;
  now: number;
  onOpen: (what: 'preview' | 'blanks' | 'versions' | 'use' | 'rename' | 'delete') => void;
  onDuplicate: () => void;
  onReplace: () => void;
  onDownload: () => void;
  onRetry: () => void;
}) {
  const reading = row.status === 'processing';
  const failed = row.status === 'failed';
  const unchecked = row.status === 'live' && !row.blanks_checked_at;
  return (
    <li className="flex items-start gap-3.5 px-4 py-3.5">
      <FileText aria-hidden className="mt-0.5 size-5 shrink-0 text-blue-600 dark:text-blue-400" />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <button
          type="button"
          disabled={row.status !== 'live'}
          onClick={() => onOpen('preview')}
          className="v2-interactive line-clamp-2 text-left text-[15px] leading-snug font-medium text-foreground hover:underline disabled:hover:no-underline"
        >
          {row.name}
        </button>
        <TemplateTags type={row.document_type} area={row.practice_area} />
        <span className={cn('flex items-center gap-1.5 text-[13px] leading-snug', failed ? 'text-destructive' : 'text-muted-foreground')}>
          {reading ? <Loader2 aria-hidden className="size-3 animate-spin motion-reduce:animate-none" /> : null}
          {reading || failed
            ? templateStatusLine(row.status, row.error)
            : `${row.blanks_count ?? 0} blanks · ${usedLine(row.last_used_at, now)}`}
        </span>
        {unchecked ? (
          <span className="text-[13px] leading-snug text-amber-700 dark:text-amber-300">Check the blanks Lawexa marked before you use it.</span>
        ) : null}
        <AllowedInChips allowedIn={row.allowed_in} itemName={row.name} />
      </div>
      <div className="flex shrink-0 items-center gap-1">
        {row.status === 'live' ? (
          unchecked ? (
            <Button size="sm" variant="outline" onClick={() => onOpen('blanks')} className="rounded-full">
              <PencilLine aria-hidden className="size-4" />
              <span className="max-sm:sr-only">Check the blanks</span>
            </Button>
          ) : (
            <Button size="sm" variant="outline" onClick={() => onOpen('use')} className="rounded-full">
              <MessageSquarePlus aria-hidden className="size-4" />
              <span className="max-sm:sr-only">Use in chat</span>
            </Button>
          )
        ) : null}
        <DropdownMenu>
          <DropdownMenuTrigger
            aria-label={`Actions for ${row.name}`}
            className={cn(
              'v2-interactive flex size-9 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground',
              FOCUS_RING,
            )}
          >
            <MoreHorizontal aria-hidden className="size-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {row.status === 'live' ? (
              <>
                <DropdownMenuItem onSelect={() => onOpen('preview')}>
                  <Eye />
                  Preview
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => onOpen('blanks')}>
                  <PencilLine />
                  Edit blanks
                </DropdownMenuItem>
              </>
            ) : null}
            <DropdownMenuItem onSelect={() => onOpen('rename')}>
              <Pencil />
              Rename
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={onDuplicate}>
              <Copy />
              Duplicate
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={onReplace}>
              <FileUp />
              Replace file
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => onOpen('versions')}>
              <History />
              Version history
            </DropdownMenuItem>
            {row.file ? (
              <DropdownMenuItem onSelect={onDownload}>
                <Download />
                Download
              </DropdownMenuItem>
            ) : null}
            {failed ? (
              <DropdownMenuItem onSelect={onRetry}>
                <RotateCw />
                Try reading again
              </DropdownMenuItem>
            ) : null}
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onSelect={() => onOpen('delete')}>
              <Trash2 />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </li>
  );
}

/** The empty page: what a template is for, what a blank is, and the one button. */
function EmptyTemplates({ action }: { action: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center rounded-2xl border border-dashed border-border px-6 py-10 text-center">
      <FileText aria-hidden className="size-8 text-blue-600 dark:text-blue-400" />
      <h2 className="mt-3 text-base font-semibold text-foreground">No templates yet</h2>
      <p className="mt-1.5 max-w-md text-sm text-muted-foreground">
        Upload a Word or PDF document you use often. Lawexa drafts from it in your chats, in your wording.
      </p>
      <p className="mt-4 max-w-md rounded-xl bg-muted/60 px-4 py-3 font-serif text-[14px] leading-relaxed text-foreground">
        This tenancy is made between{' '}
        <span className="rounded-md bg-amber-100 px-1.5 py-0.5 font-sans text-[11px] font-semibold text-amber-900 dark:bg-amber-400/15 dark:text-amber-200">LANDLORD</span>{' '}
        and{' '}
        <span className="rounded-md bg-amber-100 px-1.5 py-0.5 font-sans text-[11px] font-semibold text-amber-900 dark:bg-amber-400/15 dark:text-amber-200">TENANT</span>{' '}
        at a yearly rent of{' '}
        <span className="rounded-md bg-amber-100 px-1.5 py-0.5 font-sans text-[11px] font-semibold text-amber-900 dark:bg-amber-400/15 dark:text-amber-200">RENT</span>.
      </p>
      <p className="mt-2 max-w-md text-xs text-muted-foreground">
        The marked parts are blanks: what changes each time. Lawexa finds them, you check them, and it fills them in when it drafts.
      </p>
      <div className="mt-5">{action}</div>
    </div>
  );
}
