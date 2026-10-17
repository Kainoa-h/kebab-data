import { Chart } from 'chart.js/auto';
import { palette } from '../theme';

export function applyChartTheme() {
  const d = Chart.defaults;
  d.font.family = getComputedStyle(document.body).fontFamily;
  d.font.size = 11;
  d.color = palette.inkSoft;
  d.borderColor = palette.grid;
  d.maintainAspectRatio = false;
  d.interaction.mode = 'index';
  d.interaction.intersect = false;

  d.elements.bar.borderRadius = 0;
  d.elements.line.borderWidth = 2.5;
  d.scale.grid.drawTicks = false;
  d.scale.ticks.padding = 8;
  d.set('scale.border', { color: palette.ink, width: 2 });

  d.plugins.legend.align = 'start';
  d.plugins.legend.labels.color = palette.ink;
  d.plugins.legend.labels.boxWidth = 10;
  d.plugins.legend.labels.boxHeight = 10;
  d.plugins.legend.labels.padding = 14;

  d.plugins.tooltip.backgroundColor = palette.ink;
  d.plugins.tooltip.titleColor = palette.paper;
  d.plugins.tooltip.bodyColor = palette.paper;
  d.plugins.tooltip.footerColor = palette.paper;
  d.plugins.tooltip.padding = 10;
  d.plugins.tooltip.cornerRadius = 0;
  d.plugins.tooltip.boxPadding = 4;
}
