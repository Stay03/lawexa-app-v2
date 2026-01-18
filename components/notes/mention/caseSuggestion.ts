import { ReactRenderer } from '@tiptap/react';
import tippy, { type Instance as TippyInstance } from 'tippy.js';
import type { SuggestionOptions, SuggestionProps } from '@tiptap/suggestion';
import { CaseSuggestionList, type CaseSuggestionListRef } from './CaseSuggestionList';
import { casesApi } from '@/lib/api/cases';
import type { Case } from '@/types/case';

export interface CaseMentionAttrs {
  id: number;
  slug: string;
  label: string;
}

// Extended Case type with search metadata
export interface CaseWithMeta extends Case {
  __searchTotal?: number;
}

export const caseSuggestion: Partial<SuggestionOptions<CaseWithMeta, CaseMentionAttrs>> = {
  char: '@',
  allowSpaces: true,
  startOfLine: false,
  // Use decorationClass to mark the suggestion text - we'll add a parent class to control visibility
  decorationClass: 'mention-suggestion',

  items: async ({ query }): Promise<CaseWithMeta[]> => {
    // Require at least 2 characters before searching
    if (query.length < 2) {
      return [];
    }

    try {
      const response = await casesApi.getList({
        search: query,
        per_page: 10,
      });

      // If no results, return a marker item with total = 0
      if (response.pagination.total === 0) {
        return [{ __searchTotal: 0 } as CaseWithMeta];
      }

      // Return cases with total embedded in first item
      const cases = response.data as CaseWithMeta[];
      if (cases.length > 0) {
        cases[0].__searchTotal = response.pagination.total;
      }
      return cases;
    } catch (error) {
      console.error('Failed to fetch cases for mention:', error);
      return [];
    }
  },

  render: () => {
    let component: ReactRenderer<CaseSuggestionListRef> | null = null;
    let popup: TippyInstance[] | null = null;
    let editorRef: SuggestionProps<Case, CaseMentionAttrs>['editor'] | null = null;
    let blurHandler: (() => void) | null = null;

    return {
      onStart: (props: SuggestionProps<Case, CaseMentionAttrs>) => {
        editorRef = props.editor;

        // Add class to editor to indicate suggestion mode is active
        editorRef?.view?.dom?.classList.add('mention-mode-active');

        // Remove class when editor loses focus (click outside)
        const handleBlur = () => {
          editorRef?.view?.dom?.classList.remove('mention-mode-active');
        };
        editorRef?.view?.dom?.addEventListener('blur', handleBlur);
        blurHandler = handleBlur;

        component = new ReactRenderer(CaseSuggestionList, {
          props,
          editor: props.editor,
        });

        if (!props.clientRect) {
          return;
        }

        popup = tippy('body', {
          getReferenceClientRect: props.clientRect as () => DOMRect,
          appendTo: () => document.body,
          content: component.element,
          showOnCreate: true,
          interactive: true,
          trigger: 'manual',
          placement: 'bottom-start',
          maxWidth: 'none',
        });
      },

      onUpdate: (props: SuggestionProps<Case, CaseMentionAttrs>) => {
        component?.updateProps(props);

        if (!props.clientRect) {
          return;
        }

        popup?.[0]?.setProps({
          getReferenceClientRect: props.clientRect as () => DOMRect,
        });
      },

      onKeyDown: (props: { event: KeyboardEvent }) => {
        if (props.event.key === 'Escape') {
          popup?.[0]?.hide();
          return false; // Let TipTap handle Escape to properly exit suggestion mode
        }

        return component?.ref?.onKeyDown(props) ?? false;
      },

      onExit: () => {
        // Remove blur listener
        if (blurHandler) {
          editorRef?.view?.dom?.removeEventListener('blur', blurHandler);
          blurHandler = null;
        }

        // Remove class from editor when suggestion mode ends
        editorRef?.view?.dom?.classList.remove('mention-mode-active');

        popup?.[0]?.destroy();
        component?.destroy();
      },
    };
  },
};
