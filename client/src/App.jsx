import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { useEffect } from 'react';
import ProtectedRoute from './components/layout/ProtectedRoute';
import DashboardLayout from './components/layout/DashboardLayout';
import Landing from './pages/Landing';
import Login from './pages/Login';
import Register from './pages/Register';
import CitizenDashboard from './pages/dashboards/CitizenDashboard';
import MunicipalDashboard from './pages/dashboards/MunicipalDashboard';
import WardDashboard from './pages/dashboards/WardDashboard';
import GovernmentDashboard from './pages/dashboards/GovernmentDashboard';
import AuthoritiesPage from './pages/dashboards/AuthoritiesPage';
import ReportIssue from './pages/ReportIssue';
import ComplaintsList from './pages/ComplaintsList';
import ComplaintDetails from './pages/ComplaintDetails';
import ComplaintMapPage from './pages/ComplaintMapPage';
import NotificationsPage from './pages/NotificationsPage';
import EvidencePage from './pages/EvidencePage';
import SettingsPage from './pages/SettingsPage';
import { useAuth } from './context/AuthContext';
import { roleHome } from './utils/helpers';

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);
  return null;
}

function HomeRedirect() {
  const { user, loading } = useAuth();
  if (loading) return null;
  return <Navigate to={user ? roleHome(user.role) : '/'} replace />;
}

export default function App() {
  return (
    <>
      <ScrollToTop />
      <Toaster position="top-right" toastOptions={{ style: { borderRadius: '12px', background: '#0f2035', color: '#fff' } }} />
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />

        <Route element={<ProtectedRoute />}>
          <Route element={<DashboardLayout />}>
            <Route path="/dashboard" element={<ProtectedRoute roles={['citizen']} />}>
              <Route index element={<CitizenDashboard />} />
            </Route>
            <Route path="/dashboard/municipal" element={<ProtectedRoute roles={['municipal']} />}>
              <Route index element={<MunicipalDashboard />} />
            </Route>
            <Route path="/dashboard/ward" element={<ProtectedRoute roles={['ward_officer']} />}>
              <Route index element={<WardDashboard />} />
            </Route>
            <Route path="/dashboard/government" element={<ProtectedRoute roles={['superior']} />}>
              <Route index element={<GovernmentDashboard />} />
              <Route path="authorities" element={<AuthoritiesPage />} />
            </Route>

            <Route path="/report" element={<ProtectedRoute roles={['citizen']} />}>
              <Route index element={<ReportIssue />} />
            </Route>
            <Route path="/complaints" element={<ComplaintsList />} />
            <Route path="/complaints/:id" element={<ComplaintDetails />} />
            <Route path="/map" element={<ComplaintMapPage />} />
            <Route path="/evidence" element={<EvidencePage />} />
            <Route path="/notifications" element={<NotificationsPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/home" element={<HomeRedirect />} />
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}
