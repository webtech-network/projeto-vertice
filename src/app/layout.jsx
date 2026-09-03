import { Fraunces, IBM_Plex_Sans } from 'next/font/google';
import Script from 'next/script';
import bannerOg from '@/assets/images/banner_og.jpeg';
import { THEME_INIT_SCRIPT } from '@/lib/theme';
import { INSTALL_PROMPT_CAPTURE_SCRIPT } from '@/lib/pwaInstall';
import './globals.css';

const GA_MEASUREMENT_ID = 'G-15544DM2DE';
const SITE_URL = 'https://canvastools.apps.webtech.network/';

const display = Fraunces({
  subsets: ['latin'],
  variable: '--font-display',
  weight: ['500', '600'],
});

const body = IBM_Plex_Sans({
  subsets: ['latin'],
  variable: '--font-body',
  weight: ['400', '500', '600'],
});

export const metadata = {
  metadataBase: new URL(SITE_URL),
  title: 'Vértice',
  description: 'Organização pessoal e acadêmica, com o Canvas LMS como uma integração opcional',
  openGraph: {
    title: 'Vértice',
    description: 'Um único painel com as informações relevantes para facilitar o acompanhamento da sua rotina acadêmica.',
    url: SITE_URL,
    siteName: 'Vértice | WebTech Network',
    images: [{ url: bannerOg.src, width: bannerOg.width, height: bannerOg.height }],
    locale: 'pt_BR',
    type: 'website',
  },
  // "Add to Home Screen" on iOS Safari — that browser never fires
  // beforeinstallprompt (see pwaInstall.js), so this + src/app/apple-icon.png
  // is the only PWA affordance it gets; the manifest.js icons/display below
  // are what Chrome/Edge/Android use instead.
  appleWebApp: { capable: true, statusBarStyle: 'default', title: 'Vértice' },
};

// Explicit now (rather than relying on Next's implicit default) so
// themeColor can be added — width/initialScale are repeated here
// deliberately, since declaring this export at all replaces the default
// `width=device-width, initial-scale=1` Next.js otherwise injects, and that
// default is what keeps every page responsive on a phone.
export const viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#173a60', // --brand, same as manifest.js
};

export default function RootLayout({ children }) {
  return (
    // suppressHydrationWarning: the theme-init script below sets data-theme
    // on this element before hydration, on purpose (see its own comment) —
    // that's an expected, intentional mismatch versus the server-rendered
    // markup (which can't know the client's localStorage preference), not a
    // real bug for React to warn about.
    <html lang="pt-BR" className={`${display.variable} ${body.variable}`} suppressHydrationWarning>
      <body>
        {/* Sets data-theme on <html> from localStorage before first paint, so a
            saved dark/light preference never flashes the wrong theme on load —
            see src/lib/theme.js. */}
        <Script id="theme-init" strategy="beforeInteractive">
          {THEME_INIT_SCRIPT}
        </Script>
        {/* Attaches a beforeinstallprompt listener before this app's own JS
            hydrates — Chrome can fire that event as soon as it evaluates
            installability, which can happen before a React effect would be
            live to catch it. Stashes on window; pwaInstall.js's
            claimStashedPrompt() (called from ServiceWorkerRegistration.jsx)
            picks it up once the app is actually running. */}
        <Script id="install-prompt-capture" strategy="beforeInteractive">
          {INSTALL_PROMPT_CAPTURE_SCRIPT}
        </Script>
        <Script src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`} strategy="afterInteractive" />
        <Script id="google-analytics" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', '${GA_MEASUREMENT_ID}');
          `}
        </Script>
        {children}
      </body>
    </html>
  );
}
