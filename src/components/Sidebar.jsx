'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  GraduationCap,
  KanbanSquare,
  Sparkles,
  Mail,
  BookOpen,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react';
import SidebarMenu from './SidebarMenu';
import { useMobileNav } from './MobileNavProvider';
import { getSidebarCollapsed, setSidebarCollapsed } from '@/lib/sidebarPreference';
import { ensureUiPreferencesSynced } from './UiPreferencesSync';

const NAV_ITEMS = [
  { href: '/', label: 'Dashboard', Icon: LayoutDashboard, exact: true },
  { href: '/courses', label: 'Cursos', Icon: GraduationCap },
  { href: '/tarefas', label: 'Tarefas', Icon: KanbanSquare },
  { href: '/mensagens', label: 'Mensagens', Icon: Mail },
  { href: '/questoes', label: 'Questões', Icon: Sparkles },
  { href: '/tutorial', label: 'Tutorial', Icon: BookOpen },
];

// The CanvasTools mark used to sit here as a link to "/" — that job moved to
// the full logo lockup in Topbar.jsx (see Topbar's own comment). This spot
// is now the collapse/expand toggle instead: collapsed shows icons only
// (same width as the mobile breakpoint's narrow sidebar, --sidebar-width-
// narrow), expanded shows icons + labels (the default). `.dashboard-main`'s
// margin-left reacts to the collapsed state via a CSS `:has()` selector on
// `.dashboard-shell` (see globals.css) rather than lifting this state up to
// the (dashboard) layout — keeps Sidebar self-contained. The preference
// persists across reloads via localStorage; read only after mount so the
// server-rendered (expanded) markup matches the client's first paint and
// hydration never mismatches.
export default function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  // Mobile drawer open/closed — shared with Topbar.jsx's hamburger button
  // via MobileNavProvider. Unrelated to `collapsed` above, which is a
  // desktop-only icons-only/icons+labels preference; below the 640px
  // breakpoint CSS ignores `collapsed` entirely and drives visibility off
  // this instead (see .sidebar / .sidebar.mobile-open in globals.css).
  const { open: mobileOpen, setOpen: setMobileOpen } = useMobileNav();

  useEffect(() => {
    setCollapsed(getSidebarCollapsed());
  }, []);

  // Fase 2 (sincronização entre dispositivos): `ensureUiPreferencesSynced()`
  // é memoizada a nível de módulo — não importa se este componente montou
  // antes ou depois da leitura do Postgres já ter começado/terminado em
  // outro lugar (ex.: o componente UiPreferencesSync no layout), o
  // `.then()` abaixo sempre roda assim que resolver. Reler depois, porque
  // o Postgres pode ter um valor diferente do que já foi lido acima.
  useEffect(() => {
    let cancelled = false;
    ensureUiPreferencesSynced().then(() => {
      if (!cancelled) setCollapsed(getSidebarCollapsed());
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Closes the drawer on every route change (including a nav link pointing
  // at the already-active page) — layout.jsx isn't remounted by client-side
  // navigation within the route group, so without this the drawer would
  // stay open across page loads.
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname, setMobileOpen]);

  function toggleCollapsed() {
    setCollapsed((prev) => {
      const next = !prev;
      setSidebarCollapsed(next);
      return next;
    });
  }

  return (
    <>
      {/* Only rendered/visible on mobile (see globals.css) — tapping outside
          the open drawer closes it, same affordance as any off-canvas nav. */}
      <div
        className={`sidebar-backdrop${mobileOpen ? ' is-visible' : ''}`}
        onClick={() => setMobileOpen(false)}
        aria-hidden="true"
      />
      <aside className={`sidebar${collapsed ? ' is-collapsed' : ''}${mobileOpen ? ' mobile-open' : ''}`}>
        <button
          type="button"
          className="sidebar-collapse-toggle"
          onClick={toggleCollapsed}
          title={collapsed ? 'Expandir menu' : 'Recolher menu'}
          aria-label={collapsed ? 'Expandir menu' : 'Recolher menu'}
          aria-pressed={collapsed}
        >
          {collapsed ? <PanelLeftOpen size={22} strokeWidth={1.8} /> : <PanelLeftClose size={22} strokeWidth={1.8} />}
        </button>
        <nav className="sidebar-nav">
          {NAV_ITEMS.map(({ href, label, Icon, exact }) => {
            const active = exact ? pathname === href : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                title={label}
                className={`nav-icon-btn${active ? ' active' : ''}`}
              >
                <Icon size={20} strokeWidth={1.8} />
                <span className="nav-icon-label">{label}</span>
              </Link>
            );
          })}
        </nav>
        <SidebarMenu />
      </aside>
    </>
  );
}
