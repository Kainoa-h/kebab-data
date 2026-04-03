import { Chart } from 'chart.js/auto';
import type { ReactionStat } from '../types';

export function renderReactionLeaderboard(canvas: HTMLCanvasElement, data: ReactionStat[]) {
  // top 15 by total_count, emoji as x labels (font-size 18px)
  const top15 = [...data].sort((a, b) => b.total_count - a.total_count).slice(0, 15);

  new Chart(canvas, {
    type: 'bar',
    data: {
      labels: top15.map(d => d.emoji),
      datasets: [
        { label: 'Total Reactions', data: top15.map(d => d.total_count), backgroundColor: '#f59e0b' }
      ]
    },
    options: {
      color: '#e5e7eb',
      scales: {
        x: { 
          grid: { color: '#374151', drawOnChartArea: false },
          ticks: { font: { size: 18 } }
        },
        y: { grid: { color: '#374151' } }
      },
      plugins: {
        tooltip: { backgroundColor: '#1f2937' },
        legend: { labels: { color: '#e5e7eb' } }
      }
    }
  });
}
