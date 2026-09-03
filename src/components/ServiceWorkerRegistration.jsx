'use client';

import { useEffect } from 'react';
import { claimStashedPrompt, markInstalled, INSTALL_PROMPT_READY_EVENT } from '@/lib/pwaInstall';

// No visible UI — registers public/sw.js (offline shell cache). Also the
// app's one place listening for the PWA install lifecycle
// (beforeinstallprompt/appinstalled), feeding pwaInstall.js's store that
// UserMenu.jsx's "Instalar app" item reads from.
export default function ServiceWorkerRegistration() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    navigator.serviceWorker.register('/sw.js').catch(() => {
      // best-effort — offline resilience is a nicety, not a dependency
    });
  }, []);

  useEffect(() => {
    // The actual `beforeinstallprompt` listener lives in the
    // beforeInteractive script (layout.jsx + pwaInstall.js's
    // INSTALL_PROMPT_CAPTURE_SCRIPT) so it's live before this component
    // even mounts — Chrome can fire that event as soon as it evaluates
    // installability, which is sometimes before hydration. This just claims
    // whatever's already stashed (covers "fired before mount") and listens
    // for the ready event (covers "fires after mount") — never attaches its
    // own native listener, so the event is only ever handled once.
    claimStashedPrompt();
    function onPromptReady() {
      claimStashedPrompt();
    }
    function onAppInstalled() {
      markInstalled();
    }
    window.addEventListener(INSTALL_PROMPT_READY_EVENT, onPromptReady);
    window.addEventListener('appinstalled', onAppInstalled);
    return () => {
      window.removeEventListener(INSTALL_PROMPT_READY_EVENT, onPromptReady);
      window.removeEventListener('appinstalled', onAppInstalled);
    };
  }, []);

  return null;
}
