import { Chart } from 'chart.js/auto';
import type { MessageVolume } from '../types';

export function renderMessageVolume(canvas: HTMLCanvasElement, data: MessageVolume[]) {
  // Aggregate daily→monthly
  const monthlyData = data.reduce((acc, row) => {
    const month = row.date.substring(0, 7); // YYYY-MM
    if (!acc[month]) {
      acc[month] = { total: 0, attributed: 0 };
    }
    acc[month].total += row.total;
    acc[month].attributed += row.attributed;
    return acc;
  }, {} as Record<string, { total: number, attributed: number }>);

  const labels = Object.keys(monthlyData).sort();
  const totals = labels.map(l => monthlyData[l].total);
  const attributed = labels.map(l => monthlyData[l].attributed);

  new Chart(canvas, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        { label: 'Total Messages', data: totals, backgroundColor: '#6b7280' },
        { label: 'Attributed Messages', data: attributed, backgroundColor: '#10b981' }
      ]
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
