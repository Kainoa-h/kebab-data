import { Chart } from 'chart.js/auto';
import type { MemberGrowth } from '../types';

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
    ctx.strokeStyle = 'rgba(251, 146, 60, 0.7)';
    ctx.setLineDash([5, 4]);
    ctx.stroke();
    ctx.restore();
  }
};

export function renderMemberGrowth(canvas: HTMLCanvasElement, data: MemberGrowth[]) {
  new Chart(canvas, {
    type: 'line',
    plugins: [crosshairPlugin],
    data: {
      labels: data.map(d => d.date),
      datasets: [{
        label: 'Total Members',
        data: data.map(d => d.count),
        borderColor: '#3b82f6',
        backgroundColor: 'rgba(59, 130, 246, 0.15)',
        fill: true,
        pointRadius: 0,
        pointHoverRadius: 5,
        pointHoverBackgroundColor: '#f97316',
        pointHoverBorderColor: '#fff',
        pointHoverBorderWidth: 2,
        stepped: true
      }]
    },
    options: {
      color: '#e5e7eb',
      interaction: {
        mode: 'index',
        intersect: false
      },
      scales: {
        x: { grid: { color: '#374151' }, ticks: { color: '#9ca3af', maxTicksLimit: 8 } },
        y: { grid: { color: '#374151' }, ticks: { color: '#9ca3af' } }
      },
      plugins: {
        tooltip: {
          backgroundColor: '#1f2937',
          borderColor: '#f97316',
          borderWidth: 1,
          callbacks: {
            label: (ctx) => ` ${ctx.parsed.y} members`
          }
        },
        legend: { labels: { color: '#e5e7eb' } }
      }
    }
  });
}
