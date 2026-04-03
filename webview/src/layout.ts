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
  selectContributorSort: HTMLSelectElement;
  tableBodyContributors: HTMLTableSectionElement;
}

export function buildLayout(): LayoutRefs {
  const app = document.getElementById('app')!;

  app.innerHTML = `
    <div class="kebab-stripe h-1.5 w-full fixed top-0 left-0 z-50"></div>

    <div class="max-w-7xl mx-auto px-4 pt-8 pb-12 md:px-8 space-y-8">
      <header class="text-center mb-8 pt-2">
        <div class="text-5xl mb-3">🥙</div>
        <h1 class="text-4xl md:text-5xl font-extrabold mb-3 tracking-tight">
          <span class="text-orange-400">Kebab</span>
          <span class="text-gray-100"> Tracker</span>
          <span class="text-yellow-400"> Dashboard</span>
        </h1>
        <p class="text-gray-400 text-lg">Is it open? Was it open? Will it ever be open again? Only one way to find out. 🔪</p>
        <div class="mt-4 flex justify-center gap-2 text-2xl select-none">
          <span>🌯</span><span>🧅</span><span>🔥</span><span>🧅</span><span>🌯</span>
        </div>
      </header>

      <section class="card">
        <h2 class="text-xl font-semibold mb-4">🗓️ Store Status Calendar</h2>
        <div class="mb-4 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
          <div class="flex items-center gap-2"><span class="w-3 h-3 inline-block rounded-sm" style="background-color: var(--color-open)"></span> Open</div>
          <div class="flex items-center gap-2"><span class="w-3 h-3 inline-block rounded-sm" style="background-color: var(--color-closed)"></span> Closed</div>
          <div class="flex items-center gap-2"><span class="w-3 h-3 inline-block rounded-sm" style="background-color: var(--color-conflicted)"></span> Conflicted</div>
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
        <div class="w-full h-[400px]">
          <canvas id="canvas-monthly-overview"></canvas>
        </div>
      </section>

      <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
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
          <h2 class="text-xl font-semibold mb-4">🖼️ Media Efficiency</h2>
          <canvas id="canvas-media-efficiency"></canvas>
        </section>

      </div>

      <section class="card">
        <div class="flex flex-wrap justify-between items-center gap-3 mb-4">
          <h2 class="text-xl font-semibold">🏆 Contributor Rankings</h2>
          <select id="select-contributor-sort" class="bg-gray-800 border border-gray-700 text-white text-sm rounded px-2 py-1 outline-none">
            <option value="total" selected>Sort by: Total</option>
            <option value="open">Sort by: Open</option>
            <option value="closed">Sort by: Closed</option>
            <option value="reactions">Sort by: Reactions</option>
          </select>
        </div>
        <div class="overflow-x-auto max-h-[800px] overflow-y-auto relative">
          <table class="w-full text-left border-collapse whitespace-nowrap">
            <thead class="sticky top-0 bg-gray-900 z-10 shadow-[0_1px_0_0_#374151]">
              <tr class="border-b border-gray-700">
                <th class="py-2 px-4 text-orange-400/80">Rank</th>
                <th class="py-2 px-4 text-orange-400/80">Alias</th>
                <th class="py-2 px-4 text-orange-400/80">Open</th>
                <th class="py-2 px-4 text-orange-400/80">Closed</th>
                <th class="py-2 px-4 text-orange-400/80">Total</th>
                <th class="py-2 px-4 text-orange-400/80">Reactions</th>
              </tr>
            </thead>
            <tbody id="tbody-contributors">
            </tbody>
          </table>
        </div>
      </section>

      <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <section class="card">
          <h2 class="text-xl font-semibold mb-4">😂 Reaction Leaderboard</h2>
          <canvas id="canvas-reaction-leaderboard"></canvas>
        </section>

        <section class="card">
          <h2 class="text-xl font-semibold mb-4">⭐ Top Users by Reactions</h2>
          <canvas id="canvas-user-reactions"></canvas>
        </section>
      </div>

      <footer class="text-center text-gray-600 text-sm pt-4">
        🥙 powered by kebab energy &amp; questionable data quality 🥙
      </footer>
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
    selectContributorSort: document.getElementById('select-contributor-sort') as HTMLSelectElement,
    tableBodyContributors: document.getElementById('tbody-contributors') as HTMLTableSectionElement,
  };
}
