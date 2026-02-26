'use client';

import { Fragment } from 'react';
import Link from 'next/link';
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import type { FolderDetail } from '@/types/folder';

/******************************************************************************
                               Types
******************************************************************************/

interface FolderBreadcrumbsProps {
  folder: FolderDetail;
  className?: string;
}

/******************************************************************************
                               Components
******************************************************************************/

/**
 * Default component. Hierarchical breadcrumb navigation for folders.
 */
function FolderBreadcrumbs({ folder, className }: FolderBreadcrumbsProps) {
  const segments = folder.slug_path.split('/');
  // Build ancestor crumbs for segments before the current folder
  const ancestorSegments = segments.slice(0, -1);

  return (
    <Breadcrumb className={className}>
      <BreadcrumbList>
        {/* Root: Folders */}
        <BreadcrumbItem>
          <BreadcrumbLink asChild>
            <Link href="/folders">Folders</Link>
          </BreadcrumbLink>
        </BreadcrumbItem>

        {/* Ancestor segments */}
        {ancestorSegments.map((segment, index) => {
          // If this is the direct parent, use parent's uuid and name
          const isDirectParent = index === ancestorSegments.length - 1 && folder.parent;
          const label = isDirectParent
            ? folder.parent!.name
            : segment.replace(/-/g, ' ');
          const href = isDirectParent
            ? `/folders/${folder.parent!.uuid}`
            : undefined;

          return (
            <Fragment key={index}>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                {href ? (
                  <BreadcrumbLink asChild>
                    <Link href={href}>{label}</Link>
                  </BreadcrumbLink>
                ) : (
                  <BreadcrumbLink className="capitalize">{label}</BreadcrumbLink>
                )}
              </BreadcrumbItem>
            </Fragment>
          );
        })}

        {/* Current folder */}
        <BreadcrumbSeparator />
        <BreadcrumbItem>
          <BreadcrumbPage>{folder.name}</BreadcrumbPage>
        </BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>
  );
}

/******************************************************************************
                               Export default
******************************************************************************/

export { FolderBreadcrumbs };
