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
// middle-click/open-in-new-tab land somewhere sensible. On a plain click we
// prefer router.back() when the previous entry is ours — that returns to the
// real origin (e.g. a grading page opened from the Dashboard goes back to the
// Dashboard, with its scroll position). `navigation.canGoBack` only counts
// same-origin entries, unlike history.length, so it never walks the user out
// of the app. Without the Navigation API we just follow the link.
export default function BackButton({ fallbackHref, label = 'Voltar' }) {
  const router = useRouter();

  function handleClick(e) {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    if (typeof window !== 'undefined' && window.navigation?.canGoBack) {
      e.preventDefault();
      router.back();
    }
  }

  return (
    <Link href={fallbackHref} className="page-back" onClick={handleClick}>
      <ArrowLeft size={16} strokeWidth={1.8} aria-hidden="true" />
      {label}
    </Link>
  );
}
