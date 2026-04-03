import { Chart } from 'chart.js/auto';
import type { MemberGrowth } from '../types';

export function renderMemberGrowth(canvas: HTMLCanvasElement, data: MemberGrowth[]) {
  new Chart(canvas, {
    type: 'line',
    data: {
      labels: data.map(d => d.date),
      datasets: [{
        label: 'Total Members',
        data: data.map(d => d.count),
        borderColor: '#3b82f6',
        backgroundColor: 'rgba(59, 130, 246, 0.2)',
        fill: true,
        pointRadius: 0,
        stepped: true
      }]
    },
    options: {
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
