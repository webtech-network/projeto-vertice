import Image from 'next/image';
import Link from 'next/link';
import { createSupabaseServerClient } from '@/lib/supabaseServerClient';
import { getDisplayName, getAvatarUrl } from '@/lib/supabaseUserDisplay';
import UserMenu from './UserMenu';
import MobileNavToggle from './MobileNavToggle';
import WorkspaceSwitcher from './WorkspaceSwitcher';
import logoFull from '@/assets/images/logo-full.png';
import logoFullDark from '@/assets/images/logo-full-dark.png';

export default async function Topbar() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const loggedIn = Boolean(user);

  return (
    <header className="topbar">
      <div className="topbar-start">
        {/* Only visible below the 640px breakpoint (see globals.css) — opens
            Sidebar.jsx as an off-canvas drawer instead of the permanently
            docked desktop rail. No sidebar to open when logged out. */}
        {loggedIn && <MobileNavToggle />}
        {/* Both variants render; CSS (globals.css, same three-state pattern as
            the theme tokens) shows only the one matching the active theme —
            Topbar is a Server Component and can't know the client's
            data-theme choice, so the swap has to happen visually, not by
            picking one image server-side. */}
        <Link href="/" className="topbar-logo" title="Início">
          <Image src={logoFull} alt="CanvasTools" priority className="topbar-logo-light" />
          <Image src={logoFullDark} alt="CanvasTools" priority className="topbar-logo-dark" />
        </Link>
      </div>
      {loggedIn && (
        <div className="topbar-user">
          <WorkspaceSwitcher />
          <UserMenu userName={getDisplayName(user)} avatarUrl={getAvatarUrl(user)} />
        </div>
      )}
    </header>
  );
}
