export interface LayoutRefs {
  calendarContainer: HTMLDivElement;
  dataThroughEl: HTMLSpanElement;
  btnTheme: HTMLButtonElement;
  canvasDow: HTMLCanvasElement;
  canvasMemberGrowth: HTMLCanvasElement;
  canvasMonthlyOverview: HTMLCanvasElement;
  selectOverviewZoom: HTMLSelectElement;
  btnOverviewPrev: HTMLButtonElement;
  btnOverviewNext: HTMLButtonElement;
  canvasMessageVolume: HTMLCanvasElement;
  canvasMediaEfficiency: HTMLCanvasElement;
  canvasReactionLeaderboard: HTMLCanvasElement;
  canvasUserReactions: HTMLCanvasElement;
  streakStatsEl: HTMLDivElement;
  canvasNewMembers: HTMLCanvasElement;
  selectContributorSort: HTMLSelectElement;
  selectContributorMonth: HTMLSelectElement;
  btnContributorMonthPrev: HTMLButtonElement;
  btnContributorMonthNext: HTMLButtonElement;
  tableBodyContributors: HTMLTableSectionElement;
}

const FIRST_MONTH = '2025-04';
const LAST_MONTH = '2026-04';

function monthOptions(): string {
  const options = ['<option value="all">All time</option>'];
  for (let d = new Date(`${FIRST_MONTH}-01T00:00:00Z`); d.toISOString() < `${LAST_MONTH}-02`; d.setUTCMonth(d.getUTCMonth() + 1)) {
    const value = d.toISOString().slice(0, 7);
    const label = d.toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' });
    options.push(`<option value="${value}">${label}</option>`);
  }
  return options.join('');
}

function sectionHead(num: string, title: string, caption: string): string {
  return `
    <div class="min-w-0 flex-1 basis-72">
      <h2 class="section-head"><span class="section-num">${num}</span>${title}</h2>
      <p class="section-caption">${caption}</p>
    </div>
  `;
}

function chartSection(num: string, title: string, caption: string, canvasId: string, height = 'h-64 md:h-72'): string {
  return `
    <section>
      ${sectionHead(num, title, caption)}
      <div class="relative mt-5 ${height}"><canvas id="${canvasId}"></canvas></div>
    </section>
  `;
}

function legendItem(label: string, style: string): string {
  return `<span class="flex items-center gap-2"><span class="legend-swatch" style="${style}"></span>${label}</span>`;
}

