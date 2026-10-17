import type { CalendarData, DayStatus } from '../types';
import { normalizeStatus } from '../types';
import { toDateStrUTC8 } from '../utils';

interface LatestReport {
  date: string;
  status: DayStatus;
  contributorCount: number;
}

interface StreakInfo {
  latest: LatestReport | null;
  currentStreakLen: number;
  longestOpen: number;
  totalOpen: number;
  totalKnown: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;

function isSunday(dateStr: string): boolean {
  return new Date(`${dateStr}T00:00:00Z`).getUTCDay() === 0;
}

function computeStreaks(calendarData: CalendarData): StreakInfo {
  const weekdays = Object.keys(calendarData)
    .sort()
    .filter(date => !isSunday(date))
    .map(date => ({ date, status: normalizeStatus(calendarData[date].status) }));

  const latestIdx = weekdays.findLastIndex(d => d.status !== 'unknown');
  const latestDay = weekdays[latestIdx];
  const latest = latestDay
    ? { ...latestDay, contributorCount: calendarData[latestDay.date].contributors.length }
    : null;

  let currentStreakLen = 0;
  for (let i = latestIdx; i >= 0 && weekdays[i].status === latest?.status; i--) {
    currentStreakLen++;
  }

  let longestOpen = 0, runOpen = 0;
  for (const { status } of weekdays) {
    runOpen = status === 'open' ? runOpen + 1 : 0;
    longestOpen = Math.max(longestOpen, runOpen);
  }

  const totalOpen = weekdays.filter(d => d.status === 'open').length;
  const totalKnown = weekdays.filter(d => d.status !== 'unknown').length;

  return { latest, currentStreakLen, longestOpen, totalOpen, totalKnown };
}

function plural(n: number, word: string, pluralWord = `${word}s`): string {
  return `${n} ${n === 1 ? word : pluralWord}`;
}

function formatLongDate(dateStr: string): string {
  return new Date(`${dateStr}T00:00:00Z`).toLocaleDateString('en-GB', {
    weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC',
  });
}

function daysAgo(dateStr: string): string {
  const today = Date.parse(`${toDateStrUTC8(new Date())}T00:00:00Z`);
  const days = Math.round((today - Date.parse(`${dateStr}T00:00:00Z`)) / DAY_MS);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  return `${days} days ago`;
}

const SIGN_WORD: Record<DayStatus, string> = {
  open: 'Open',
  closed: 'Closed',
  conflicted: 'Open',
  unknown: '???',
};

function signCaption(latest: LatestReport | null): string {
  if (!latest) return 'Nobody has reported yet';
  return `Last report · ${formatLongDate(latest.date)} · ${plural(latest.contributorCount, 'witness', 'witnesses')}`;
}

function menuRow(label: string, value: string, note: string): string {
  return `
    <li>
      <div class="menu-row text-sm md:text-base">
        <span>${label}</span>
        <strong class="font-bold bg-tag text-on-tag px-1.5 tabular-nums whitespace-nowrap">${value}</strong>
      </div>
      <p class="text-xs text-ink-soft mt-0.5">${note}</p>
    </li>
  `;
}

export function renderStreaks(container: HTMLDivElement, calendarData: CalendarData): void {
  const { latest, currentStreakLen, longestOpen, totalOpen, totalKnown } = computeStreaks(calendarData);
  const openRate = totalKnown > 0 ? Math.round((totalOpen / totalKnown) * 100) : 0;
  const status = latest?.status ?? 'unknown';

  container.innerHTML = `
    <div class="grid grid-cols-1 lg:grid-cols-[3fr_2fr] gap-10 lg:gap-12 items-center">
      <div class="sign" role="status">
        <span class="sign-word uppercase" data-status="${status}">${SIGN_WORD[status]}</span>
        <div class="mt-8 pt-4 border-t border-fascia-text/15">
          <p class="text-xs md:text-sm uppercase tracking-[0.12em] text-fascia-text">${signCaption(latest)}</p>
          ${latest ? `<p class="mt-1 text-xs uppercase tracking-[0.12em] text-fascia-text/60">${daysAgo(latest.date)}</p>` : ''}
        </div>
      </div>
      <div>
        <h2 class="font-display uppercase text-2xl tracking-wide border-b-[3px] border-ink pb-2">Today's specials</h2>
        <ul class="mt-4 space-y-4">
          ${menuRow('Current streak', plural(currentStreakLen, 'day'), `${status} in a row, up to the last report`)}
          ${menuRow('Longest open run', plural(longestOpen, 'day'), 'the golden age, Sundays skipped')}
          ${menuRow('Open rate', `${openRate}%`, `open on ${totalOpen} of ${totalKnown} reported weekdays`)}
        </ul>
      </div>
    </div>
  `;
}
