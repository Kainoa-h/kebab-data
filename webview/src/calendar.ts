// @ts-ignore
import CalHeatmap from 'cal-heatmap';
// @ts-ignore
import Tooltip from 'cal-heatmap/plugins/Tooltip';
import 'cal-heatmap/cal-heatmap.css';
import type { CalendarData, DayStatus } from './types';
import { STATUS_COLORS } from './types';

export function renderCalendarHeatmap(containerSelector: string, calendarData: CalendarData) {
  const start = new Date('2025-04-01');
  const end = new Date('2026-04-30');
  
  const data: Array<{
    date: string;
    value: number;
    status: DayStatus;
    contributors: string[];
    isDefaultSunday?: boolean;
  }> = [];

  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const dateStr = d.toISOString().split('T')[0];
    const record = calendarData[dateStr];
    
    let status: DayStatus = record?.status || 'unknown';
    let isDefaultSunday = false;
    
    if (status === 'unknown' && d.getDay() === 0) {
      status = 'closed';
      isDefaultSunday = true;
    }

    let value = 0;
    if (status === 'open') value = 1;
    else if (status === 'closed') value = 2;
    else if (status === 'conflicted') value = 3;

    data.push({
      date: dateStr,
      value,
      status,
      contributors: record?.contributors || [],
      isDefaultSunday
    });
  }

  const dataMap = new Map(data.map(d => [d.date, d]));

  const cal = new CalHeatmap();
  cal.paint({
    itemSelector: containerSelector,
    domain: { type: 'month' },
    subDomain: { type: 'day', width: 14, height: 14, radius: 2 },
    range: 13,
    date: { start: new Date('2025-04-01') },
    data: {
      source: data,
      x: 'date',
      y: 'value'
    },
    scale: {
      color: {
        type: 'ordinal',
        domain: [0, 1, 2, 3],
        range: [STATUS_COLORS.unknown, STATUS_COLORS.open, STATUS_COLORS.closed, STATUS_COLORS.conflicted]
      }
    }
  }, [
    [
      Tooltip,
      {
        text: function (_timestamp: number, _value: number, dayjsDate: any) {
          const dateStr = dayjsDate.format('YYYY-MM-DD');
          const record = dataMap.get(dateStr);
          
          if (!record) {
            return `${dateStr}: Unknown`;
          }

          let label = record.status.charAt(0).toUpperCase() + record.status.slice(1);
          if (record.isDefaultSunday) {
            label += ' (Default)';
          } else if (record.contributors && record.contributors.length > 0) {
            label += ` - Reported by: ${record.contributors.join(', ')}`;
          }

          return `${dateStr}: ${label}`;
        }
      }
    ]
  ]);
}
