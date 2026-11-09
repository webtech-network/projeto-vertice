import Image from 'next/image';
import Link from 'next/link';
import { getSession, isSessionValid } from '@/lib/session';
import logo from '@/assets/images/logo.png';

export default async function Header() {
  const session = await getSession();
  const loggedIn = isSessionValid(session);

  return (
    <header className="site-header">
      <Link href={loggedIn ? '/courses' : '/login'} className="brand">
        <Image src={logo} alt="Vértice" className="brand-logo" priority />
      </Link>
      {loggedIn && (
        <form action="/api/auth/logout" method="POST" className="logout-form">
          <span className="user-name">{session.user?.name}</span>
          <button type="submit" className="btn btn-ghost">
            Sair
          </button>
        </form>
      )}
    </header>
  );
}
