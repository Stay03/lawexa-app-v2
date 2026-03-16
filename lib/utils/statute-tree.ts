import type { StatuteNode } from '@/types/statute';

/**
 * A statute node with its children attached for recursive rendering.
 */
export interface StatuteTreeNode extends StatuteNode {
  children: StatuteTreeNode[];
}

/**
 * Converts a flat node array (from the API) into a tree structure
 * using `parent_id` relationships. O(n) map-based reconstruction.
 */
export function buildStatuteTree(nodes: StatuteNode[]): StatuteTreeNode[] {
  const map = new Map<number, StatuteTreeNode>();
  const roots: StatuteTreeNode[] = [];

  // First pass: wrap each node with an empty children array
  for (const node of nodes) {
    map.set(node.id, { ...node, children: [] });
  }

  // Second pass: link children to parents
  for (const node of nodes) {
    const treeNode = map.get(node.id)!;
    if (node.parent_id === null) {
      roots.push(treeNode);
    } else {
      const parent = map.get(node.parent_id);
      if (parent) {
        parent.children.push(treeNode);
      } else {
        // Orphan node — treat as root
        roots.push(treeNode);
      }
    }
  }

  // Sort children by position (defensive — API should already sort)
  for (const treeNode of map.values()) {
    if (treeNode.children.length > 1) {
      treeNode.children.sort((a, b) => a.position - b.position);
    }
  }

  return roots.sort((a, b) => a.position - b.position);
}
