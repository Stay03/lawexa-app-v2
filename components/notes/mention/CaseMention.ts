import Mention from '@tiptap/extension-mention';
import { mergeAttributes } from '@tiptap/core';
import { caseSuggestion } from './caseSuggestion';

/**
 * Custom Tiptap Mention extension for case references
 * Renders mentions as clickable links to case detail pages
 *
 * Uses custom attributes: id, slug, label
 * Renders as <a> tag with data-type="case-mention"
 */
export const CaseMention = Mention.extend({
  name: 'caseMention',

  addAttributes() {
    return {
      id: {
        default: null,
        parseHTML: (element) => element.getAttribute('data-case-id'),
        renderHTML: (attributes) => {
          if (!attributes.id) return {};
          return { 'data-case-id': attributes.id };
        },
      },
      slug: {
        default: null,
        parseHTML: (element) => element.getAttribute('data-case-slug'),
        renderHTML: (attributes) => {
          if (!attributes.slug) return {};
          return { 'data-case-slug': attributes.slug };
        },
      },
      label: {
        default: null,
        parseHTML: (element) => element.textContent?.replace(/^@/, '') || null,
        renderHTML: () => ({}),
      },
    };
  },

  renderHTML({ node, HTMLAttributes }) {
    return [
      'a',
      mergeAttributes(
        { 'data-type': 'case-mention' },
        { class: 'case-mention' },
        HTMLAttributes,
        {
          href: `/cases/${node.attrs.slug}`,
          'data-case-id': node.attrs.id,
          'data-case-slug': node.attrs.slug,
        }
      ),
      `@${node.attrs.label ?? node.attrs.id}`,
    ];
  },

  parseHTML() {
    return [
      {
        tag: 'a[data-type="case-mention"]',
      },
    ];
  },
}).configure({
  HTMLAttributes: {
    class: 'case-mention',
  },
  // @ts-expect-error - caseSuggestion has custom type for Case items
  suggestion: caseSuggestion,
});
