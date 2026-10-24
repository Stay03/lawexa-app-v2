'use client';

import { createContext, useContext, useRef, useState, type ReactNode, type RefObject } from 'react';

import { useComposerDraft } from './composer/useComposerDraft';

/**
 * The home's ONE chat box, shared by Chat, Work and Study (Stay, 24 October
 * 2026: "same chat box with the chat tab if possible so basically the tabs
 * switch but the chat box remains").
 *
 * The box itself is drawn once, by `HomeDock` in the home layout
 * (`app/v2/(home)/layout.tsx`), so a tab switch changes only the content above
 * it and never remounts it: the typed draft, the jurisdiction, the model and
 * any attached file stay. The surfaces above it still need its state: the
 * greeting turns confidential with the box's switch, the prompts fill and
 * focus it, and fade while a redacted send is held. This context carries
 * exactly that, from the layout down.
 *
 * The draft is the home's shared draft (`useComposerDraft`), as before.
 */
interface HomeComposerState {
  value: string;
  setValue: (next: string) => void;
  confidential: boolean;
  setConfidential: (next: boolean) => void;
  /** A redacted send waiting on this screen (`HomeComposer`'s `onRedactingChange`). */
  redacting: boolean;
  setRedacting: (next: boolean) => void;
  /** The box's wrapper: the prompts focus its textarea after filling it. */
  areaRef: RefObject<HTMLDivElement | null>;
}

const HomeComposerContext = createContext<HomeComposerState | null>(null);

export function HomeComposerProvider({ children }: { children: ReactNode }) {
  const [value, setValue] = useComposerDraft();
  const [confidential, setConfidential] = useState(false);
  const [redacting, setRedacting] = useState(false);
  const areaRef = useRef<HTMLDivElement>(null);
  return (
    <HomeComposerContext.Provider
      value={{ value, setValue, confidential, setConfidential, redacting, setRedacting, areaRef }}
    >
      {children}
    </HomeComposerContext.Provider>
  );
}

export function useHomeComposer(): HomeComposerState {
  const state = useContext(HomeComposerContext);
  if (!state) throw new Error('useHomeComposer is used outside the home layout');
  return state;
}

/**
 * Fill the box with a prompt stub and focus it, so the keyboard opens on a
 * phone and the reader completes the stub (v1 parity).
 */
export function useFillPrompt(): (prompt: string) => void {
  const { setValue, areaRef } = useHomeComposer();
  return (prompt: string) => {
    setValue(prompt);
    areaRef.current?.querySelector('textarea')?.focus();
  };
}
