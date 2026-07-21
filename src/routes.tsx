import { lazy, Suspense } from 'react';
import { Loader2 } from 'lucide-react';

const LandingPage = lazy(() => import('./pages/LandingPage'));
const AuthPage = lazy(() => import('./pages/AuthPage'));
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const CreateSeriesPage = lazy(() => import('./pages/CreateSeriesPage'));
const SeriesPage = lazy(() => import('./pages/SeriesPage'));
const SeriesDetailPage = lazy(() => import('./pages/SeriesDetailPage'));
const ConnectionsPage = lazy(() => import('./pages/ConnectionsPage'));
const SchedulePage = lazy(() => import('./pages/SchedulePage'));
const AnalyticsPage = lazy(() => import('./pages/AnalyticsPage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));
const AdminPage = lazy(() => import('./pages/AdminPage'));
const StudioPage = lazy(() => import('./pages/StudioPage'));

function PageLoader() {
  return (
    <div className="flex items-center justify-center min-h-64">
      <Loader2 size={20} className="animate-spin text-muted-foreground" />
    </div>
  );
}

function LazyPage({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<PageLoader />}>{children}</Suspense>;
}

export interface RouteConfig {
  name: string;
  path: string;
  element: React.ReactNode;
  visible?: boolean;
  public?: boolean;
}

export const routes: RouteConfig[] = [
  { name: 'Home', path: '/', element: <LazyPage><LandingPage /></LazyPage>, public: true },
  { name: 'Auth', path: '/auth', element: <LazyPage><AuthPage /></LazyPage>, public: true },
  { name: 'Dashboard', path: '/dashboard', element: <LazyPage><DashboardPage /></LazyPage> },
  { name: 'Create Series', path: '/create-series', element: <LazyPage><CreateSeriesPage /></LazyPage> },
  { name: 'My Series', path: '/series', element: <LazyPage><SeriesPage /></LazyPage> },
  { name: 'Series Detail', path: '/series/:id', element: <LazyPage><SeriesDetailPage /></LazyPage> },
  { name: 'Connections', path: '/connections', element: <LazyPage><ConnectionsPage /></LazyPage> },
  { name: 'Schedule', path: '/schedule', element: <LazyPage><SchedulePage /></LazyPage> },
  { name: 'Analytics', path: '/analytics', element: <LazyPage><AnalyticsPage /></LazyPage> },
  { name: 'AI Studio', path: '/studio', element: <LazyPage><StudioPage /></LazyPage> },
  { name: 'Settings', path: '/settings', element: <LazyPage><SettingsPage /></LazyPage> },
  { name: 'Admin', path: '/admin', element: <LazyPage><AdminPage /></LazyPage> },
];
