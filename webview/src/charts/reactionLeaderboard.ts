import { Chart } from 'chart.js/auto';
import type { ReactionStat } from '../types';
import { palette, onThemeChange } from '../theme';

export function renderReactionLeaderboard(canvas: HTMLCanvasElement, data: ReactionStat[]) {
  // top 15 by total_count, emoji as x labels (font-size 18px)
  const top15 = [...data].sort((a, b) => b.total_count - a.total_count).slice(0, 15);

  const create = () => new Chart(canvas, {
    type: 'bar',
    data: {
      labels: top15.map(d => d.emoji),
      datasets: [
        { label: 'Total Reactions', data: top15.map(d => d.total_count), backgroundColor: palette.tag, borderColor: palette.ink, borderWidth: 1.5 }
      ]
    },
    options: {
      scales: {
        x: { 
          grid: { drawOnChartArea: false },
          ticks: { font: { size: 18 } }
        }
      },
      plugins: {
        legend: { display: false }
      }
    }
  });

  let chart = create();
  onThemeChange(() => {
    chart.destroy();
    chart = create();
  });
}
