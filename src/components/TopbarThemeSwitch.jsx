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

// Versão compacta (só ícones) do ThemeToggle para a Topbar, visível em todas
// as telas. Mesma fonte de verdade (lib/theme.js), então fica em sincronia
// com o seletor de Perfil > Aparência.
export default function TopbarThemeSwitch() {
  const [theme, setTheme] = useState('system');

  useEffect(() => {
    setTheme(getStoredTheme());
    let cancelled = false;
    ensureUiPreferencesSynced()
      .then(() => {
        if (!cancelled) setTheme(getStoredTheme());
      })
      .catch(() => {});
    // Mantém em sincronia se o tema mudar em outro lugar (ex.: página de perfil).
    const onStorage = () => setTheme(getStoredTheme());
    window.addEventListener('storage', onStorage);
    window.addEventListener('vertice:theme-change', onStorage);
    return () => {
      cancelled = true;
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('vertice:theme-change', onStorage);
    };
  }, []);

  function handleSelect(value) {
    setTheme(value);
    applyTheme(value);
    window.dispatchEvent(new Event('vertice:theme-change'));
  }

  return (
    <div className="segmented topbar-theme-switch" role="radiogroup" aria-label="Tema da interface">
      {OPTIONS.map(({ value, label, Icon }) => (
        <button
          key={value}
          type="button"
          role="radio"
          aria-checked={theme === value}
          aria-label={label}
          title={label}
          className={`segmented-btn${theme === value ? ' active' : ''}`}
          onClick={() => handleSelect(value)}
        >
          <Icon size={14} strokeWidth={1.8} />
        </button>
      ))}
    </div>
  );
}
