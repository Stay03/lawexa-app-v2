/**
 * The benefits each paid tier lists on a pricing card, keyed by tier
 * ("basic", "pro", "plus", "ai-counsel": the plan's `slug_base` without its
 * interval). `highlighted` lines always show; `more` lines sit behind
 * "More features".
 *
 * Moved here unchanged from v1's `components/subscriptions/PlanCard.tsx` so
 * the v1 and v2 pricing cards print the same words from one table. The words
 * are the product's own copy: they are not derived from the plan rows.
 */
export interface TierFeatures {
  highlighted: string[];
  more: string[];
}

// AI Counsel's feature set — shared with the Plus tier, which mirrors it.
const AI_COUNSEL_FEATURES: TierFeatures = {
  highlighted: [
    'Unlimited AI Messages',
    'Unlimited Library Access',
    'Chat with Document (No size limit)',
    'Chat with Statute',
    'Legal Drafting',
    'Deep Legal Research',
    'Deep Contract Review',
  ],
  more: [
    'Access to Case, Statute & Notes Library',
    'Foreign & Local Cases',
    'Multi-Jurisdiction Access',
    'Natural Language Search',
    'AI Tutor',
    'Study Mode',
    'Flashcards',
    'Quizzes',
    'Connect to a Lawyer',
    'Twitter Bot for legal updates',
  ],
};

export const TIER_FEATURES: Record<string, TierFeatures> = {
  basic: {
    highlighted: [
      '50 AI Messages',
      'Unlimited Library Access',
      'Chat with Document (10MB limit)',
      'Chat with Statute',
      'AI Tutor',
      'Natural Language Search',
    ],
    more: [
      'Access to Case, Statute & Notes Library',
      'Foreign & Local Cases',
      'Multi-Jurisdiction Access',
      'Study Mode',
      'Flashcards',
      'Quizzes',
      'Connect to a Lawyer',
    ],
  },
  pro: {
    highlighted: [
      '200 AI Messages',
      'Unlimited Library Access',
      '50 Deep Legal Research',
      'Chat with Document (25MB limit)',
      'Chat with Statute',
      'AI Tutor',
      'Natural Language Search',
    ],
    more: [
      'Access to Case, Statute & Notes Library',
      'Foreign & Local Cases',
      'Multi-Jurisdiction Access',
      'Study Mode',
      'Flashcards',
      'Quizzes',
      'Connect to a Lawyer',
    ],
  },
  'ai-counsel': AI_COUNSEL_FEATURES,
  // Plus mirrors AI Counsel's feature set (per product).
  plus: AI_COUNSEL_FEATURES,
};
