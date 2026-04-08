/** Format large numbers for damage display: 1234567 → "1.2M" */
export function formatNumber(n: number): string {
  if (n < 1_000)         return String(Math.floor(n));
  if (n < 1_000_000)     return `${(n / 1_000).toFixed(1)}K`;
  if (n < 1_000_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n < 1e12)          return `${(n / 1_000_000_000).toFixed(1)}B`;
  return `${(n / 1e12).toFixed(1)}T`;
}

/** Pad a number to fixed width for HUD display */
export function padNumber(n: number, width: number): string {
  return String(n).padStart(width, '0');
}
