/**
 * Format a date/hour string for chart axis tick labels.
 * Handles both hourly ("2024-01-15 14") and daily ("2024-01-15") formats.
 */
export function formatDateTick(
  value: string,
  granularity: 'hour' | 'day'
): string {
  if (granularity === 'hour' && value.includes(' ')) {
    const h = parseInt(value.split(' ')[1], 10);
    if (h === 0) return '12 AM';
    if (h === 12) return '12 PM';
    return h < 12 ? `${h} AM` : `${h - 12} PM`;
  }
  const d = new Date(value);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/**
 * Format a date/hour string for chart tooltip labels (longer format).
 */
export function formatDateTooltipLabel(
  value: string,
  granularity: 'hour' | 'day'
): string {
  if (granularity === 'hour' && value.includes(' ')) {
    return formatDateTick(value, granularity);
  }
  return new Date(value).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}
