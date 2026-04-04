/** Format a Date as YYYY-MM-DD in UTC+8 */
export function toDateStrUTC8(d: Date): string {
  const utc8 = new Date(d.getTime() + 8 * 60 * 60 * 1000);
  return utc8.toISOString().split('T')[0];
}
