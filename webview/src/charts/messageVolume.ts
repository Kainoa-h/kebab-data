import { Chart } from 'chart.js/auto';
import type { MessageVolume } from '../types';
import { palette, onThemeChange } from '../theme';

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
  const months = labels.map(l => monthlyData[l]);
  const share = months.map(m => (m.total > 0 ? Math.round((m.attributed / m.total) * 100) : 0));

  const create = () => new Chart(canvas, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'Messages that reported a status',
        data: share,
        borderColor: palette.open,
        backgroundColor: palette.open,
        pointRadius: 3,
        tension: 0.2,
      }]
    },
    options: {
      scales: {
        y: { beginAtZero: true, ticks: { callback: v => `${v}%` } }
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: ctx => {
              const m = months[ctx.dataIndex];
              return ` ${ctx.parsed.y}% useful (${m.attributed} of ${m.total} messages, the rest is yap)`;
            }
          }
        }
      }
    }
  });

  let chart = create();
  onThemeChange(() => {
    chart.destroy();
    chart = create();
  });
}
