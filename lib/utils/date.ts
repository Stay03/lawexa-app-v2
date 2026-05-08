/**
 * Format a Date as "2nd Jan 2026 - 11:34pm".
 */
export function formatMessageTimestamp(date: Date): string {
  const day = date.getDate();
  const ordinalSuffix = (n: number) => {
    const v = n % 100;
    if (v >= 11 && v <= 13) return 'th';
    switch (n % 10) {
      case 1: return 'st';
      case 2: return 'nd';
      case 3: return 'rd';
      default: return 'th';
    }
  };
  const month = date.toLocaleString('en-US', { month: 'short' });
  const year = date.getFullYear();
  let hours = date.getHours();
  const minutes = date.getMinutes().toString().padStart(2, '0');
  const ampm = hours >= 12 ? 'pm' : 'am';
  hours = hours % 12 || 12;
  return `${day}${ordinalSuffix(day)} ${month} ${year} - ${hours}:${minutes}${ampm}`;
}
