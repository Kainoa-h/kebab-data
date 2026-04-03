import type { User } from './types';

export function renderContributorTable(
  tbody: HTMLTableSectionElement, 
  selectSort: HTMLSelectElement, 
  users: User[]
) {
  function render() {
    const sortBy = selectSort.value;
    
    const sortedUsers = [...users].sort((a, b) => {
      if (sortBy === 'open') return b.open_attributions - a.open_attributions;
      if (sortBy === 'closed') return b.closed_attributions - a.closed_attributions;
      if (sortBy === 'reactions') return (b.total_reactions_earned || 0) - (a.total_reactions_earned || 0);
      return b.total_attributions - a.total_attributions; // default total
    });
    
    tbody.innerHTML = sortedUsers.map((user, index) => `
      <tr class="even:bg-gray-800 border-b border-gray-800 last:border-0 hover:bg-gray-700 transition-colors" title="Joined: ${user.join_date || 'Unknown'}">
        <td class="py-2 px-4">${index + 1}</td>
        <td class="py-2 px-4 font-medium cursor-help underline decoration-dotted decoration-gray-500 underline-offset-4">${user.alias}</td>
        <td class="py-2 px-4 text-green-500">${user.open_attributions}</td>
        <td class="py-2 px-4 text-red-500">${user.closed_attributions}</td>
        <td class="py-2 px-4 font-semibold">${user.total_attributions}</td>
        <td class="py-2 px-4 text-yellow-500 font-semibold">${user.total_reactions_earned || 0}</td>
      </tr>
    `).join('');
  }

  render();
  selectSort.addEventListener('change', render);
}
