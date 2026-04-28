export const BOT_TYPE_COLORS: Record<string, string> = {
  search_engine:
    'text-blue-600 border-blue-200 bg-blue-50 dark:text-blue-400 dark:border-blue-900/50 dark:bg-blue-950/50',
  social_media:
    'text-purple-600 border-purple-200 bg-purple-50 dark:text-purple-400 dark:border-purple-900/50 dark:bg-purple-950/50',
  other:
    'text-gray-600 border-gray-200 bg-gray-50 dark:text-gray-400 dark:border-gray-700/50 dark:bg-gray-900/50',
};

export function formatBotType(type: string): string {
  return type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}
