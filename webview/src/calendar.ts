// @ts-ignore
import CalHeatmap from 'cal-heatmap';
// @ts-ignore
import Tooltip from 'cal-heatmap/plugins/Tooltip';
import 'cal-heatmap/cal-heatmap.css';
import type { CalendarData, DayStatus } from './types';
import { STATUS_COLORS, normalizeStatus } from './types';
import { toDateStrUTC8 } from './utils';
import { deAnon } from './deanon';

const COLOR_NO_DATA = '#1e293b';

export function renderCalendarHeatmap(containerSelector: string, calendarData: CalendarData) {
  const start = new Date('2025-04-01');
  const end = new Date('2026-04-30');
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const data: Array<{
    date: string;
    value: number;
    status: DayStatus;
    contributors: string[];
    isDefaultSunday?: boolean;
    isOutOfRange?: boolean;
  }> = [];

  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const dateStr = toDateStrUTC8(d);
    const record = calendarData[dateStr];
    const isFuture = d > today;

    let status: DayStatus = normalizeStatus(record?.status || 'unknown');
    let isDefaultSunday = false;

    if (status === 'unknown' && d.getDay() === 0) {
      status = 'closed';
      isDefaultSunday = true;
    }

    // value: 0=unknown(no reports), 1=open, 2=closed, 3=out of range
    let value: number;
    if (isFuture) {
      value = 3;
    } else if (status === 'open') {
      value = 1;
    } else if (status === 'closed') {
      value = 2;
    } else {
      value = 0;
    }

    data.push({
      date: dateStr,
      value,
      status,
      contributors: record?.contributors || [],
      isDefaultSunday,
      isOutOfRange: isFuture
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
        range: [
          STATUS_COLORS.unknown, // 0 = unknown (no reports)
          STATUS_COLORS.open,    // 1 = open
          STATUS_COLORS.closed,  // 2 = closed
          COLOR_NO_DATA          // 3 = future / outside data range
        ]
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

          if (record.isOutOfRange) {
            return `${dateStr}: Future / no data`;
          }

          let label = record.status.charAt(0).toUpperCase() + record.status.slice(1);
          if (record.isDefaultSunday) {
            label += ' (Default — always closed on Sundays)';
          } else if (record.contributors && record.contributors.length > 0) {
            label += ` — reported by: ${record.contributors.map(c => deAnon(c)).join(', ')}`;
          } else if (record.status === 'unknown') {
            label += ' (no reports)';
          }

          return `${dateStr}: ${label}`;
        }
      }
    ]
  ]);
}
