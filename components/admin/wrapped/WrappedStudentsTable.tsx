'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';

import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { WrappedAdminStudent } from '@/types/wrapped-admin';
import { campusLabel, lagosTime, personaLabel, progressText, storyLabel } from './wrapped-admin';

interface WrappedStudentsTableProps {
  students: WrappedAdminStudent[];
  isLoading: boolean;
  /** What an empty table says; the page words it ("none yet" and "none match" differ). */
  empty: ReactNode;
}

function When({ iso }: { iso: string | null }) {
  const text = lagosTime(iso);
  return text ? <span className="whitespace-nowrap">{text}</span> : <span className="text-muted-foreground">—</span>;
}

/**
 * One page of students, in the server's order: most recently active first,
 * then those who never opened. A name opens the student's admin page when the
 * row carries the student's uuid.
 */
export function WrappedStudentsTable({ students, isLoading, empty }: WrappedStudentsTableProps) {
  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  if (students.length === 0) {
    return <div className="py-12 text-center text-sm text-muted-foreground">{empty}</div>;
  }

  return (
    <div className="overflow-x-auto rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Student</TableHead>
            <TableHead>Personality</TableHead>
            <TableHead>Campus</TableHead>
            <TableHead>Progress</TableHead>
            <TableHead>First opened</TableHead>
            <TableHead>Last seen</TableHead>
            <TableHead className="text-right">Shares</TableHead>
            <TableHead className="text-right">Sign-ups</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {students.map((student) => {
            const progress = progressText(student);
            return (
              <TableRow key={student.user_id}>
                <TableCell>
                  {student.user_uuid ? (
                    <Link
                      href={`/admin/users/${student.user_uuid}`}
                      className="font-medium underline-offset-4 hover:underline"
                    >
                      {student.name}
                    </Link>
                  ) : (
                    <div className="font-medium">{student.name}</div>
                  )}
                  <div className="text-xs text-muted-foreground">{student.email}</div>
                </TableCell>
                <TableCell>
                  <div>{personaLabel(student.persona)}</div>
                  <div className="text-xs text-muted-foreground">{storyLabel(student.story)} story</div>
                </TableCell>
                <TableCell>{campusLabel(student.campus)}</TableCell>
                <TableCell>
                  <Badge variant={progress === 'Not opened' ? 'outline' : progress === 'Finished' ? 'default' : 'secondary'}>
                    {progress}
                  </Badge>
                </TableCell>
                <TableCell className="text-sm">
                  <When iso={student.first_opened_at} />
                </TableCell>
                <TableCell className="text-sm">
                  <When iso={student.last_seen_at} />
                </TableCell>
                <TableCell className="text-right tabular-nums">{student.share_count.toLocaleString()}</TableCell>
                <TableCell className="text-right tabular-nums">{student.share_signups.toLocaleString()}</TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
