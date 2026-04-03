import { Chart } from 'chart.js/auto';
import type { MonthlyStat } from '../types';

export function renderNewMembersPerMonth(canvas: HTMLCanvasElement, data: MonthlyStat[]) {
  new Chart(canvas, {
    type: 'bar',
    data: {
      labels: data.map(d => d.month),
      datasets: [{
        label: 'New Cultists',
        data: data.map(d => d.new_members),
        backgroundColor: '#a78bfa',
        borderColor: '#7c3aed',
        borderWidth: 1,
        borderRadius: 4,
      }]
    },
    options: {
      color: '#e5e7eb',
      scales: {
        x: { grid: { color: '#374151' }, ticks: { color: '#9ca3af' } },
        y: { grid: { color: '#374151' }, ticks: { color: '#9ca3af' }, beginAtZero: true }
      },
      plugins: {
        tooltip: {
          backgroundColor: '#1f2937',
          callbacks: {
            label: (ctx) => ` ${ctx.parsed.y} new member${ctx.parsed.y !== 1 ? 's' : ''}`
          }
        },
        legend: { labels: { color: '#e5e7eb' } }
      }
    }
  });
}
