import { Chart } from 'chart.js/auto';
import type { DowPattern } from '../types';
import { STATUS_COLORS } from '../types';

export function renderDowPatterns(canvas: HTMLCanvasElement, data: DowPattern[]) {
  // Sunday is always closed — exclude it from the chart
  const filtered = data.filter(d => d.label !== 'Sun');

  new Chart(canvas, {
    type: 'bar',
    data: {
      labels: filtered.map(d => d.label),
      datasets: [
        { label: 'Open', data: filtered.map(d => d.open), backgroundColor: STATUS_COLORS.open },
        { label: 'Closed', data: filtered.map(d => d.closed), backgroundColor: STATUS_COLORS.closed },
        { label: 'Conflicted', data: filtered.map(d => d.conflicted), backgroundColor: STATUS_COLORS.conflicted },
        { label: 'Unknown', data: filtered.map(d => d.unknown), backgroundColor: STATUS_COLORS.unknown },
      ]
    },
    options: {
      color: '#e5e7eb',
      scales: {
        x: { stacked: true, grid: { color: '#374151' }, ticks: { color: '#e5e7eb' } },
        y: { stacked: true, grid: { color: '#374151' }, ticks: { color: '#e5e7eb' } }
      },
      plugins: {
        tooltip: { backgroundColor: '#1f2937' },
        legend: { labels: { color: '#e5e7eb' } }
      }
    }
  });
}
