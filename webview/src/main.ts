import './style.css';
import { buildLayout } from './layout';
import { fetchAllData } from './data';
import { renderCalendarHeatmap } from './calendar';
import { renderDowPatterns } from './charts/dowPatterns';
import { renderMemberGrowth } from './charts/memberGrowth';
import { renderMonthlyOverview } from './charts/monthlyOverview';
import { renderMessageVolume } from './charts/messageVolume';
import { renderMediaEfficiency } from './charts/mediaEfficiency';
import { renderReactionLeaderboard } from './charts/reactionLeaderboard';
import { renderUserReactions } from './charts/userReactions';
import { renderContributorTable } from './table';

async function init() {
  const refs = buildLayout();
  
  try {
    const data = await fetchAllData();
    
    renderCalendarHeatmap('#cal-heatmap-container', data.calendar);
    renderDowPatterns(refs.canvasDow, data.dowPatterns);
    renderMemberGrowth(refs.canvasMemberGrowth, data.memberGrowth);
    renderMonthlyOverview(
      refs.canvasMonthlyOverview,
      refs.selectOverviewZoom,
      refs.btnOverviewPrev,
      refs.btnOverviewNext,
      data.calendar,
      data.memberJoins
    );
    renderMessageVolume(refs.canvasMessageVolume, data.messageVolume);
    renderMediaEfficiency(refs.canvasMediaEfficiency, data.mediaBreakdown);
    renderReactionLeaderboard(refs.canvasReactionLeaderboard, data.reactionStats);
    renderUserReactions(refs.canvasUserReactions, data.users);
    renderContributorTable(refs.tableBodyContributors, refs.selectContributorSort, data.users);
  } catch (err) {
    console.error('Failed to initialize dashboard:', err);
    document.getElementById('app')!.innerHTML = `
      <div class="p-8 text-red-500">
        <h1 class="text-2xl font-bold mb-4">Error loading dashboard data</h1>
        <p>${err instanceof Error ? err.message : String(err)}</p>
      </div>
    `;
  }
}

init();
