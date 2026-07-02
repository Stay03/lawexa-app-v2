'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { format, formatDistanceToNow } from 'date-fns';
import {
  ArrowUpDown,
  MoreHorizontal,
  Pencil,
  Trash2,
  Eye,
  RotateCcw,
} from 'lucide-react';

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';

import { cn } from '@/lib/utils';
import type { Course, CoursesParams } from '@/types/admin-cases';

type CourseSortField = 'name' | 'created_at';

interface CoursesTableProps {
  courses: Course[];
  isLoading: boolean;
  params: CoursesParams;
  onSort: (sortBy: CourseSortField) => void;
  onEdit: (course: Course) => void;
  onDelete: (course: Course) => void;
  onRestore: (course: Course) => void;
}

/**
 * Table of courses. Rows link to the course detail; the action menu adapts to
 * whether a course is active (edit/delete) or soft-deleted (restore).
 */
export function CoursesTable({
  courses,
  isLoading,
  params,
  onSort,
  onEdit,
  onDelete,
  onRestore,
}: CoursesTableProps) {
  const router = useRouter();

  const SortButton = ({
    field,
    children,
  }: {
    field: CourseSortField;
    children: React.ReactNode;
  }) => (
    <Button
      variant="ghost"
      size="sm"
      className="-ml-3 h-8"
      onClick={() => onSort(field)}
    >
      {children}
      <ArrowUpDown
        className={cn('ml-2 h-4 w-4', params.sort === field && 'text-primary')}
      />
    </Button>
  );

  const Header = () => (
    <TableHeader>
      <TableRow className="bg-muted/40 hover:bg-muted/40">
        <TableHead className="font-semibold">
          <SortButton field="name">Name</SortButton>
        </TableHead>
        <TableHead className="w-[240px] font-semibold">Slug</TableHead>
        <TableHead className="w-[160px] font-semibold">
          <SortButton field="created_at">Created</SortButton>
        </TableHead>
        <TableHead className="w-[60px]" />
      </TableRow>
    </TableHeader>
  );

  // Loading state — fading skeleton rows inside the real table chrome.
  if (isLoading) {
    const opacityValues = [1, 0.8, 0.5, 0.25, 0.1];
    return (
      <div className="rounded-lg border overflow-hidden">
        <Table>
          <Header />
          <TableBody>
            {Array.from({ length: 5 }).map((_, i) => (
              <TableRow
                key={i}
                className={cn(i % 2 === 1 && 'bg-muted/20')}
                style={{ opacity: opacityValues[i] ?? 0.1 }}
              >
                <TableCell>
                  <Skeleton className="h-4 w-48 animate-pulse rounded" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-5 w-32 animate-pulse rounded" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-4 w-24 animate-pulse rounded" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-8 w-8 animate-pulse rounded" />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    );
  }

  // Empty state
  if (courses.length === 0) {
    return (
      <div className="rounded-lg border py-12 text-center text-muted-foreground">
        No courses found
      </div>
    );
  }

  return (
    <div className="rounded-lg border overflow-hidden">
      <Table>
        <Header />
        <TableBody>
          {courses.map((course, index) => {
            const isDeleted = !!course.deleted_at;
            return (
              <TableRow
                key={course.id}
                className={cn(
                  'cursor-pointer transition-colors',
                  index % 2 === 1 && 'bg-muted/20',
                  isDeleted && 'opacity-60'
                )}
                onClick={() => router.push(`/admin/courses/${course.slug}`)}
              >
                {/* Name */}
                <TableCell className="font-medium">
                  <div className="flex items-center gap-2">
                    <Link
                      href={`/admin/courses/${course.slug}`}
                      className="truncate hover:underline"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {course.name}
                    </Link>
                    {isDeleted && (
                      <Badge
                        variant="outline"
                        className="border-destructive/40 text-destructive text-xs"
                      >
                        Deleted
                      </Badge>
                    )}
                  </div>
                </TableCell>

                {/* Slug */}
                <TableCell>
                  <Badge variant="outline" className="font-mono text-xs">
                    {course.slug}
                  </Badge>
                </TableCell>

                {/* Created */}
                <TableCell>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="text-sm text-muted-foreground cursor-help">
                        {format(new Date(course.created_at), 'MMM d, yyyy')}
                      </span>
                    </TooltipTrigger>
                    <TooltipContent side="top">
                      <p>
                        {formatDistanceToNow(new Date(course.created_at), {
                          addSuffix: true,
                        })}
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </TableCell>

                {/* Actions */}
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={(e) => {
                          e.stopPropagation();
                          router.push(`/admin/courses/${course.slug}`);
                        }}
                      >
                        <Eye className="mr-2 h-4 w-4" />
                        View content
                      </DropdownMenuItem>
                      {isDeleted ? (
                        <>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation();
                              onRestore(course);
                            }}
                          >
                            <RotateCcw className="mr-2 h-4 w-4" />
                            Restore
                          </DropdownMenuItem>
                        </>
                      ) : (
                        <>
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation();
                              onEdit(course);
                            }}
                          >
                            <Pencil className="mr-2 h-4 w-4" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onClick={(e) => {
                              e.stopPropagation();
                              onDelete(course);
                            }}
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete
                          </DropdownMenuItem>
                        </>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
