import Sidebar from '@/components/Sidebar';
import Topbar from '@/components/Topbar';
import { MobileNavProvider } from '@/components/MobileNavProvider';
import { WorkspaceScopeProvider } from '@/components/WorkspaceScopeProvider';
import ServiceWorkerRegistration from '@/components/ServiceWorkerRegistration';
import UiPreferencesSync from '@/components/UiPreferencesSync';
import QueryProvider from '@/components/QueryProvider';
import { getSupabaseUser } from '@/lib/supabaseServerClient';

export default async function DashboardLayout({ children }) {
  // Memoizado por requisição (mesma chamada do Topbar). O id escopa o cache
  // local de consultas — ver QueryProvider.jsx / ADR-0015.
  const { user } = await getSupabaseUser();

  return (
    // Mounted here (not inside a single page, unlike TasksProvider) so the
    // active-workspace scope and its Topbar switcher are available across
    // every dashboard route without remounting on client-side navigation.
    <QueryProvider userId={user?.id ?? null}>
      <WorkspaceScopeProvider>
        <MobileNavProvider>
          <ServiceWorkerRegistration />
          <UiPreferencesSync />
          <div className="dashboard-shell">
            <Sidebar />
            <div className="dashboard-main">
              <Topbar />
              <div className="dashboard-content">{children}</div>
            </div>
          </div>
        </MobileNavProvider>
      </WorkspaceScopeProvider>
    </QueryProvider>
  );
}
