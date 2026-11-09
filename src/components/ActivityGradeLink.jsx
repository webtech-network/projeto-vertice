'use client';

import { useRouter } from 'next/navigation';
import { ExternalLink } from 'lucide-react';

// Shared by PendingGradingList.jsx and RecentDeadlines.jsx — both render a
// list of assignment items where the row itself should open the grading
// page inside Vértice, while a small icon right after the title opens
// the same activity in Canvas LMS. `trailing` is whatever badge each caller
// puts on the right (PendingGradingList's pending count, RecentDeadlines'
// SpeedGrader icon + overdue/upcoming date tag).
//
// `showCanvasLink` (default true) toggles the inline title icon above.
// RecentDeadlines passes false — its own trailing SpeedGrader icon is
// already a link to Canvas, so keeping this one too would put two Canvas
// links on the same row.
//
// The row is a plain <li> (not a <Link>) driving navigation via
// router.push(), not an anchor — an <a> can't be nested inside another <a>
// per the HTML spec, and the Canvas LMS icon has to be a real, separately
// clickable <a target="_blank"> of its own. role="link" + tabIndex/onKeyDown
// keep it keyboard- and screen-reader-reachable despite not being a native
// anchor.
export default function ActivityGradeLink({ item, trailing, showCanvasLink = true }) {
  const router = useRouter();
  const gradeUrl = `/courses/${item.courseId}/assignments/${item.id}/grade`;

  const goToGrade = () => router.push(gradeUrl);

  return (
    <li
      className="card-link"
      role="link"
      tabIndex={0}
      onClick={goToGrade}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          goToGrade();
        }
      }}
    >
      <span className="card-link-text">
        <span className="card-meta">{item.courseName}</span>
        <span className="card-title">
          {item.name}
          {showCanvasLink && (
            <a
              href={item.htmlUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="card-title-external-link"
              title="Abrir atividade no Canvas LMS"
              aria-label="Abrir atividade no Canvas LMS"
              onClick={(e) => e.stopPropagation()}
            >
              <ExternalLink size={13} strokeWidth={1.8} />
            </a>
          )}
        </span>
      </span>
      {trailing}
    </li>
  );
}
