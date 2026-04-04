import type { User, CalendarData } from './types';
import { normalizeStatus } from './types';
import { deAnon, onDeAnonChange } from './deanon';

function computeMonthlyUsers(month: string, calendarData: CalendarData, allUsers: User[]): User[] {
  const joinMap = new Map(allUsers.map(u => [u.alias, u.join_date]));
  const counts = new Map<string, { open: number; closed: number }>();

  for (const [date, record] of Object.entries(calendarData)) {
    if (!date.startsWith(month)) continue;
    const status = normalizeStatus(record.status);
    for (const alias of record.contributors ?? []) {
      const c = counts.get(alias) ?? { open: 0, closed: 0 };
      if (status === 'open') c.open++;
      else if (status === 'closed') c.closed++;
      counts.set(alias, c);
    }
  }

  return Array.from(counts.entries()).map(([alias, c]) => ({
    alias,
    join_date: joinMap.get(alias) ?? null,
    join_method: null,
    open_attributions: c.open,
    closed_attributions: c.closed,
    total_attributions: c.open + c.closed,
    total_reactions_earned: undefined,
  }));
}

export function renderContributorTable(
  tbody: HTMLTableSectionElement,
  selectSort: HTMLSelectElement,
  selectMonth: HTMLSelectElement,
  btnPrev: HTMLButtonElement,
  btnNext: HTMLButtonElement,
  users: User[],
  calendarData: CalendarData
) {
  const monthOptions = Array.from(selectMonth.options).map(o => o.value);

  function updatePagingButtons() {
    const idx = monthOptions.indexOf(selectMonth.value);
    btnPrev.disabled = idx <= 0;
    btnNext.disabled = idx >= monthOptions.length - 1;
  }

  function render() {
    const sortBy = selectSort.value;
    const month = selectMonth.value;
    const isMonthly = month !== 'all';

    const source = isMonthly ? computeMonthlyUsers(month, calendarData, users) : users;

    const sortedUsers = [...source].sort((a, b) => {
      if (sortBy === 'open') return b.open_attributions - a.open_attributions;
      if (sortBy === 'closed') return b.closed_attributions - a.closed_attributions;
      if (sortBy === 'reactions' && !isMonthly) return (b.total_reactions_earned || 0) - (a.total_reactions_earned || 0);
      return b.total_attributions - a.total_attributions;
    });

    tbody.innerHTML = sortedUsers.map((user, index) => `
      <tr class="even:bg-gray-800/60 border-b border-gray-800 last:border-0 hover:bg-gray-700/60 transition-colors" title="Joined: ${user.join_date || 'Unknown'}">
        <td class="py-1.5 px-2 md:px-4 tabular-nums text-gray-400">${index + 1}</td>
        <td class="py-1.5 px-2 md:px-4 font-medium cursor-help underline decoration-dotted decoration-gray-500 underline-offset-4 max-w-[120px] md:max-w-none truncate">${deAnon(user.alias)}</td>
        <td class="py-1.5 px-2 md:px-4 text-green-500 tabular-nums">${user.open_attributions}</td>
        <td class="py-1.5 px-2 md:px-4 text-red-500 tabular-nums">${user.closed_attributions}</td>
        <td class="py-1.5 px-2 md:px-4 font-semibold tabular-nums">${user.total_attributions}</td>
        <td class="py-1.5 px-2 md:px-4 text-yellow-500 font-semibold tabular-nums">${isMonthly ? '—' : (user.total_reactions_earned || 0)}</td>
      </tr>
    `).join('');

    updatePagingButtons();
  }

  render();
  selectSort.addEventListener('change', render);
  selectMonth.addEventListener('change', render);
  btnPrev.addEventListener('click', () => {
    const idx = monthOptions.indexOf(selectMonth.value);
    if (idx > 0) { selectMonth.value = monthOptions[idx - 1]; render(); }
  });
  btnNext.addEventListener('click', () => {
    const idx = monthOptions.indexOf(selectMonth.value);
    if (idx < monthOptions.length - 1) { selectMonth.value = monthOptions[idx + 1]; render(); }
  });
  onDeAnonChange(render);
}
