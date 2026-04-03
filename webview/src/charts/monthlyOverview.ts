import { Chart } from 'chart.js/auto';
import type { CalendarData, MemberJoin, DayStatus } from '../types';
import { STATUS_COLORS, normalizeStatus } from '../types';

function getMonday(dateStr: string) {
  const d = new Date(dateStr);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(d.setDate(diff));
  return monday.toISOString().split('T')[0];
}

export function renderMonthlyOverview(
  canvas: HTMLCanvasElement,
  selectElement: HTMLSelectElement,
  btnPrev: HTMLButtonElement,
  btnNext: HTMLButtonElement,
  calendarData: CalendarData,
  memberJoins: MemberJoin[]
) {
  let chart: Chart | null = null;
  let currentPage = 0;

  // Pre-process member joins into a map for O(1) lookup
  const joinsMap = new Map<string, number>();
  for (const join of memberJoins) {
    joinsMap.set(join.date, join.count);
  }

  function updateChart() {
    const zoom = selectElement.value; // 'monthly', 'weekly'
    
    let pageSize = 12;
    if (zoom === 'weekly') pageSize = 24;

    const start = new Date('2025-04-01');
    const end = new Date('2026-04-30');
    
    // Ordered labels and aggregations
    const groupedData = new Map<string, {
      new_members: number;
      open_days: number;
      closed_days: number;
      unknown_days: number;
    }>();

    // Iterate through all dates in the range
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().split('T')[0];
      
      let groupKey = dateStr;
      if (zoom === 'monthly') {
        groupKey = dateStr.substring(0, 7); // YYYY-MM
      } else if (zoom === 'weekly') {
        groupKey = getMonday(dateStr);
      }

      if (!groupedData.has(groupKey)) {
        groupedData.set(groupKey, {
          new_members: 0, open_days: 0, closed_days: 0, unknown_days: 0
        });
      }

      const group = groupedData.get(groupKey)!;
      
      // Member joins
      group.new_members += joinsMap.get(dateStr) || 0;

      // Status
      let status: DayStatus = normalizeStatus(calendarData[dateStr]?.status || 'unknown');
      if (status === 'unknown' && d.getDay() === 0) {
        status = 'closed'; // Default Sunday
      }

      if (status === 'open') group.open_days++;
      else if (status === 'closed') group.closed_days++;
      else group.unknown_days++;
    }

    const today = new Date();
    const currentPeriod = zoom === 'monthly'
      ? today.toISOString().substring(0, 7)
      : getMonday(today.toISOString().split('T')[0]);

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
          { 
            type: 'line', 
            label: 'New Members', 
            data: pagedData.map(d => d.new_members), 
            borderColor: '#8b5cf6', 
            yAxisID: 'y1',
            tension: 0.1,
            pointRadius: 3,
            borderWidth: 2
          },
          { label: 'Open', data: pagedData.map(d => d.open_days), backgroundColor: STATUS_COLORS.open },
          { label: 'Closed', data: pagedData.map(d => d.closed_days), backgroundColor: STATUS_COLORS.closed },
          { label: 'Unknown', data: pagedData.map(d => d.unknown_days), backgroundColor: STATUS_COLORS.unknown },
        ]
      },
      options: {
        color: '#e5e7eb',
        maintainAspectRatio: false,
        scales: {
          x: { 
            stacked: true, 
            grid: { color: '#374151' }
          },
          y: { stacked: true, grid: { color: '#374151' } },
          y1: { position: 'right', grid: { drawOnChartArea: false } }
        },
        plugins: {
          tooltip: { backgroundColor: '#1f2937' },
          legend: { labels: { color: '#e5e7eb' } }
        }
      }
    });
  }

  // Initial render
  updateChart();

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
