import { Toaster } from '@/components/ui/toaster';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClientInstance } from '@/lib/query-client';
import { BrowserRouter as Router, Navigate, Route, Routes } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import ScrollToTop from './components/ScrollToTop';
import ProtectedRoute from '@/components/ProtectedRoute';
import { ThemeProvider } from '@/components/theme/ThemeProvider';
import AppShell from '@/components/layout/AppShell';
import Login from '@/pages/Login';
import About from '@/pages/About';
import Overview from '@/pages/Overview';
import Projects from '@/pages/Projects';
import ProjectDetails from '@/pages/ProjectDetails';
import Events from '@/pages/Events';
import EventDetails from '@/pages/EventDetails';
import Deliveries from '@/pages/Deliveries';
import DeliveryDetails from '@/pages/DeliveryDetails';
import Endpoints from '@/pages/Endpoints';
import EndpointDetails from '@/pages/EndpointDetails';
import ApiKeys from '@/pages/ApiKeys';
import Docs from '@/pages/Docs';
import Settings from '@/pages/Settings';

function AuthenticationRoutes() {
  const { isAuthenticated, isLoadingAuth } = useAuth();

  if (isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-slate-800" />
      </div>
    );
  }

  return (
    <Routes>
      <Route
        path="/login"
        element={isAuthenticated ? <Navigate to="/" replace /> : <Login />}
      />
      <Route path="/about" element={<About />} />
      <Route element={<ProtectedRoute />}>
        <Route element={<AppShell />}>
          <Route path="/" element={<Overview />} />
          <Route path="/projects" element={<Projects />} />
          <Route path="/projects/:projectId" element={<ProjectDetails />} />
          <Route path="/events" element={<Events />} />
          <Route path="/events/:eventId" element={<EventDetails />} />
          <Route path="/deliveries" element={<Deliveries />} />
          <Route path="/deliveries/:deliveryId" element={<DeliveryDetails />} />
          <Route path="/endpoints" element={<Endpoints />} />
          <Route path="/endpoints/:endpointId" element={<EndpointDetails />} />
          <Route path="/api-keys" element={<ApiKeys />} />
          <Route path="/docs" element={<Docs />} />
          <Route path="/settings" element={<Settings />} />
        </Route>
      </Route>
      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClientInstance}>
        <AuthProvider>
          <Router>
            <ScrollToTop />
            <AuthenticationRoutes />
          </Router>
          <Toaster />
        </AuthProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}
