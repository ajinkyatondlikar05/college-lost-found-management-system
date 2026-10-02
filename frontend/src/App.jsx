import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './context/AuthContext';
import { PrivateRoute, AdminRoute } from './components/PrivateRoute';
import Navbar from './components/Navbar';
import Footer from './components/Footer';

import Home from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import ReportItem from './pages/ReportItem';
import Items from './pages/Items';
import ItemDetail from './pages/ItemDetail';
import MyReports from './pages/MyReports';
import AdminDashboard from './pages/AdminDashboard';
import AdminLogin from './pages/AdminLogin';
import UserLogin from './pages/UserLogin';

// Routes that should render without Navbar/Footer (full-screen / dedicated chrome pages)
const NO_CHROME_ROUTES = ['/', '/admin/login', '/user/login', '/dashboard'];

function AppLayout() {
  const location = useLocation();
  const hideChrome =
    NO_CHROME_ROUTES.includes(location.pathname) || location.pathname.startsWith('/admin');

  return (
    <>
      {!hideChrome && <Navbar />}
      <main>
        <Routes>
          {/* Landing / Portal Selector */}
          <Route path="/" element={<Home />} />

          {/* Portal login pages (Visme form) */}
          <Route path="/admin/login" element={<AdminLogin />} />
          <Route path="/user/login" element={<UserLogin />} />

          {/* Existing auth */}
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />

          {/* Public */}
          <Route path="/items" element={<Items />} />
          <Route path="/items/:id" element={<ItemDetail />} />

          {/* Private */}
          <Route path="/dashboard" element={<PrivateRoute><Dashboard /></PrivateRoute>} />
          <Route path="/report-lost" element={<PrivateRoute><ReportItem type="lost" /></PrivateRoute>} />
          <Route path="/report-found" element={<PrivateRoute><ReportItem type="found" /></PrivateRoute>} />
          <Route path="/my-reports" element={<PrivateRoute><MyReports /></PrivateRoute>} />

          {/* Admin dashboard & subroutes */}
          <Route path="/admin" element={<Navigate to="/admin/dashboard" replace />} />
          <Route path="/admin/dashboard" element={<AdminRoute><AdminDashboard /></AdminRoute>} />
          <Route path="/admin/:tab" element={<AdminRoute><AdminDashboard /></AdminRoute>} />

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      {!hideChrome && <Footer />}
    </>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              background: '#1E1E3F',
              color: '#F0F0FF',
              border: '1px solid rgba(108, 99, 255, 0.3)',
              borderRadius: '12px',
              fontSize: '0.875rem',
            },
            success: {
              iconTheme: { primary: '#43E97B', secondary: '#0D0D1A' },
            },
            error: {
              iconTheme: { primary: '#FF6584', secondary: '#0D0D1A' },
            },
          }}
        />
        <AppLayout />
      </BrowserRouter>
    </AuthProvider>
  );
}
