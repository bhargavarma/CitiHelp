import type { ReactNode } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { Layout } from './components/Layout';
import { AdminLayout } from './components/AdminLayout';
import { Landing } from './pages/Landing';
import { Login } from './pages/Login';
import { Register } from './pages/Register';
import { NotFound } from './pages/NotFound';
import { CitizenDashboard } from './pages/citizen/Dashboard';
import { ServiceDirectory } from './pages/citizen/ServiceDirectory';
import { ServiceDetail } from './pages/citizen/ServiceDetail';
import { AIAssistant } from './pages/citizen/AIAssistant';
import { SubmitGrievance } from './pages/citizen/SubmitGrievance';
import { MyGrievances } from './pages/citizen/MyGrievances';
import { GrievanceDetail } from './pages/citizen/GrievanceDetail';
import { Profile } from './pages/citizen/Profile';
import { AdminDashboard } from './pages/admin/AdminDashboard';
import { AdminGrievances } from './pages/admin/AdminGrievances';
import { AdminGrievanceDetail } from './pages/admin/AdminGrievanceDetail';
import { AdminProfile } from './pages/admin/AdminProfile';

const CitizenLayout = ({ children }: { children: ReactNode }) => (
  <ProtectedRoute requireCitizen>
    <Layout>{children}</Layout>
  </ProtectedRoute>
);

const AdminRoute = ({ children }: { children: ReactNode }) => (
  <ProtectedRoute requireAdmin>
    <AdminLayout>{children}</AdminLayout>
  </ProtectedRoute>
);

function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <AuthProvider>
          <Routes>
            {/* Public routes */}
            <Route path="/" element={<Landing />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />

            {/* Public service directory (read-only) */}
            <Route
              path="/services"
              element={
                <Layout>
                  <ServiceDirectory />
                </Layout>
              }
            />
            <Route
              path="/services/:id"
              element={
                <Layout>
                  <ServiceDetail />
                </Layout>
              }
            />

            {/* Citizen routes */}
            <Route
              path="/dashboard"
              element={
                <CitizenLayout>
                  <CitizenDashboard />
                </CitizenLayout>
              }
            />
            <Route
              path="/assistant"
              element={
                <CitizenLayout>
                  <AIAssistant />
                </CitizenLayout>
              }
            />
            <Route
              path="/grievances/new"
              element={
                <CitizenLayout>
                  <SubmitGrievance />
                </CitizenLayout>
              }
            />
            <Route
              path="/grievances"
              element={
                <CitizenLayout>
                  <MyGrievances />
                </CitizenLayout>
              }
            />
            <Route
              path="/grievances/:id"
              element={
                <CitizenLayout>
                  <GrievanceDetail />
                </CitizenLayout>
              }
            />
            <Route
              path="/profile"
              element={
                <CitizenLayout>
                  <Profile />
                </CitizenLayout>
              }
            />

            {/* Administrator routes */}
            <Route
              path="/admin"
              element={
                <AdminRoute>
                  <AdminDashboard />
                </AdminRoute>
              }
            />
            <Route path="/admin/analytics" element={<Navigate to="/admin" replace />} />
            <Route
              path="/admin/grievances"
              element={
                <AdminRoute>
                  <AdminGrievances />
                </AdminRoute>
              }
            />
            <Route
              path="/admin/grievances/pending"
              element={
                <AdminRoute>
                  <AdminGrievances
                    title="Pending Grievances"
                    section="Pending Queue"
                    description="Complaints still awaiting resolution: submitted, under review and in progress."
                    statusGroup="Submitted,Under Review,In Progress"
                    statusOptions={['Submitted', 'Under Review', 'In Progress']}
                    emptyTitle="No pending grievances"
                    emptyMessage="Every lodged complaint has been resolved or rejected."
                  />
                </AdminRoute>
              }
            />
            <Route
              path="/admin/grievances/resolved"
              element={
                <AdminRoute>
                  <AdminGrievances
                    title="Resolved Grievances"
                    section="Resolved"
                    description="Complaints closed with a confirmed resolution and administrative remarks."
                    statusGroup="Resolved"
                    statusOptions={['Resolved']}
                    emptyTitle="No resolved grievances"
                    emptyMessage="Resolved complaints will appear here once action is completed."
                  />
                </AdminRoute>
              }
            />
            <Route
              path="/admin/grievances/rejected"
              element={
                <AdminRoute>
                  <AdminGrievances
                    title="Rejected Grievances"
                    section="Rejected"
                    description="Complaints closed as outside jurisdiction, duplicate or otherwise not actionable."
                    statusGroup="Rejected"
                    statusOptions={['Rejected']}
                    emptyTitle="No rejected grievances"
                    emptyMessage="Rejected complaints will appear here with their audit remarks."
                  />
                </AdminRoute>
              }
            />
            <Route
              path="/admin/grievances/:id"
              element={
                <AdminRoute>
                  <AdminGrievanceDetail />
                </AdminRoute>
              }
            />
            <Route
              path="/admin/services"
              element={
                <AdminRoute>
                  <ServiceDirectory />
                </AdminRoute>
              }
            />
            <Route
              path="/admin/profile"
              element={
                <AdminRoute>
                  <AdminProfile />
                </AdminRoute>
              }
            />

            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </ToastProvider>
    </BrowserRouter>
  );
}

export default App;
