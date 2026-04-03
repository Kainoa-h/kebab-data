import { Chart } from 'chart.js/auto';
import type { User } from '../types';

export function renderUserReactions(canvas: HTMLCanvasElement, users: User[]) {
  // top 15 by total_reactions_earned
  const top15 = [...users]
    .filter(u => u.total_reactions_earned !== undefined && u.total_reactions_earned > 0)
    .sort((a, b) => (b.total_reactions_earned || 0) - (a.total_reactions_earned || 0))
    .slice(0, 15);

  new Chart(canvas, {
    type: 'bar',
    data: {
      labels: top15.map(d => d.alias),
      datasets: [
        { label: 'Reactions Earned', data: top15.map(d => d.total_reactions_earned || 0), backgroundColor: '#ec4899' }
      ]
    },
    options: {
      indexAxis: 'y',
      color: '#e5e7eb',
      scales: {
        x: { grid: { color: '#374151' } },
        y: { grid: { color: '#374151' } }
      },
      plugins: {
        tooltip: { backgroundColor: '#1f2937' },
        legend: { labels: { color: '#e5e7eb' } }
      }
    }
  });
}
