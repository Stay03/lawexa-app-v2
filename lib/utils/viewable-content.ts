interface LabelInput {
  title: string | null;
  viewable_id: number;
}

interface HrefInput {
  viewable_type: string;
  slug: string | null;
}

export function viewableLabel({ title, viewable_id }: LabelInput): string {
  return title || `#${viewable_id}`;
}

export function viewableHref({ viewable_type, slug }: HrefInput): string | null {
  if (!slug) return null;
  switch (viewable_type) {
    case 'case':
      return `/cases/${slug}`;
    case 'note':
      return `/notes/${slug}`;
    case 'statute':
      return `/statutes/${slug}`;
    default:
      return null;
  }
}
