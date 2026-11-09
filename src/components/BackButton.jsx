'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';

// "Voltar" for drill-down pages — installed as a PWA (display: standalone)
// the app has no browser back button, and the gesture/shortcut alternatives
// are little known. See specs/platform/routing-and-shell.md ("Navegação de
// retorno").
//
// Rendered as a real <Link href={fallbackHref}> so it works without JS and
// middle-click/open-in-new-tab land somewhere sensible. On a plain click:
//
// - `backTo` (list of pathnames) given: walk the session history backwards
//   (Navigation API — same-origin entries only, so it never leaves the app)
//   for the nearest entry whose pathname is one of them and traverse there.
//   That's how correção/pares/importação return to the course list or page
//   the user came from, which then restores itself as it was (expanded
//   course + tab — courseBrowserState.js / CourseWorkspaceTabs' `?tab=`).
//   The search stops at the first entry outside `withinPrefix` (left the
//   course area), so a page opened from the Dashboard goes to the fallback.
// - no `backTo`: plain router.back() when there's a previous app entry.
//
// Anything else (no Navigation API, no match) → follow the link.
export default function BackButton({ fallbackHref, backTo, withinPrefix = '/courses', label = 'Voltar' }) {
  const router = useRouter();

  function handleClick(e) {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const nav = typeof window !== 'undefined' ? window.navigation : null;
    if (!nav?.canGoBack) return;

    if (!backTo) {
      e.preventDefault();
      router.back();
      return;
    }

    let entries;
    try {
      entries = nav.entries();
    } catch {
      return;
    }
    const current = nav.currentEntry?.index ?? -1;
    for (let i = current - 1; i >= 0; i--) {
      let pathname;
      try {
        pathname = new URL(entries[i].url).pathname;
      } catch {
        return;
      }
      if (backTo.includes(pathname)) {
        e.preventDefault();
        window.history.go(i - current);
        return;
      }
      if (!pathname.startsWith(withinPrefix)) return;
    }
  }

  return (
    <Link href={fallbackHref} className="page-back" onClick={handleClick}>
      <ArrowLeft size={16} strokeWidth={1.8} aria-hidden="true" />
      {label}
    </Link>
  );
}
