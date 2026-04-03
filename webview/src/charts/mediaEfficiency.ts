import { Chart } from 'chart.js/auto';
import type { MediaBreakdown } from '../types';

export function renderMediaEfficiency(canvas: HTMLCanvasElement, data: MediaBreakdown[]) {
  // Sorted by ratio
  const sortedData = [...data].sort((a, b) => {
    const ratioA = a.total > 0 ? a.attributed / a.total : 0;
    const ratioB = b.total > 0 ? b.attributed / b.total : 0;
    return ratioB - ratioA;
  });

  new Chart(canvas, {
    type: 'bar',
    data: {
      labels: sortedData.map(d => d.type),
      datasets: [
        { label: 'Total', data: sortedData.map(d => d.total), backgroundColor: '#4b5563' },
        { label: 'Attributed', data: sortedData.map(d => d.attributed), backgroundColor: '#3b82f6' }
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
