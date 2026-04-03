import { Chart } from 'chart.js/auto';
import type { DowPattern } from '../types';
import { STATUS_COLORS } from '../types';

export function renderDowPatterns(canvas: HTMLCanvasElement, data: DowPattern[]) {
  new Chart(canvas, {
    type: 'bar',
    data: {
      labels: data.map(d => d.label),
      datasets: [
        { label: 'Open', data: data.map(d => d.open), backgroundColor: STATUS_COLORS.open },
        { label: 'Closed', data: data.map(d => d.closed), backgroundColor: STATUS_COLORS.closed },
        { label: 'Conflicted', data: data.map(d => d.conflicted), backgroundColor: STATUS_COLORS.conflicted },
        { label: 'Unknown', data: data.map(d => d.unknown), backgroundColor: STATUS_COLORS.unknown },
      ]
    },
    options: {
      color: '#e5e7eb',
      scales: {
        x: { stacked: true, grid: { color: '#374151' } },
        y: { stacked: true, grid: { color: '#374151' } }
      },
      plugins: {
        tooltip: { backgroundColor: '#1f2937' },
        legend: { labels: { color: '#e5e7eb' } }
      }
    }
  });
}
