import type { User } from './types';

export function renderContributorTable(tbody: HTMLTableSectionElement, users: User[]) {
  const sortedUsers = [...users].sort((a, b) => b.total_attributions - a.total_attributions);
  
  tbody.innerHTML = sortedUsers.map((user, index) => `
    <tr class="even:bg-gray-800 border-b border-gray-800 last:border-0">
      <td class="py-2 px-4">${index + 1}</td>
      <td class="py-2 px-4 font-medium">${user.alias}</td>
      <td class="py-2 px-4 text-gray-400">${user.join_date || '-'}</td>
      <td class="py-2 px-4 text-gray-400">${user.join_method || '-'}</td>
      <td class="py-2 px-4 text-green-500">${user.open_attributions}</td>
      <td class="py-2 px-4 text-red-500">${user.closed_attributions}</td>
      <td class="py-2 px-4 font-semibold">${user.total_attributions}</td>
    </tr>
  `).join('');
}
