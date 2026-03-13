import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './context/AuthContext';
import { WheelProvider } from './context/WheelContext';
import { ProtectedRoute, AdminRoute } from './components/common/ProtectedRoute';
import Navbar from './components/common/Navbar';
import './styles/globals.css';

// Pages — lazy loaded for performance
import { lazy, Suspense } from 'react';
const LoginPage           = lazy(() => import('./pages/LoginPage'));
const RegisterPage        = lazy(() => import('./pages/RegisterPage'));
const RegisterAdminPage   = lazy(() => import('./pages/RegisterAdminPage'));
const LobbyPage        = lazy(() => import('./pages/LobbyPage'));
const GamePage         = lazy(() => import('./pages/GamePage'));
const WalletPage       = lazy(() => import('./pages/WalletPage'));
const ProfilePage      = lazy(() => import('./pages/ProfilePage'));
const LeaderboardPage  = lazy(() => import('./pages/LeaderboardPage'));
const AdminDashboard   = lazy(() => import('./pages/admin/AdminDashboard'));
const AdminUsers       = lazy(() => import('./pages/admin/AdminUsers'));
const AdminConfig      = lazy(() => import('./pages/admin/AdminConfig'));
const AdminWheels      = lazy(() => import('./pages/admin/AdminWheels'));

// Loading fallback
function PageLoader() {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      height: '100vh', flexDirection: 'column', gap: '1rem'
    }}>
      <div style={{ fontSize: '2rem' }}>🎡</div>
      <div className="spinner" style={{ width: 40, height: 40 }} />
    </div>
  );
}

// Layout with Navbar (for protected pages)
function AppLayout({ children }) {
  return (
    <>
      <Navbar />
      <div style={{ paddingTop: '64px' }}>
        {children}
      </div>
    </>
  );
}

function AppRoutes() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        {/* Public */}
        <Route path="/login"    element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/register-admin" element={<RegisterAdminPage />} />

        {/* Protected — user */}
        <Route path="/lobby" element={
          <ProtectedRoute>
            <AppLayout><LobbyPage /></AppLayout>
          </ProtectedRoute>
        } />
        <Route path="/game/:wheelId" element={
          <ProtectedRoute>
            <AppLayout><GamePage /></AppLayout>
          </ProtectedRoute>
        } />
        <Route path="/wallet" element={
          <ProtectedRoute>
            <AppLayout><WalletPage /></AppLayout>
          </ProtectedRoute>
        } />
        <Route path="/profile" element={
          <ProtectedRoute>
            <AppLayout><ProfilePage /></AppLayout>
          </ProtectedRoute>
        } />
        <Route path="/leaderboard" element={
          <ProtectedRoute>
            <AppLayout><LeaderboardPage /></AppLayout>
          </ProtectedRoute>
        } />

        {/* Protected — admin only */}
        <Route path="/admin" element={
          <AdminRoute>
            <AppLayout><AdminDashboard /></AppLayout>
          </AdminRoute>
        } />
        <Route path="/admin/users" element={
          <AdminRoute>
            <AppLayout><AdminUsers /></AppLayout>
          </AdminRoute>
        } />
        <Route path="/admin/config" element={
          <AdminRoute>
            <AppLayout><AdminConfig /></AppLayout>
          </AdminRoute>
        } />
        <Route path="/admin/wheels" element={
          <AdminRoute>
            <AppLayout><AdminWheels /></AppLayout>
          </AdminRoute>
        } />

        {/* Default redirect */}
        <Route path="/"   element={<Navigate to="/lobby"  replace />} />
        <Route path="*"   element={<Navigate to="/lobby"  replace />} />
      </Routes>
    </Suspense>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <WheelProvider>
          <AppRoutes />
          <Toaster
            position="top-right"
            toastOptions={{
              style: {
                background:   '#0d0d18',
                color:        '#ffffff',
                border:       '1px solid rgba(245,197,24,0.2)',
                fontFamily:   'Rajdhani, sans-serif',
                fontSize:     '0.95rem',
                letterSpacing:'0.02em',
              },
              success: {
                iconTheme: { primary: '#f5c518', secondary: '#000' }
              },
            }}
          />
        </WheelProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
