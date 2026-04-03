import { Chart } from 'chart.js/auto';
import type { MessageVolume } from '../types';

export function renderMessageVolume(canvas: HTMLCanvasElement, data: MessageVolume[]) {
  // Aggregate daily → monthly
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
  const attributed = labels.map(l => monthlyData[l].attributed);
  const unattributed = labels.map(l => monthlyData[l].total - monthlyData[l].attributed);

  new Chart(canvas, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        { label: 'Actually usefull messages telling us if shes open or nah', data: attributed, backgroundColor: '#10b981', stack: 'vol' },
        { label: 'yap', data: unattributed, backgroundColor: '#6b7280', stack: 'vol' }
      ]
    },
    options: {
      color: '#e5e7eb',
      scales: {
        x: { stacked: true, grid: { color: '#374151' }, ticks: { color: '#9ca3af' } },
        y: { stacked: true, grid: { color: '#374151' }, ticks: { color: '#9ca3af' } }
      },
      plugins: {
        tooltip: {
          backgroundColor: '#1f2937',
          callbacks: {
            footer: (items) => {
              const total = items.reduce((sum, i) => sum + (i.parsed.y ?? 0), 0);
              return `Total: ${total}`;
            }
          }
        },
        legend: { labels: { color: '#e5e7eb' } }
      }
    }
  });
}
