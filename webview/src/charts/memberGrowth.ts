import { Chart } from 'chart.js/auto';
import type { MemberGrowth } from '../types';
import { palette, onThemeChange } from '../theme';

const crosshairPlugin = {
  id: 'crosshair',
  afterDraw(chart: Chart) {
    const active = (chart.tooltip as any)?._active;
    if (!active?.length) return;
    const ctx = chart.ctx;
    const x = active[0].element.x;
    const yScale = chart.scales['y'];
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(x, yScale.top);
    ctx.lineTo(x, yScale.bottom);
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = palette.ink;
    ctx.setLineDash([5, 4]);
    ctx.stroke();
    ctx.restore();
  }
};

export function renderMemberGrowth(canvas: HTMLCanvasElement, data: MemberGrowth[]) {
  const create = () => new Chart(canvas, {
    type: 'line',
    plugins: [crosshairPlugin],
    data: {
      labels: data.map(d => d.date),
      datasets: [{
        label: 'Total Members',
        data: data.map(d => d.count),
        borderColor: palette.ink,
        backgroundColor: 'rgba(245, 192, 42, 0.35)',
        fill: true,
        pointRadius: 0,
        pointHoverRadius: 5,
        pointHoverBackgroundColor: palette.ink,
        pointHoverBorderColor: palette.ink,
        pointHoverBorderWidth: 2,
        stepped: true
      }]
    },
    options: {
      scales: {
        x: { ticks: { maxTicksLimit: 8 } }
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx) => ` ${ctx.parsed.y} members`
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