export function buildLayout(): LayoutRefs {
  const app = document.getElementById('app')!;

  app.innerHTML = `
    <div class="max-w-6xl mx-auto px-4 md:px-8 pt-6 pb-16">
      <header class="flex flex-wrap items-end justify-between gap-x-6 gap-y-2 border-b-[3px] border-ink pb-3">
        <h1 class="font-display uppercase text-4xl md:text-5xl leading-none tracking-wide">
          <span aria-hidden="true">🥙</span> Kebab Tracker
        </h1>
        <div class="flex items-center gap-3">
          <p class="text-xs uppercase tracking-wider text-ink-soft">
            Data through <span id="data-through" class="font-bold text-ink">…</span>
          </p>
          <button id="btn-theme" class="btn btn-icon"></button>
        </div>
      </header>
      <p class="mt-3 text-sm text-ink-soft">Is it open? Was it open? Will it ever be open again?</p>

      <div id="streak-stats" class="mt-8 md:mt-10"></div>

      <div class="mt-16 md:mt-20 space-y-16 md:space-y-20">
        <section>
          ${sectionHead('01', 'The calendar', 'Every day since April 2025. Hover a square to see who reported it.')}
          <div class="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-xs uppercase tracking-wider text-ink-soft">
            ${legendItem('Open', 'background: var(--color-open)')}
            ${legendItem('Closed', 'background: var(--color-closed)')}
            ${legendItem('No reports', 'background: var(--color-unknown)')}
            ${legendItem('Sunday off', 'background: repeating-linear-gradient(45deg, var(--color-paper-deep) 0 2px, var(--color-ink-faint) 2px 3px)')}
          </div>
          <div id="cal-scroll" class="mt-5 overflow-x-auto pb-3">
            <div id="cal-heatmap-container" class="w-max mx-auto"></div>
          </div>
        </section>

        <section>
          <div class="flex flex-wrap items-end gap-x-6 gap-y-4">
            ${sectionHead('02', 'Open, closed, or nobody checked', 'Weekdays per period by reported status. Grey means nobody checked.')}
            <div class="flex flex-wrap items-center gap-2">
              <div class="btn-group">
                <button id="btn-overview-prev" class="btn" aria-label="Earlier period">‹ Earlier</button>
                <button id="btn-overview-next" class="btn" aria-label="Later period">Later ›</button>
              </div>
              <select id="select-overview-zoom" class="control" aria-label="Group by">
                <option value="monthly">Monthly</option>
                <option value="weekly">Weekly</option>
              </select>
            </div>
          </div>
          <div class="relative mt-5 h-[300px] md:h-[420px]">
            <canvas id="canvas-monthly-overview"></canvas>
          </div>
        </section>

        <div class="grid grid-cols-1 lg:grid-cols-2 gap-16 lg:gap-x-12 lg:gap-y-20">
          ${chartSection('03', 'Best day to go', 'Of the days someone checked, how often each weekday was open. n is the number of reported days. Sundays are always off.', 'canvas-dow')}
          ${chartSection('04', 'The congregation', 'Total group members over time.', 'canvas-member-growth')}
          ${chartSection('05', 'Signal vs yap', 'Share of messages each month that actually reported a status. The rest is yap. Hover for counts.', 'canvas-message-volume')}
          ${chartSection('06', 'New cultists', 'People who joined each month.', 'canvas-new-members')}
        </div>

        <section>
          <div class="flex flex-wrap items-end gap-x-6 gap-y-4">
            ${sectionHead('07', 'Hall of fame', 'Who reports the status most. Hover a name for their join date.')}
            <div class="flex flex-wrap items-center gap-2">
              <div class="btn-group">
                <button id="btn-contributor-month-prev" class="btn btn-icon" aria-label="Previous month">‹</button>
                <select id="select-contributor-month" class="control border-l-0" aria-label="Month">${monthOptions()}</select>
                <button id="btn-contributor-month-next" class="btn btn-icon" aria-label="Next month">›</button>
              </div>
              <select id="select-contributor-sort" class="control" aria-label="Sort by">
                <option value="total" selected>Sort: Total</option>
                <option value="open">Sort: Open</option>
                <option value="closed">Sort: Closed</option>
                <option value="reactions">Sort: Reactions</option>
              </select>
            </div>
          </div>
          <div class="mt-5 overflow-auto max-h-[520px] border-y-[3px] border-ink">
            <table class="w-full text-left border-collapse text-sm">
              <thead class="sticky top-0 bg-paper z-10 text-[11px] uppercase tracking-wider text-ink-soft">
                <tr class="border-b-2 border-ink">
                  <th class="py-2 px-1.5 md:px-3 font-bold w-8 md:w-12">No.</th>
                  <th class="py-2 px-1.5 md:px-3 font-bold">Alias</th>
                  <th class="py-2 px-1.5 md:px-3 font-bold text-right">Total</th>
                  <th class="py-2 px-1.5 md:px-3 font-bold text-right">Open</th>
                  <th class="py-2 px-1.5 md:px-3 font-bold text-right">Closed</th>
                  <th class="py-2 px-1.5 md:px-3 font-bold text-right"><span class="sm:hidden">♥</span><span class="hidden sm:inline">Reactions</span></th>
                </tr>
              </thead>
              <tbody id="tbody-contributors"></tbody>
            </table>
          </div>
        </section>

        <div class="grid grid-cols-1 lg:grid-cols-2 gap-16 lg:gap-x-12 lg:gap-y-20">
          ${chartSection('08', 'Reaction menu', 'The 15 most used reactions.', 'canvas-reaction-leaderboard')}
          ${chartSection('09', 'Crowd favourites', 'The 15 members who received the most reactions.', 'canvas-user-reactions', 'h-96')}
          ${chartSection('10', 'Media efficiency', 'Share of each message type that reported a status. n is how many were sent.', 'canvas-media-efficiency')}
        </div>
      </div>

      <footer class="mt-20 border-t-2 border-dashed border-ink-faint pt-4 flex flex-wrap justify-between gap-2 text-xs uppercase tracking-wider text-ink-soft">
        <span>Powered by kebab energy</span>
        <span>&amp; questionable data quality</span>
      </footer>
    </div>

    <button id="btn-deanon"
      class="fixed bottom-4 right-4 z-[60] w-10 h-10 bg-paper border-2 border-ink text-ink font-bold flex items-center justify-center cursor-pointer hover:bg-ink hover:text-paper transition-colors shadow-[3px_3px_0_var(--color-ink)]"
      title="Reveal real names" aria-label="Reveal real names">?</button>

    <div id="modal-deanon" role="dialog" aria-modal="true" aria-labelledby="deanon-title"
      class="hidden fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4">
      <div class="bg-paper border-[3px] border-ink p-6 max-w-sm w-full shadow-[8px_8px_0_var(--color-tag)]">
        <h3 id="deanon-title" class="font-display uppercase text-2xl tracking-wide mb-2">Reveal real names</h3>
        <p class="text-ink-soft text-sm mb-4">Upload your <code class="bg-tag text-on-tag px-1 font-bold">anon_map.json</code> to swap aliases for real usernames. The file never leaves your browser.</p>
        <input type="file" id="input-deanon" accept=".json"
          class="block w-full text-xs text-ink-soft file:mr-3 file:py-2 file:px-3 file:border-2 file:border-ink file:bg-paper file:text-ink file:font-bold file:uppercase file:text-xs hover:file:bg-ink hover:file:text-paper cursor-pointer mb-3">
        <div id="deanon-status" class="text-xs text-ink-soft min-h-[1.25rem] mb-4"></div>
        <div class="flex justify-end">
          <button id="btn-deanon-close" class="btn">Close</button>
        </div>
      </div>
    </div>
  `;

  return {
    calendarContainer: document.getElementById('cal-heatmap-container') as HTMLDivElement,
    dataThroughEl: document.getElementById('data-through') as HTMLSpanElement,
    btnTheme: document.getElementById('btn-theme') as HTMLButtonElement,
    canvasDow: document.getElementById('canvas-dow') as HTMLCanvasElement,
    canvasMemberGrowth: document.getElementById('canvas-member-growth') as HTMLCanvasElement,
    canvasMonthlyOverview: document.getElementById('canvas-monthly-overview') as HTMLCanvasElement,
    selectOverviewZoom: document.getElementById('select-overview-zoom') as HTMLSelectElement,
    btnOverviewPrev: document.getElementById('btn-overview-prev') as HTMLButtonElement,
    btnOverviewNext: document.getElementById('btn-overview-next') as HTMLButtonElement,
    canvasMessageVolume: document.getElementById('canvas-message-volume') as HTMLCanvasElement,
    canvasMediaEfficiency: document.getElementById('canvas-media-efficiency') as HTMLCanvasElement,
    canvasReactionLeaderboard: document.getElementById('canvas-reaction-leaderboard') as HTMLCanvasElement,
    canvasUserReactions: document.getElementById('canvas-user-reactions') as HTMLCanvasElement,
    streakStatsEl: document.getElementById('streak-stats') as HTMLDivElement,
    canvasNewMembers: document.getElementById('canvas-new-members') as HTMLCanvasElement,
    selectContributorSort: document.getElementById('select-contributor-sort') as HTMLSelectElement,
    selectContributorMonth: document.getElementById('select-contributor-month') as HTMLSelectElement,
    btnContributorMonthPrev: document.getElementById('btn-contributor-month-prev') as HTMLButtonElement,
    btnContributorMonthNext: document.getElementById('btn-contributor-month-next') as HTMLButtonElement,
    tableBodyContributors: document.getElementById('tbody-contributors') as HTMLTableSectionElement,
  };
}
