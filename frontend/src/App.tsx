import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './context/AuthContext';
import AppLayout from './components/layout/AppLayout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import CRM from './pages/CRM';
import Projects from './pages/Projects';
import SupportTickets from './pages/SupportTickets';
import Finance from './pages/Finance';
import Inventory from './pages/Inventory';
import Employees from './pages/Employees';
import ISP from './pages/ISP';
import Contracts from './pages/Contracts';
import Documents from './pages/Documents';
import Reports from './pages/Reports';
import Calendar from './pages/Calendar';

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 4000,
            style: { borderRadius: '12px', fontSize: '14px' },
          }}
        />
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<AppLayout />}>
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="crm" element={<CRM />} />
            <Route path="projects" element={<Projects />} />
            <Route path="tickets" element={<SupportTickets />} />
            <Route path="finance" element={<Finance />} />
            <Route path="inventory" element={<Inventory />} />
            <Route path="employees" element={<Employees />} />
            <Route path="isp" element={<ISP />} />
            <Route path="contracts" element={<Contracts />} />
            <Route path="documents" element={<Documents />} />
            <Route path="calendar" element={<Calendar />} />
            <Route path="reports" element={<Reports />} />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
