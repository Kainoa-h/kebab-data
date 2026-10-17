import { Chart } from 'chart.js/auto';
import type { Plugin } from 'chart.js';
import type { MediaBreakdown } from '../types';
import { palette, onThemeChange } from '../theme';

const barValueLabels: Plugin<'bar'> = {
  id: 'barValueLabels',
  afterDatasetsDraw(chart) {
    const { ctx } = chart;
    const meta = chart.getDatasetMeta(0);
    const values = chart.data.datasets[0].data as number[];
    ctx.save();
    ctx.font = `bold 11px ${Chart.defaults.font.family}`;
    ctx.fillStyle = palette.ink;
    ctx.textBaseline = 'middle';
    meta.data.forEach((bar, i) => {
      ctx.fillText(`${values[i]}%`, bar.x + 6, bar.y);
    });
    ctx.restore();
  },
};

export function renderMediaEfficiency(canvas: HTMLCanvasElement, data: MediaBreakdown[]) {
  // Sorted by ratio
  const rows = data
    .filter(d => d.total > 0)
    .map(d => ({ ...d, share: Math.round((d.attributed / d.total) * 1000) / 10 }))
    .sort((a, b) => b.share - a.share);

  const create = () => new Chart(canvas, {
    type: 'bar',
    plugins: [barValueLabels],
    data: {
      labels: rows.map(d => `${d.type} (n=${d.total})`),
      datasets: [
        { label: 'Reported a status', data: rows.map(d => d.share), backgroundColor: palette.tag, borderColor: palette.ink, borderWidth: 1.5 }
      ]
    },
    options: {
      indexAxis: 'y',
      interaction: { axis: 'y' },
      layout: { padding: { right: 48 } },
      scales: {
        x: { beginAtZero: true, max: 100, ticks: { callback: v => `${v}%` } }
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: ctx => {
              const row = rows[ctx.dataIndex];
              return ` ${row.share}% reported a status (${row.attributed} of ${row.total})`;
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
