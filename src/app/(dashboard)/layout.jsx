import Sidebar from '@/components/Sidebar';
import Topbar from '@/components/Topbar';
import { MobileNavProvider } from '@/components/MobileNavProvider';
import { WorkspaceScopeProvider } from '@/components/WorkspaceScopeProvider';
import ServiceWorkerRegistration from '@/components/ServiceWorkerRegistration';
import UiPreferencesSync from '@/components/UiPreferencesSync';

export default function DashboardLayout({ children }) {
  return (
    // Mounted here (not inside a single page, unlike TasksProvider) so the
    // active-workspace scope and its Topbar switcher are available across
    // every dashboard route without remounting on client-side navigation.
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
  );
}
