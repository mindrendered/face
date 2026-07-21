import React, { Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import IntersectObserver from '@/components/common/IntersectObserver';
import { Toaster } from '@/components/ui/sonner';
import { AuthProvider } from '@/contexts/AuthContext';
import { GenerationProvider } from '@/contexts/GenerationContext';
import { ProtectedRoute } from '@/components/layouts/ProtectedRoute';
import { AppLayout } from '@/components/layouts/AppLayout';
import { routes } from './routes';

const NotFound = React.lazy(() => import('./pages/NotFound'));

const App: React.FC = () => {
  return (
    <Router>
      <AuthProvider>
        <GenerationProvider>
        <IntersectObserver />
        <Routes>
          {routes.map((route, index) => (
            <Route
              key={route.path}
              path={route.path}
              element={
                route.public ? (
                  route.element
                ) : (
                  <ProtectedRoute>
                    <AppLayout>{route.element}</AppLayout>
                  </ProtectedRoute>
                )
              }
            />
          ))}
          <Route path="*" element={<Suspense fallback={null}><NotFound /></Suspense>} />
        </Routes>
        <Toaster />
        </GenerationProvider>
      </AuthProvider>
    </Router>
  );
};

export default App;
