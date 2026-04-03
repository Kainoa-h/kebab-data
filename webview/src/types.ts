export type DayStatus = 'open' | 'closed' | 'conflicted' | 'unknown';

export const STATUS_COLORS: Record<DayStatus, string> = {
  open: '#22c55e',
  closed: '#ef4444',
  conflicted: '#eab308',
  unknown: '#6b7280',
};

export interface User {
  alias: string;
  join_date: string | null;
  join_method: string | null;
  total_attributions: number;
  open_attributions: number;
  closed_attributions: number;
  total_reactions_earned?: number;
}

export interface DayRecord {
  status: DayStatus;
  contributors: string[];
}

export type CalendarData = Record<string, DayRecord>;

export interface MemberJoin {
  date: string;
  count: number;
  members: string[];
}

export interface MemberGrowth {
  date: string;
  count: number;
}

export interface MessageVolume {
  date: string;
  total: number;
  attributed: number;
}

export interface MonthlyStat {
  month: string;
  new_members: number;
  total_messages: number;
  attributed_messages: number;
  open_days: number;
  closed_days: number;
  unknown_days: number;
  conflicted_days: number;
}

export interface ReactionStat {
  emoji: string;
  total_count: number;
  unique_users: number;
  most_active_day: string | null;
}

export interface DowPattern {
  dow: number;
  label: string;
  open: number;
  closed: number;
  unknown: number;
  conflicted: number;
  avg_messages: number;
}

export interface MediaBreakdown {
  type: string;
  total: number;
  attributed: number;
}

export interface AppData {
  users: User[];
  calendar: CalendarData;
  memberGrowth: MemberGrowth[];
  messageVolume: MessageVolume[];
  monthlyStats: MonthlyStat[];
  reactionStats: ReactionStat[];
  dowPatterns: DowPattern[];
  mediaBreakdown: MediaBreakdown[];
  memberJoins: MemberJoin[];
}
