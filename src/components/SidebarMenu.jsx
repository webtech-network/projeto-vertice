'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import webtechLogoColor from '@/assets/images/logo-colorido.svg';
import { useMobileNav } from './MobileNavProvider';

// Anchored to the bottom of the sidebar (see .sidebar-menu's margin-top:
// auto) — a general-purpose "more options" menu, starting with the WebTech
// Network link and meant to grow with future app-wide options.
export default function SidebarMenu() {
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);
  // The external links below open in a new tab (target="_blank"), so the
  // pathname never changes and Sidebar.jsx's route-change effect can't
  // auto-close the mobile drawer behind them — close it explicitly here too.
  const { setOpen: setMobileOpen } = useMobileNav();

  function closeAll() {
    setOpen(false);
    setMobileOpen(false);
  }

  useEffect(() => {
    if (!open) return;

    function handleClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    function handleKeyDown(e) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  return (
    <div className="sidebar-menu" ref={containerRef}>
      {open && (
        <div className="sidebar-menu-popover" role="menu">
          <Link href="/sobre" className="sidebar-menu-item" role="menuitem" onClick={closeAll}>
            Sobre o Vértice
          </Link>

          <div className="sidebar-menu-separator" role="separator" />

          <a
            href="https://webtech.network/terms"
            target="_blank"
            rel="noopener noreferrer"
            className="sidebar-menu-item"
            role="menuitem"
            onClick={closeAll}
          >
            Termos de Uso
          </a>
          <a
            href="https://webtech.network/privacy"
            target="_blank"
            rel="noopener noreferrer"
            className="sidebar-menu-item"
            role="menuitem"
            onClick={closeAll}
          >
            Política de Privacidade
          </a>

          <div className="sidebar-menu-separator" role="separator" />

          <a
            href="https://webtech.network"
            target="_blank"
            rel="noopener noreferrer"
            className="sidebar-menu-item"
            role="menuitem"
            onClick={closeAll}
          >
            Conheça o WebTech Network
          </a>
        </div>
      )}
      <button
        type="button"
        className="nav-icon-btn sidebar-menu-trigger"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        title="Mais opções"
      >
        <Image src={webtechLogoColor} alt="" aria-hidden="true" />
        <span className="nav-icon-label">Mais</span>
      </button>
    </div>
  );
}
