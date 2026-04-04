export interface LayoutRefs {
  calendarContainer: HTMLDivElement;
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

export function buildLayout(): LayoutRefs {
  const app = document.getElementById('app')!;

  app.innerHTML = `
    <div class="kebab-stripe h-1.5 w-full fixed top-0 left-0 z-50"></div>

    <div class="max-w-7xl mx-auto px-3 pt-8 pb-12 md:px-8 space-y-4 md:space-y-8">
      <header class="text-center mb-4 md:mb-8 pt-2">
        <div class="text-4xl md:text-5xl mb-2 md:mb-3">🥙</div>
        <h1 class="text-3xl md:text-5xl font-extrabold mb-2 md:mb-3 tracking-tight">
          <span class="text-orange-400">Kebab</span>
          <span class="text-gray-100"> Tracker</span>
          <span class="text-yellow-400"> Dashboard</span>
        </h1>
        <p class="text-gray-400 text-base md:text-lg">Is it open? Was it open? Will it ever be open again? Only one way to find out. 🔪</p>
        <div class="mt-3 flex justify-center gap-2 text-xl md:text-2xl select-none">
          <span>🌯</span><span>🧅</span><span>🔥</span><span>🧅</span><span>🌯</span>
        </div>
      </header>

      <section class="card">
        <h2 class="text-xl font-semibold mb-4">🗓️ Store Status Calendar</h2>
        <div class="mb-4 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
          <div class="flex items-center gap-2"><span class="w-3 h-3 inline-block rounded-sm" style="background-color: var(--color-open)"></span> Open</div>
          <div class="flex items-center gap-2"><span class="w-3 h-3 inline-block rounded-sm" style="background-color: var(--color-closed)"></span> Closed</div>
          <div class="flex items-center gap-2"><span class="w-3 h-3 inline-block rounded-sm" style="background-color: var(--color-unknown)"></span> Unknown (no reports)</div>
          <div class="flex items-center gap-2"><span class="w-3 h-3 inline-block rounded-sm border border-gray-600" style="background-color: var(--color-no-data)"></span> Future / no data</div>
        </div>
        <div class="overflow-x-auto">
          <div id="cal-heatmap-container" class="flex justify-center"></div>
        </div>
      </section>

      <section class="card">
        <div class="flex flex-wrap justify-between items-center gap-3 mb-4">
          <h2 class="text-xl font-semibold">📊 Activity Overview</h2>
          <div class="flex items-center gap-2 flex-wrap">
            <button id="btn-overview-prev" class="bg-gray-800 hover:bg-orange-900/40 hover:border-orange-600 border border-gray-700 text-white text-sm rounded px-3 py-1 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed transition-colors">&larr; Prev</button>
            <button id="btn-overview-next" class="bg-gray-800 hover:bg-orange-900/40 hover:border-orange-600 border border-gray-700 text-white text-sm rounded px-3 py-1 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed transition-colors">Next &rarr;</button>
            <select id="select-overview-zoom" class="bg-gray-800 border border-gray-700 text-white text-sm rounded px-2 py-1 outline-none ml-2">
              <option value="monthly">Monthly</option>
              <option value="weekly">Weekly</option>
            </select>
          </div>
        </div>
        <div class="w-full h-[280px] md:h-[400px]">
          <canvas id="canvas-monthly-overview"></canvas>
        </div>
      </section>

      <section class="card">
        <h2 class="text-xl font-semibold mb-4">🔥 Kebab Streaks</h2>
        <div id="streak-stats"></div>
      </section>

      <div class="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-8">
        <section class="card">
          <h2 class="text-xl font-semibold mb-4">📅 Day of Week Patterns</h2>
          <canvas id="canvas-dow"></canvas>
        </section>

        <section class="card">
          <h2 class="text-xl font-semibold mb-4">📈 Member Growth</h2>
          <canvas id="canvas-member-growth"></canvas>
        </section>

        <section class="card">
          <h2 class="text-xl font-semibold mb-4">💬 Message Volume</h2>
          <canvas id="canvas-message-volume"></canvas>
        </section>

        <section class="card">
          <h2 class="text-xl font-semibold mb-4">🧑‍🤝‍🧑 New Members per Month</h2>
          <canvas id="canvas-new-members"></canvas>
        </section>

      </div>

      <section class="card">
        <div class="flex flex-wrap justify-between items-center gap-3 mb-4">
          <h2 class="text-xl font-semibold">🏆 Contributor Rankings</h2>
          <div class="flex items-center gap-2 flex-wrap">
            <div class="flex items-center gap-1">
              <button id="btn-contributor-month-prev" class="bg-gray-800 hover:bg-orange-900/40 hover:border-orange-600 border border-gray-700 text-white text-sm rounded px-3 py-1 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed transition-colors">&larr;</button>
              <select id="select-contributor-month" class="bg-gray-800 border border-gray-700 text-white text-sm rounded px-2 py-1 outline-none">
                <option value="all">All time</option>
                <option value="2025-04">April 2025</option>
                <option value="2025-05">May 2025</option>
                <option value="2025-06">June 2025</option>
                <option value="2025-07">July 2025</option>
                <option value="2025-08">August 2025</option>
                <option value="2025-09">September 2025</option>
                <option value="2025-10">October 2025</option>
                <option value="2025-11">November 2025</option>
                <option value="2025-12">December 2025</option>
                <option value="2026-01">January 2026</option>
                <option value="2026-02">February 2026</option>
                <option value="2026-03">March 2026</option>
                <option value="2026-04">April 2026</option>
              </select>
              <button id="btn-contributor-month-next" class="bg-gray-800 hover:bg-orange-900/40 hover:border-orange-600 border border-gray-700 text-white text-sm rounded px-3 py-1 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed transition-colors">&#8250;</button>
            </div>
            <select id="select-contributor-sort" class="bg-gray-800 border border-gray-700 text-white text-sm rounded px-2 py-1 outline-none">
              <option value="total" selected>Sort by: Total</option>
              <option value="open">Sort by: Open</option>
              <option value="closed">Sort by: Closed</option>
              <option value="reactions">Sort by: Reactions</option>
            </select>
          </div>
        </div>
        <div class="overflow-x-auto max-h-[800px] overflow-y-auto relative">
          <table class="w-full text-left border-collapse text-sm">
            <thead class="sticky top-0 bg-gray-900 z-10 shadow-[0_1px_0_0_#374151]">
              <tr class="border-b border-gray-700">
                <th class="py-2 px-2 md:px-4 text-orange-400/80 font-semibold">#</th>
                <th class="py-2 px-2 md:px-4 text-orange-400/80 font-semibold">Alias</th>
                <th class="py-2 px-2 md:px-4 text-orange-400/80 font-semibold">Open</th>
                <th class="py-2 px-2 md:px-4 text-orange-400/80 font-semibold">Closed</th>
                <th class="py-2 px-2 md:px-4 text-orange-400/80 font-semibold">Total</th>
                <th class="py-2 px-2 md:px-4 text-orange-400/80 font-semibold">React.</th>
              </tr>
            </thead>
            <tbody id="tbody-contributors">
            </tbody>
          </table>
        </div>
      </section>

      <div class="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-8">
        <section class="card">
          <h2 class="text-xl font-semibold mb-4">😂 Reaction Leaderboard</h2>
          <canvas id="canvas-reaction-leaderboard"></canvas>
        </section>

        <section class="card">
          <h2 class="text-xl font-semibold mb-4">⭐ Top Users by Reactions</h2>
          <canvas id="canvas-user-reactions"></canvas>
        </section>

        <section class="card">
          <h2 class="text-xl font-semibold mb-4">🖼️ Media Efficiency</h2>
          <canvas id="canvas-media-efficiency"></canvas>
        </section>
      </div>

      <footer class="text-center text-gray-600 text-sm pt-4">
        🥙 powered by kebab energy &amp; questionable data quality 🥙
      </footer>
    </div>

    <button id="btn-deanon"
      class="fixed top-3 right-4 z-[60] w-7 h-7 rounded-full bg-gray-800/60 hover:bg-gray-700 border border-gray-700/50 text-gray-500 hover:text-gray-200 text-xs flex items-center justify-center transition-all backdrop-blur-sm cursor-pointer"
      title="De-anonymise aliases">?</button>

    <div id="modal-deanon"
      class="hidden fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div class="bg-gray-900 border border-gray-700 rounded-xl p-6 max-w-sm w-full mx-4 shadow-2xl">
        <h3 class="text-lg font-semibold mb-1">De-anonymise Aliases</h3>
        <p class="text-gray-400 text-sm mb-4">Upload your <code class="text-orange-400 text-xs">anon_map.json</code> to reveal real usernames throughout the dashboard.</p>
        <input type="file" id="input-deanon" accept=".json"
          class="block w-full text-sm text-gray-400 file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-sm file:bg-gray-800 file:text-gray-300 hover:file:bg-gray-700 cursor-pointer mb-3">
        <div id="deanon-status" class="text-xs text-gray-500 min-h-[1.25rem] mb-4"></div>
        <div class="flex justify-end">
          <button id="btn-deanon-close" class="text-sm text-gray-500 hover:text-gray-200 transition-colors">Close</button>
        </div>
      </div>
    </div>
  `;

  return {
    calendarContainer: document.getElementById('cal-heatmap-container') as HTMLDivElement,
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
