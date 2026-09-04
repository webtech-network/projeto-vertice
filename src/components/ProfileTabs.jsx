'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { User, KeyRound, Bookmark, Wand2, Link2, SlidersHorizontal } from 'lucide-react';
import IntegrationManager from './IntegrationManager';
import ShortcutsManager from './ShortcutsManager';
import PromptCustomizer from './PromptCustomizer';
import CanvasConnection from './CanvasConnection';
import GithubConnection from './GithubConnection';
import GoogleConnection from './GoogleConnection';
import ThemeToggle from './ThemeToggle';
import TarefasPreferences from './TarefasPreferences';
import PasskeyManager from './PasskeyManager';
import { useUnsavedChangesGuard } from '@/lib/useUnsavedChangesGuard';
import { PASSKEYS_ENABLED } from '@/lib/passkeys';

const TABS = [
  { key: 'geral', label: 'Geral', Icon: User },
  { key: 'plataformas', label: 'Plataformas associadas', Icon: Link2 },
  { key: 'ia', label: 'Plataformas de IA', Icon: KeyRound },
  { key: 'prompts', label: 'Prompts de IA', Icon: Wand2 },
  { key: 'atalhos', label: 'Atalhos do Dashboard', Icon: Bookmark },
  { key: 'preferencias', label: 'Preferências', Icon: SlidersHorizontal },
];

const TAB_KEYS = TABS.map((t) => t.key);

// Own icon-sidebar nav (.profile-layout/.profile-sidebar/.profile-panel) —
// NOT QuizImportPanel.jsx's horizontal .tab-folder pattern, which this used
// to share: with six sections and labels like "Plataformas associadas"/
// "Atalhos do Dashboard", the horizontal tab row overflowed badly on
// anything narrower than a wide desktop and was unusable on a phone (a
// sideways-scrolling row of text tabs). The sidebar collapses to a
// horizontal icon+small-label strip below 640px instead (see globals.css) —
// still compact, but every section stays one tap away without scrolling
// through hidden tabs. Same client-only, local useState pattern, mostly no
// URL sync, EXCEPT the initial tab: the GitHub and Google OAuth callbacks
// (github/oauth2/callback, google/oauth2/callback) both redirect back to
// /perfil?tab=plataformas so the professor lands on the right section
// instead of "Geral" — read once at mount, not kept in sync afterward.
// `integrations` here is listAiIntegrations()'s output (computed
// server-side in perfil/page.jsx) — never includes the key itself, only a
// `hasApiKey` boolean per entry. `driverProviders` is listDriverProviders()'s
// output (id/label/defaultModel for the 4 built-in drivers), used only to
// populate the "Provedor" <select> when creating a new integration.
export default function ProfileTabs({ userName, baseUrl, integrations, driverProviders }) {
  const searchParams = useSearchParams();
  const initialTab = TAB_KEYS.includes(searchParams.get('tab')) ? searchParams.get('tab') : 'geral';
  const [tab, setTab] = useState(initialTab);
  // Combines the dirty signal from every settings form on this page (API
  // keys, shortcuts, custom prompts) — each reports in via its own
  // onDirtyChange prop, unregistering on unmount (e.g. switching tabs), so
  // this only reflects forms actually mounted right now.
  const [dirtyMap, setDirtyMap] = useState({});

  function setDirty(key, isDirty) {
    setDirtyMap((prev) => (prev[key] === isDirty ? prev : { ...prev, [key]: isDirty }));
  }

  useUnsavedChangesGuard(Object.values(dirtyMap).some(Boolean));

  return (
    <div className="profile-tabs">
      <div className="page-header-row">
        <h1>Configurações</h1>
      </div>

      <div className="profile-layout">
        <nav className="profile-sidebar" role="tablist" aria-label="Seções do perfil">
          {TABS.map(({ key, label, Icon }) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={tab === key}
              className={`profile-sidebar-btn${tab === key ? ' active' : ''}`}
              onClick={() => setTab(key)}
              title={label}
            >
              <Icon size={18} strokeWidth={1.8} />
              <span className="profile-sidebar-label">{label}</span>
            </button>
          ))}
        </nav>

        <div className="profile-panel" role="tabpanel">
        {tab === 'geral' && (
          <>
            <dl className="profile-info">
              <div>
                <dt>Nome</dt>
                <dd>{userName || '—'}</dd>
              </div>
              <div>
                <dt>Instituição (Canvas)</dt>
                <dd>{baseUrl}</dd>
              </div>
            </dl>

            <div className="preferences-section">
              <h3>Aparência</h3>
              <p className="tab-folder-description">Escolha entre o tema claro, escuro ou o padrão do seu sistema.</p>
              <ThemeToggle />
            </div>

            {PASSKEYS_ENABLED && (
              <div className="preferences-section">
                <h3>Segurança — passkeys</h3>
                <p className="tab-folder-description">
                  Cadastre uma passkey do seu dispositivo (Face ID, Touch ID, Windows Hello ou chave de segurança)
                  para entrar sem senha. Recurso experimental.
                </p>
                <PasskeyManager />
              </div>
            )}

            <p className="lede">
              Além do tema e dos atalhos e prompts nas seções ao lado, outras preferências (idioma, provedor de IA
              padrão, notificações) devem chegar aqui conforme forem implementadas.
            </p>
          </>
        )}

        {tab === 'plataformas' && (
          <>
            <p className="tab-folder-description">
              Conecte plataformas externas à sua conta Vértice. A conexão com o Canvas fica salva no servidor
              (cifrada); GitHub e Google Drive ficam salvas neste navegador.
            </p>
            <h3>Canvas</h3>
            <CanvasConnection />
            <h3 style={{ marginTop: '1.75rem' }}>GitHub</h3>
            <GithubConnection />
            <h3 style={{ marginTop: '1.75rem' }}>Google Drive</h3>
            <GoogleConnection />
          </>
        )}

        {tab === 'ia' && (
          <>
            <p className="tab-folder-description">
              Cadastre quantas integrações de IA precisar — inclusive várias do mesmo provedor, com chaves, URLs base,
              modelos e parâmetros de geração diferentes. Cada uma fica disponível como uma opção separada nas telas
              que usam IA.
            </p>
            <IntegrationManager
              integrations={integrations}
              driverProviders={driverProviders}
              onDirtyChange={(isDirty) => setDirty('integrations', isDirty)}
            />
          </>
        )}

        {tab === 'prompts' && <PromptCustomizer onDirtyChange={(isDirty) => setDirty('prompts', isDirty)} />}

        {tab === 'atalhos' && (
          <>
            <p className="tab-folder-description">Atalhos exibidos no painel inicial.</p>
            <ShortcutsManager />
          </>
        )}

        {tab === 'preferencias' && <TarefasPreferences />}
        </div>
      </div>
    </div>
  );
}
