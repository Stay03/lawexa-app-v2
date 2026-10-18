'use client';

import { createContext, useContext } from 'react';

import type { ProvisionPeek } from '@/v2/features/statutes/reader/provision';
import type { StatuteLinkTarget } from './document-links';

/**
 * The page a document chat sits on, as the chat's links see it. The statute
 * page provides it (18 October 2026): a link in an answer to a part of the SAME
 * statute lands the reader there in place, the way the Contents list does,
 * instead of loading the page again, and its badge previews the part from the
 * document already on the page. Anywhere else (the full chat screen, the
 * case page) there is no host, and a statute link is a plain in-app navigation.
 */
export interface DocumentLinkHost {
  /** The statute this page reads. */
  statuteSlug: string;
  /** Its name, for the badge's preview pane. */
  statuteTitle: string;
  /** Lands the reader on the link's part of the statute; false when the
   *  statute has no such part (the link then navigates, and the page says so). */
  jump: (target: Pick<StatuteLinkTarget, 'provision' | 'anchor'>) => boolean;
  /** The part's preview pane text, read from the document on the page. */
  peek: (target: Pick<StatuteLinkTarget, 'provision' | 'anchor'>) => ProvisionPeek | null;
  /** Runs before a jump: the phone's full-screen chat closes so the part shows. */
  beforeJump?: () => void;
}

export const DocumentLinkContext = createContext<DocumentLinkHost | null>(null);

export function useDocumentLinkHost(): DocumentLinkHost | null {
  return useContext(DocumentLinkContext);
}
