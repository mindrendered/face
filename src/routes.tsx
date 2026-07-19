import type { ReactNode } from 'react';
import LandingPage from './pages/LandingPage';
import AuthPage from './pages/AuthPage';
import DashboardPage from './pages/DashboardPage';
import CreateSeriesPage from './pages/CreateSeriesPage';
import SeriesPage from './pages/SeriesPage';
import SeriesDetailPage from './pages/SeriesDetailPage';
import ConnectionsPage from './pages/ConnectionsPage';
import SchedulePage from './pages/SchedulePage';
import AnalyticsPage from './pages/AnalyticsPage';
import SettingsPage from './pages/SettingsPage';
import AdminPage from './pages/AdminPage';
import StudioPage from './pages/StudioPage';

export interface RouteConfig {
  name: string;
  path: string;
  element: ReactNode;
  visible?: boolean;
  public?: boolean;
}

export const routes: RouteConfig[] = [
  { name: 'Home', path: '/', element: <LandingPage />, public: true },
  { name: 'Auth', path: '/auth', element: <AuthPage />, public: true },
  { name: 'Dashboard', path: '/dashboard', element: <DashboardPage /> },
  { name: 'Create Series', path: '/create-series', element: <CreateSeriesPage /> },
  { name: 'My Series', path: '/series', element: <SeriesPage /> },
  { name: 'Series Detail', path: '/series/:id', element: <SeriesDetailPage /> },
  { name: 'Connections', path: '/connections', element: <ConnectionsPage /> },
  { name: 'Schedule', path: '/schedule', element: <SchedulePage /> },
  { name: 'Analytics', path: '/analytics', element: <AnalyticsPage /> },
  { name: 'AI Studio', path: '/studio', element: <StudioPage /> },
  { name: 'Settings', path: '/settings', element: <SettingsPage /> },
  { name: 'Admin', path: '/admin', element: <AdminPage /> },
];
