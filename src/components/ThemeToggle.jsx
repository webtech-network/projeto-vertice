'use client';

import { useEffect, useState } from 'react';
import { Sun, Moon, MonitorSmartphone } from 'lucide-react';
import { applyTheme, getStoredTheme } from '@/lib/theme';
import { ensureUiPreferencesSynced } from './UiPreferencesSync';

const OPTIONS = [
  { value: 'light', label: 'Claro', Icon: Sun },
  { value: 'dark', label: 'Escuro', Icon: Moon },
  { value: 'system', label: 'Sistema', Icon: MonitorSmartphone },
];

// The common three-way "Claro / Escuro / Sistema" pattern most apps use for
// this setting. Reads the persisted choice only after mount (localStorage
// isn't available during SSR) — the actual theme itself never flashes
// wrong on load because layout.jsx's beforeInteractive script already
// applied it before paint; this only syncs which segment shows selected.
export default function ThemeToggle() {
  const [theme, setTheme] = useState('system');

  useEffect(() => {
    setTheme(getStoredTheme());
  }, []);

  // Fase 2 (sincronização entre dispositivos) — ver o mesmo padrão/racional
  // em Sidebar.jsx.
  useEffect(() => {
    let cancelled = false;
    ensureUiPreferencesSynced().then(() => {
      if (!cancelled) setTheme(getStoredTheme());
    });
    return () => {
      cancelled = true;
    };
  }, []);

  function handleSelect(value) {
    setTheme(value);
    applyTheme(value);
  }

  return (
    <div className="segmented" role="radiogroup" aria-label="Tema da interface">
      {OPTIONS.map(({ value, label, Icon }) => (
        <button
          key={value}
          type="button"
          role="radio"
          aria-checked={theme === value}
          className={`segmented-btn${theme === value ? ' active' : ''}`}
          onClick={() => handleSelect(value)}
        >
          <Icon size={14} strokeWidth={1.8} />
          {label}
        </button>
      ))}
    </div>
  );
}
