import type { AppData, CalendarData, User, MemberGrowth, MessageVolume, MonthlyStat, ReactionStat, DowPattern, MediaBreakdown, MemberJoin } from './types';

async function fetchJSON<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) {
    if (res.status === 404) {
      return {} as T; // Return empty for missing files
    }
    throw new Error(`Failed to fetch ${url}: ${res.statusText}`);
  }
  return res.json();
}

export async function fetchAllData(): Promise<AppData> {
  const [
    users,
    memberGrowth,
    messageVolume,
    monthlyStats,
    reactionStats,
    dowPatterns,
    mediaBreakdown,
    memberJoins
  ] = await Promise.all([
    fetchJSON<User[]>('/data/users.json'),
    fetchJSON<MemberGrowth[]>('/data/member_growth.json'),
    fetchJSON<MessageVolume[]>('/data/message_volume.json'),
    fetchJSON<MonthlyStat[]>('/data/monthly_stats.json'),
    fetchJSON<ReactionStat[]>('/data/reaction_stats.json'),
    fetchJSON<DowPattern[]>('/data/dow_patterns.json'),
    fetchJSON<MediaBreakdown[]>('/data/media_breakdown.json'),
    fetchJSON<MemberJoin[]>('/data/member_joins.json'),
  ]);

  // Calendar: 13 parallel fetches for 2025-04 through 2026-04
  const monthPromises: Promise<CalendarData>[] = [];
  for (let year = 2025; year <= 2026; year++) {
    for (let month = 1; month <= 12; month++) {
      if (year === 2025 && month < 4) continue;
      if (year === 2026 && month > 4) continue;
      
      const monthStr = month.toString().padStart(2, '0');
      monthPromises.push(fetchJSON<CalendarData>(`/data/calendar/${year}-${monthStr}.json`));
    }
  }

  const months = await Promise.all(monthPromises);
  const calendar: CalendarData = Object.assign({}, ...months);

  return {
    users,
    calendar,
    memberGrowth,
    messageVolume,
    monthlyStats,
    reactionStats,
    dowPatterns,
    mediaBreakdown,
    memberJoins,
  };
}
