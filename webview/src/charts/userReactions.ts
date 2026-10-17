import { Chart } from 'chart.js/auto';
import type { User } from '../types';
import { deAnon, onDeAnonChange } from '../deanon';
import { palette, onThemeChange } from '../theme';

export function renderUserReactions(canvas: HTMLCanvasElement, users: User[]) {
  const top15 = [...users]
    .filter(u => u.total_reactions_earned !== undefined && u.total_reactions_earned > 0)
    .sort((a, b) => (b.total_reactions_earned || 0) - (a.total_reactions_earned || 0))
    .slice(0, 15);

  let chart: Chart | null = null;

  function create(): Chart {
    return new Chart(canvas, {
      type: 'bar',
      data: {
        labels: top15.map(d => deAnon(d.alias)),
        datasets: [
          { label: 'Reactions Earned', data: top15.map(d => d.total_reactions_earned || 0), backgroundColor: palette.ink }
        ]
      },
      options: {
        indexAxis: 'y',
        interaction: { axis: 'y' },
        scales: { y: { ticks: { autoSkip: false } } },
        plugins: {
          legend: { display: false }
        }
      }
    });
  }

  chart = create();

  const redraw = () => {
    chart?.destroy();
    chart = create();
  };
  onDeAnonChange(redraw);
  onThemeChange(redraw);
}
