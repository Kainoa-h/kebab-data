import { Chart } from 'chart.js/auto';
import type { MonthlyStat } from '../types';
import { palette, onThemeChange } from '../theme';

export function renderNewMembersPerMonth(canvas: HTMLCanvasElement, data: MonthlyStat[]) {
  const create = () => new Chart(canvas, {
    type: 'bar',
    data: {
      labels: data.map(d => d.month),
      datasets: [{
        label: 'New Cultists',
        data: data.map(d => d.new_members),
        backgroundColor: palette.ink,
      }]
    },
    options: {
      scales: {
        y: { beginAtZero: true }
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx) => ` ${ctx.parsed.y} new member${ctx.parsed.y !== 1 ? 's' : ''}`
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
