'use client';

import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useStatuteNodes } from '@/lib/hooks/useStatutes';
import { ErrorState } from '@/components/common/ErrorState';
import type { StatuteNode, StatuteNodeType } from '@/types/statute';

/******************************************************************************
                               Constants
******************************************************************************/

/** Heading-level node types rendered as structural headers */
const HEADING_TYPES = new Set<StatuteNodeType>(['act', 'chapter', 'part', 'schedule']);

/** Mid-level node types */
const MID_TYPES = new Set<StatuteNodeType>(['section', 'article', 'rule', 'regulation']);

/******************************************************************************
                               Components
******************************************************************************/

interface StatuteNodeTreeProps {
  slug: string;
  nodesCount: number;
  className?: string;
  animationDelay?: number;
}

/**
 * Hierarchical node tree renderer for statute content.
 * Loads all nodes in a single request and renders with depth-based indentation.
 */
function StatuteNodeTree({
  slug,
  nodesCount,
  className,
  animationDelay = 500,
}: StatuteNodeTreeProps) {
  const { data, isLoading, isError, refetch } = useStatuteNodes(slug, nodesCount);

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (isError) {
    return (
      <ErrorState
        title="Failed to load statute content"
        description="We couldn't load the sections of this statute."
        retry={() => refetch()}
      />
    );
  }

  const nodes = data?.data?.nodes;
  if (!nodes || nodes.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        No content sections available for this statute.
      </p>
    );
  }

  return (
    <div
      className={cn('space-y-0', className)}
      style={{ animationDelay: `${animationDelay}ms` }}
    >
      {nodes.map((node, index) => (
        <NodeItem
          key={node.id}
          node={node}
          animationDelay={animationDelay + Math.min(index, 30) * 20}
        />
      ))}
    </div>
  );
}

/******************************************************************************
                               Node Item
******************************************************************************/

interface NodeItemProps {
  node: StatuteNode;
  animationDelay: number;
}

/**
 * Renders a single node with depth-based indentation and type-based typography
 */
function NodeItem({ node, animationDelay }: NodeItemProps) {
  const { node_type, node_type_label, number, title, content, depth } = node;
  const isHeading = HEADING_TYPES.has(node_type);
  const isMid = MID_TYPES.has(node_type);
  // Build the label string (e.g. "Chapter I", "Section 33")
  const label = number ? `${node_type_label} ${number}` : node_type_label;

  return (
    <div
      className={cn(
        'animate-in fade-in-0 duration-200 fill-mode-both',
        'border-l-2 border-transparent',
        depth > 0 && 'border-l-border/50',
        isHeading && depth === 0 && 'mt-6 first:mt-0',
        isHeading && depth > 0 && 'mt-4',
        !isHeading && 'mt-1',
      )}
      style={{
        paddingLeft: `${depth * 24}px`,
        animationDelay: `${animationDelay}ms`,
      }}
    >
      <div
        className={cn(
          'rounded-md px-4 py-3 transition-colors hover:bg-muted/30',
          isHeading && 'py-4',
        )}
      >
        {/* Node type label */}
        <p
          className={cn(
            'text-xs font-medium uppercase tracking-wider text-muted-foreground',
            isHeading && 'text-primary/70',
          )}
        >
          {label}
        </p>

        {/* Title */}
        {title && (
          <p
            className={cn(
              'mt-0.5',
              isHeading && 'text-lg font-semibold text-foreground',
              isMid && 'text-base font-medium text-foreground',
              !isHeading && !isMid && 'text-sm font-medium text-foreground/90',
            )}
          >
            {title}
          </p>
        )}

        {/* Content */}
        {content && (
          <div
            className={cn(
              'mt-2 text-sm leading-relaxed text-muted-foreground whitespace-pre-wrap',
              isHeading && 'text-base',
            )}
          >
            {content}
          </div>
        )}
      </div>
    </div>
  );
}

export { StatuteNodeTree };
