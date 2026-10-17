import { Chart } from 'chart.js/auto';
import type { CalendarData, DayStatus } from '../types';
import { normalizeStatus } from '../types';
import { toDateStrUTC8 } from '../utils';
import { palette, onThemeChange } from '../theme';

function getMonday(dateStr: string) {
  const d = new Date(dateStr);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(d.setDate(diff));
  return toDateStrUTC8(monday);
}

export function renderMonthlyOverview(
  canvas: HTMLCanvasElement,
  selectElement: HTMLSelectElement,
  btnPrev: HTMLButtonElement,
  btnNext: HTMLButtonElement,
  calendarData: CalendarData
) {
  let chart: Chart | null = null;
  let currentPage = 0;

  function updateChart() {
    const zoom = selectElement.value; // 'monthly', 'weekly'
    
    let pageSize = 12;
    if (zoom === 'weekly') pageSize = 24;

    const start = new Date('2025-04-01');
    const end = new Date('2026-04-30');
    
    // Ordered labels and aggregations
    const groupedData = new Map<string, {
      open_days: number;
      closed_days: number;
      unknown_days: number;
    }>();

    // Iterate through all dates in the range
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const dateStr = toDateStrUTC8(d);
      
      let groupKey = dateStr;
      if (zoom === 'monthly') {
        groupKey = dateStr.substring(0, 7); // YYYY-MM
      } else if (zoom === 'weekly') {
        groupKey = getMonday(dateStr);
      }

      if (!groupedData.has(groupKey)) {
        groupedData.set(groupKey, {
          open_days: 0, closed_days: 0, unknown_days: 0
        });
      }

      const group = groupedData.get(groupKey)!;

      // Skip Sundays from status counts
      if (d.getDay() === 0) continue;

      // Status
      const status: DayStatus = normalizeStatus(calendarData[dateStr]?.status || 'unknown');

      if (status === 'open') group.open_days++;
      else if (status === 'closed') group.closed_days++;
      else group.unknown_days++;
    }

    const today = new Date();
    const currentPeriod = zoom === 'monthly'
      ? toDateStrUTC8(today).substring(0, 7)
      : getMonday(toDateStrUTC8(today));

    const allLabels = Array.from(groupedData.keys()).sort().filter(l => l < currentPeriod);
    const totalPages = Math.ceil(allLabels.length / pageSize);
    
    // Ensure currentPage is valid
    if (currentPage < 0) currentPage = 0;
    if (currentPage >= totalPages) currentPage = totalPages - 1;

    // Slice data for current page using a sliding window
    let startIndex = currentPage * pageSize;
    // If we're on the last page, slide the window back so we don't have empty space
    if (startIndex + pageSize > allLabels.length) {
      startIndex = Math.max(0, allLabels.length - pageSize);
    }
    const endIndex = startIndex + pageSize;
    const pagedLabels = allLabels.slice(startIndex, endIndex);
    const pagedData = pagedLabels.map(l => groupedData.get(l)!);

    // Update button states
    btnPrev.disabled = currentPage === 0;
    btnNext.disabled = currentPage >= totalPages - 1;

    if (chart) {
      chart.destroy();
    }

    chart = new Chart(canvas, {
      type: 'bar',
      data: {
        labels: pagedLabels,
        datasets: [
          { label: 'Open', data: pagedData.map(d => d.open_days), backgroundColor: palette.open },
          { label: 'Closed', data: pagedData.map(d => d.closed_days), backgroundColor: palette.closed },
          { label: 'Unknown', data: pagedData.map(d => d.unknown_days), backgroundColor: palette.unknown },
        ]
      },
      options: {
        scales: {
          x: { stacked: true },
          y: { stacked: true, title: { display: true, text: 'Weekdays' } }
        }
      }
    });
  }

  // Initial render
  updateChart();
  onThemeChange(updateChart);

  // Listen to select change
  selectElement.addEventListener('change', () => {
    currentPage = 0; // Reset to page 0 on zoom change
    updateChart();
  });

  btnPrev.addEventListener('click', () => {
    currentPage--;
    updateChart();
  });

  btnNext.addEventListener('click', () => {
    currentPage++;
    updateChart();
  });
}
