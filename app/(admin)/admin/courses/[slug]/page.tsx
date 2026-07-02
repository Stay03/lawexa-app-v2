'use client';

import { use, useCallback, useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, CalendarDays, Pencil, RotateCcw, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

import { useCourse, useRestoreCourse } from '@/lib/hooks/useAdminCases';
import { useBreadcrumbStore } from '@/lib/stores/breadcrumbStore';
import { extractApiError } from '@/lib/utils/api-error';

import { CourseFormDialog } from '@/components/admin/courses/CourseFormDialog';
import { CourseDeleteDialog } from '@/components/admin/courses/CourseDeleteDialog';
import { CourseCasesTab } from '@/components/admin/courses/CourseCasesTab';
import { CourseQuizQuestionsTab } from '@/components/admin/courses/CourseQuizQuestionsTab';
import { CourseConversationsTab } from '@/components/admin/courses/CourseConversationsTab';
import {
  ADMIN_COURSE_TABS,
  ADMIN_COURSE_TAB_LABELS,
  isAdminCourseTab,
  type AdminCourseTab,
} from '@/components/admin/courses/course-detail-tabs';

interface CourseDetailPageProps {
  params: Promise<{ slug: string }>;
}

const TAB_TRIGGER_CLASS =
  'flex-none rounded-none border-0 border-b-2 border-transparent bg-transparent px-1 pb-3 pt-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground data-active:border-primary data-active:bg-transparent data-active:text-foreground dark:data-active:border-primary dark:data-active:bg-transparent';

export default function CourseDetailPage({ params }: CourseDetailPageProps) {
  const { slug } = use(params);
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data, isLoading } = useCourse(slug);
  const { setOverride, clearOverride } = useBreadcrumbStore();

  const restoreMutation = useRestoreCourse();

  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const course = data?.data;

  // Show the course name (not its slug) in the auto-generated breadcrumb.
  useEffect(() => {
    if (course) setOverride(slug, course.name);
    return () => clearOverride(slug);
  }, [course, slug, setOverride, clearOverride]);

  const tabParam = searchParams.get('tab');
  const tab: AdminCourseTab = isAdminCourseTab(tabParam) ? tabParam : 'cases';

  const setTab = useCallback(
    (value: AdminCourseTab) => {
      const next = new URLSearchParams(searchParams.toString());
      if (value === 'cases') next.delete('tab');
      else next.set('tab', value);
      const qs = next.toString();
      router.push(
        qs ? `/admin/courses/${slug}?${qs}` : `/admin/courses/${slug}`,
        { scroll: false }
      );
    },
    [router, searchParams, slug]
  );

  const handleRestore = useCallback(() => {
    if (!course) return;
    restoreMutation.mutate(course.id, {
      onSuccess: (response) =>
        toast.success(response.message || 'Course restored'),
      onError: (error) => toast.error(extractApiError(error).message),
    });
  }, [course, restoreMutation]);

  if (isLoading) {
    return (
      <div className="space-y-5">
        <Skeleton className="h-8 w-24" />
        <Skeleton className="h-20 w-full rounded-2xl" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-72 w-full rounded-2xl" />
      </div>
    );
  }

  if (!course) {
    return (
      <div className="space-y-4">
        <Link href="/admin/courses">
          <Button
            variant="ghost"
            size="sm"
            className="-ml-2 text-muted-foreground"
          >
            <ArrowLeft className="mr-1.5 h-4 w-4" />
            Courses
          </Button>
        </Link>
        <div className="rounded-lg border py-8 text-center text-muted-foreground">
          Course not found
        </div>
      </div>
    );
  }

  const isDeleted = !!course.deleted_at;

  return (
    <div className="space-y-5">
      {/* Back */}
      <Link href="/admin/courses">
        <Button variant="ghost" size="sm" className="-ml-2 text-muted-foreground">
          <ArrowLeft className="mr-1.5 h-4 w-4" />
          Courses
        </Button>
      </Link>

      {/* Header */}
      <div className="flex flex-col gap-4 rounded-2xl border bg-card p-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-semibold tracking-tight">
              {course.name}
            </h1>
            {isDeleted && (
              <Badge
                variant="outline"
                className="border-destructive/40 text-destructive"
              >
                Deleted
              </Badge>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
            <Badge variant="outline" className="font-mono text-xs">
              {course.slug}
            </Badge>
            <span className="inline-flex items-center gap-1.5">
              <CalendarDays className="h-3.5 w-3.5" />
              Created {format(new Date(course.created_at), 'MMM d, yyyy')}
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {isDeleted ? (
            <Button
              variant="outline"
              size="sm"
              onClick={handleRestore}
              disabled={restoreMutation.isPending}
            >
              <RotateCcw className="mr-1.5 h-4 w-4" />
              Restore
            </Button>
          ) : (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setEditOpen(true)}
              >
                <Pencil className="mr-1.5 h-4 w-4" />
                Edit
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="text-destructive hover:text-destructive"
                onClick={() => setDeleteOpen(true)}
              >
                <Trash2 className="mr-1.5 h-4 w-4" />
                Delete
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Tabs: the three kinds of content classified under this course */}
      <Tabs
        value={tab}
        onValueChange={(value) => setTab(value as AdminCourseTab)}
        className="gap-5"
      >
        <div className="relative w-full min-w-0">
          <TabsList className="h-auto w-full justify-start gap-4 overflow-x-auto rounded-none border-b bg-transparent p-0 [scrollbar-width:none] sm:gap-6 [&::-webkit-scrollbar]:hidden">
            {ADMIN_COURSE_TABS.map((t) => (
              <TabsTrigger key={t} value={t} className={TAB_TRIGGER_CLASS}>
                {ADMIN_COURSE_TAB_LABELS[t]}
              </TabsTrigger>
            ))}
          </TabsList>
          <div className="pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-background to-transparent sm:hidden" />
        </div>

        <TabsContent value="cases">
          <CourseCasesTab courseSlug={slug} />
        </TabsContent>
        <TabsContent value="quiz-questions">
          <CourseQuizQuestionsTab courseSlug={slug} />
        </TabsContent>
        <TabsContent value="conversations">
          <CourseConversationsTab courseSlug={slug} />
        </TabsContent>
      </Tabs>

      <CourseFormDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        course={course}
      />
      <CourseDeleteDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        course={course}
        onDeleted={() => router.push('/admin/courses')}
      />
    </div>
  );
}
