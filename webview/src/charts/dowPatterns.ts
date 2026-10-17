import { Chart } from 'chart.js/auto';
import type { DowPattern } from '../types';
import { palette, onThemeChange } from '../theme';

function percent(part: number, whole: number): number {
  return whole > 0 ? Math.round((part / whole) * 100) : 0;
}

export function renderDowPatterns(canvas: HTMLCanvasElement, data: DowPattern[]) {
  // Sunday is always closed — exclude it from the chart
  const days = data
    .filter(d => d.label !== 'Sun')
    .map(d => {
      const open = d.open + d.conflicted;
      const reported = open + d.closed;
      return { label: d.label, open, closed: d.closed, reported };
    });

  const create = () => new Chart(canvas, {
    type: 'bar',
    data: {
      labels: days.map(d => [d.label, `n=${d.reported}`]),
      datasets: [
        { label: 'Open', data: days.map(d => percent(d.open, d.reported)), backgroundColor: palette.open },
        { label: 'Closed', data: days.map(d => percent(d.closed, d.reported)), backgroundColor: palette.closed },
      ]
    },
    options: {
      scales: {
        x: { stacked: true },
        y: { stacked: true, max: 100, ticks: { callback: v => `${v}%` } }
      },
      plugins: {
        tooltip: {
          callbacks: {
            label: ctx => {
              const day = days[ctx.dataIndex];
              const count = ctx.datasetIndex === 0 ? day.open : day.closed;
              return ` ${ctx.dataset.label}: ${ctx.parsed.y}% (${count} of ${day.reported} days)`;
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
