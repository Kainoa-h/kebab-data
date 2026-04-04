import type { CalendarData, DayStatus } from '../types';
import { STATUS_COLORS, normalizeStatus } from '../types';
import { toDateStrUTC8 } from '../utils';

interface StreakInfo {
  todayStatus: DayStatus;
  currentStreakLen: number;
  currentStreakStatus: DayStatus;
  longestOpen: number;
  totalOpen: number;
  totalKnown: number;
}

function computeStreaks(calendarData: CalendarData): StreakInfo {
  const start = new Date('2025-04-01');
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const days: DayStatus[] = [];

  for (let d = new Date(start); d <= today; d.setDate(d.getDate() + 1)) {
    const dateStr = toDateStrUTC8(d);
    const record = calendarData[dateStr];
    let status: DayStatus;
    if (record) {
      status = normalizeStatus(record.status);
    } else if (d.getDay() === 0) {
      status = 'closed';
    } else {
      status = 'unknown';
    }
    days.push(status);
  }

  // Current streak: walk backwards from today
  const todayStatus = days[days.length - 1] ?? 'unknown';
  let currentStreakLen = 0;
  for (let i = days.length - 1; i >= 0; i--) {
    if (days[i] === todayStatus) currentStreakLen++;
    else break;
  }

  // Longest open streak: forward pass
  let longestOpen = 0, runOpen = 0;
  for (const s of days) {
    if (s === 'open') { runOpen++; longestOpen = Math.max(longestOpen, runOpen); }
    else runOpen = 0;
  }

  const totalOpen = days.filter(s => s === 'open').length;
  const totalKnown = days.filter(s => s !== 'unknown').length;

  return { todayStatus, currentStreakLen, currentStreakStatus: todayStatus, longestOpen, totalOpen, totalKnown };
}

function statusLabel(s: DayStatus): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function statusColor(s: DayStatus): string {
  return STATUS_COLORS[s];
}

function statusEmoji(s: DayStatus): string {
  if (s === 'open') return '✅';
  if (s === 'closed') return '🔒';
  if (s === 'conflicted') return '⚠️';
  return '❓';
}

function streakEmoji(s: DayStatus, len: number): string {
  if (s === 'open') return len >= 5 ? '🔥' : '✅';
  if (s === 'closed') return '🔒';
  if (s === 'conflicted') return '⚠️';
  return '❓';
}

function statCard(title: string, value: string, sub: string, color: string): string {
  return `
    <div class="bg-gray-800 rounded-lg p-4 flex flex-col gap-1 border border-gray-700">
      <span class="text-xs text-gray-500 uppercase tracking-wider font-semibold">${title}</span>
      <span class="text-2xl font-extrabold" style="color: ${color}">${value}</span>
      <span class="text-xs text-gray-400">${sub}</span>
    </div>
  `;
}

export function renderStreaks(container: HTMLDivElement, calendarData: CalendarData): void {
  const { todayStatus, currentStreakLen, currentStreakStatus, longestOpen, totalOpen, totalKnown } = computeStreaks(calendarData);

  const cards = [
    statCard(
      `${statusEmoji(todayStatus)} Today`,
      statusLabel(todayStatus),
      'latest known day',
      statusColor(todayStatus)
    ),
    statCard(
      `${streakEmoji(currentStreakStatus, currentStreakLen)} Current streak`,
      `${currentStreakLen} day${currentStreakLen !== 1 ? 's' : ''}`,
      currentStreakStatus === 'unknown' ? 'someone go and check pls :(' : `${statusLabel(currentStreakStatus).toLowerCase()} reported in a row`,
      statusColor(currentStreakStatus)
    ),
    statCard(
      '🏆 Longest open run',
      `${longestOpen} day${longestOpen !== 1 ? 's' : ''}`,
      'consecutive reported open days ever',
      STATUS_COLORS.open
    ),
    statCard(
      '📊 Total reported open days',
      `${totalOpen}`,
      `of ${totalKnown} days reported`,
      '#f97316'
    ),
  ];

  container.innerHTML = `<div class="grid grid-cols-2 sm:grid-cols-4 gap-3">${cards.join('')}</div>`;
}
