'use client';

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import Link from 'next/link';
import { CircleUserRound, Download } from 'lucide-react';
import { subscribeInstall, getInstallSnapshot, getServerInstallSnapshot, triggerInstall } from '@/lib/pwaInstall';
import { clearLocalCache } from '@/lib/query/idbPersister';

// Replaces the old "username link to /perfil" + standalone "Sair" button
// pair in Topbar.jsx with a single avatar-triggered dropdown, mirroring
// SidebarMenu.jsx's own click-outside/Escape-to-close popover pattern.
// `avatarUrl` comes from session.user?.avatar_url — fetched once at Canvas
// OAuth login time (see src/app/oauth2/callback/route.js), not on every
// render, so a missing value here just means the professor logged in before
// that field existed, or Canvas didn't return one — either way this falls
// back to a generic icon rather than an extra Canvas API call per page.
export default function UserMenu({ userName, avatarUrl }) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);
  // Chrome/Edge/Android only — iOS Safari never fires beforeinstallprompt,
  // so `available` there stays false forever and this item just never
  // renders (installing there stays the manual Share > "Adicionar à Tela
  // de Início" flow, which src/app/apple-icon.png + layout.jsx's
  // appleWebApp metadata already support).
  const { available: canInstall } = useSyncExternalStore(subscribeInstall, getInstallSnapshot, getServerInstallSnapshot);

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
    <div className="user-menu" ref={containerRef}>
      <button
        type="button"
        className="user-menu-trigger"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        title={userName}
      >
        {avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- external Canvas-hosted avatar, not a local asset
          <img src={avatarUrl} alt="" className="user-menu-avatar" width={32} height={32} />
        ) : (
          <CircleUserRound size={32} strokeWidth={1.4} className="user-menu-avatar user-menu-avatar-fallback" />
        )}
        <span className="user-name">{userName}</span>
      </button>

      {open && (
        <div className="user-menu-popover" role="menu">
          <Link href="/perfil" className="user-menu-item" role="menuitem" onClick={() => setOpen(false)}>
            Configurações
          </Link>
          {canInstall && (
            <button
              type="button"
              className="user-menu-item"
              role="menuitem"
              onClick={() => {
                triggerInstall();
                setOpen(false);
              }}
            >
              <Download size={15} strokeWidth={1.8} aria-hidden="true" /> Instalar app
            </button>
          )}
          {/* Limpa o cache local de dados do Canvas (memória + IndexedDB) antes
              de sair — ADR-0015. form.submit() não redispara onSubmit. */}
          <form
            action="/api/auth/logout"
            method="POST"
            onSubmit={async (e) => {
              e.preventDefault();
              const form = e.currentTarget;
              await clearLocalCache();
              form.submit();
            }}
          >
            <button type="submit" className="user-menu-item" role="menuitem">
              Sair
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
