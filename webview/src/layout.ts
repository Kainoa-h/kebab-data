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
    <div class="max-w-7xl mx-auto p-4 md:p-8 space-y-8">
      <header class="text-center md:text-left mb-8">
        <h1 class="text-4xl font-bold mb-2">Kebab Tracker Dashboard</h1>
        <p class="text-gray-400">Store open/closed history, member growth, message activity, and contributor stats</p>
      </header>

      <section class="card overflow-x-auto">
        <h2 class="text-xl font-semibold mb-4">Store Status Calendar</h2>
        <div class="mb-4 flex items-center gap-4 text-sm">
          <div class="flex items-center gap-2"><span class="w-3 h-3 inline-block rounded-sm" style="background-color: var(--color-open)"></span> Open</div>
          <div class="flex items-center gap-2"><span class="w-3 h-3 inline-block rounded-sm" style="background-color: var(--color-closed)"></span> Closed</div>
          <div class="flex items-center gap-2"><span class="w-3 h-3 inline-block rounded-sm" style="background-color: var(--color-conflicted)"></span> Conflicted</div>
          <div class="flex items-center gap-2"><span class="w-3 h-3 inline-block rounded-sm" style="background-color: var(--color-unknown)"></span> Unknown</div>
        </div>
        <div id="cal-heatmap-container" class="min-w-[800px]"></div>
      </section>

      <section class="card lg:col-span-2">
        <div class="flex justify-between items-center mb-4">
          <h2 class="text-xl font-semibold">Activity Overview</h2>
          <div class="flex items-center gap-2">
            <button id="btn-overview-prev" class="bg-gray-800 hover:bg-gray-700 text-white text-sm rounded px-3 py-1 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed">&larr; Prev</button>
            <button id="btn-overview-next" class="bg-gray-800 hover:bg-gray-700 text-white text-sm rounded px-3 py-1 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed">Next &rarr;</button>
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
          <h2 class="text-xl font-semibold mb-4">Day of Week Patterns</h2>
          <canvas id="canvas-dow"></canvas>
        </section>

        <section class="card">
          <h2 class="text-xl font-semibold mb-4">Member Growth</h2>
          <canvas id="canvas-member-growth"></canvas>
        </section>

        <section class="card">
          <h2 class="text-xl font-semibold mb-4">Message Volume</h2>
          <canvas id="canvas-message-volume"></canvas>
        </section>

        <section class="card">
          <h2 class="text-xl font-semibold mb-4">Media Efficiency</h2>
          <canvas id="canvas-media-efficiency"></canvas>
        </section>

      </div>

      <section class="card">
        <div class="flex justify-between items-center mb-4">
          <h2 class="text-xl font-semibold">Contributor Rankings</h2>
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
                <th class="py-2 px-4">Rank</th>
                <th class="py-2 px-4">Alias</th>
                <th class="py-2 px-4">Open</th>
                <th class="py-2 px-4">Closed</th>
                <th class="py-2 px-4">Total</th>
                <th class="py-2 px-4">Reactions</th>
              </tr>
            </thead>
            <tbody id="tbody-contributors">
            </tbody>
          </table>
        </div>
      </section>

      <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <section class="card">
          <h2 class="text-xl font-semibold mb-4">Reaction Leaderboard</h2>
          <canvas id="canvas-reaction-leaderboard"></canvas>
        </section>

        <section class="card">
          <h2 class="text-xl font-semibold mb-4">Top Users by Reactions</h2>
          <canvas id="canvas-user-reactions"></canvas>
        </section>
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
    selectContributorSort: document.getElementById('select-contributor-sort') as HTMLSelectElement,
    tableBodyContributors: document.getElementById('tbody-contributors') as HTMLTableSectionElement,
  };
}
