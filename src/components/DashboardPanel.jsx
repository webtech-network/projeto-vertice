'use client';

import { useDashboardSummaryQuery, cacheStatus } from '@/lib/query/canvasQueries';
import DashboardStats from './DashboardStats';
import DueDateCalendar from './DueDateCalendar';
import RecentDeadlines from './RecentDeadlines';
import DashboardDoingTasks from './DashboardDoingTasks';
import DashboardShortcuts from './DashboardShortcuts';
import PendingGradingList from './PendingGradingList';

const EMPTY_SUMMARY = { courses: null, students: null, messages: null, grading: null, calendar: null, recent: null };

// Stale-while-revalidate via TanStack Query (ADR-0015): pinta na hora com o
// que veio do IndexedDB (marcado `stale`) e revalida em segundo plano quando
// passou da faixa `live`. Primeira visita (sem cache algum) mostra o estado de
// carregamento em vez de números vazios; erro só aparece se não há cache.
export default function DashboardPanel() {
  const query = useDashboardSummaryQuery();
  const { hasData, stale, initialLoading } = cacheStatus(query);
  const summary = query.data ?? EMPTY_SUMMARY;
  const error = query.error?.message;
  const showLoading = initialLoading;
  const hasCache = hasData;

  return (
    <div className="dashboard-panel">
      {error && !hasCache && (
        <p className="alert alert-error" role="alert">
          {error}
        </p>
      )}

      <DashboardStats
        courses={summary.courses}
        students={summary.students}
        messages={summary.messages}
        grading={summary.grading}
        loading={showLoading}
        stale={stale}
      />

      <div className="dashboard-grid">
        <DashboardDoingTasks />
        <DashboardShortcuts />
      </div>

      <div className="dashboard-grid">
        <DueDateCalendar items={summary.calendar?.items} loading={showLoading} />
        <RecentDeadlines items={summary.recent?.items} loading={showLoading} />
      </div>

      <PendingGradingList items={summary.grading?.items} loading={showLoading} />
    </div>
  );
}
