'use client';

import { useMemo } from 'react';
import { Loader2 } from 'lucide-react';
import { useStatuteNodes } from '@/lib/hooks/useStatutes';
import { buildStatuteTree } from '@/lib/utils/statute-tree';
import { ErrorState } from '@/components/common/ErrorState';
import { StatuteNodeRenderer } from './StatuteNodeRenderer';

interface StatuteDocumentRendererProps {
  slug: string;
  nodesCount: number;
}

/**
 * Main document renderer that fetches nodes, builds the tree,
 * and renders the full statute as a legal document.
 */
function StatuteDocumentRenderer({ slug, nodesCount }: StatuteDocumentRendererProps) {
  const { data, isLoading, isError, refetch } = useStatuteNodes(slug, nodesCount);

  const tree = useMemo(() => {
    const nodes = data?.data?.nodes;
    if (!nodes || nodes.length === 0) return [];
    return buildStatuteTree(nodes);
  }, [data]);

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
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

  if (tree.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        No content sections available for this statute.
      </p>
    );
  }

  return (
    <>
      {tree.map((rootNode) => (
        <StatuteNodeRenderer key={rootNode.id} node={rootNode} />
      ))}
    </>
  );
}

export { StatuteDocumentRenderer };
