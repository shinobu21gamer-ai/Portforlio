import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { ToastProvider } from './components/Toast';
import ErrorBoundary from './components/ErrorBoundary';
import ProtectedRoute from './components/ProtectedRoute';
import { GlobalSearchProvider } from './context/GlobalSearchContext';
import { ThemeProvider } from './context/ThemeContext';
import HrmsLayout from './layouts/HrmsLayout';
import EmployeeLayout from './layouts/EmployeeLayout';
import InventoryStaffLayout from './layouts/InventoryStaffLayout';
import LoadingSkeleton from './components/LoadingSkeleton';
import useAuthStore from './store/authStore';

const PosEmbed = lazy(() => import('./pages/PosEmbed'));

const Login = lazy(() => import('./pages/Login'));
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'));
const ResetPassword = lazy(() => import('./pages/ResetPassword'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Employees = lazy(() => import('./pages/Employees'));
const EmployeeDetail = lazy(() => import('./pages/EmployeeDetail'));
const Departments = lazy(() => import('./pages/Departments'));
const Attendance = lazy(() => import('./pages/Attendance'));
const AttendanceCalendar = lazy(() => import('./pages/AttendanceCalendar'));
const Schedules = lazy(() => import('./pages/Schedules'));
const JobPostings = lazy(() => import('./pages/JobPostings'));
const JobPortal = lazy(() => import('./pages/JobPortal'));
const Interviews = lazy(() => import('./pages/Interviews'));
const Contracts = lazy(() => import('./pages/Contracts'));
const Leaves = lazy(() => import('./pages/Leaves'));
const Payroll = lazy(() => import('./pages/Payroll'));
const NotFound = lazy(() => import('./pages/NotFound'));
const MyProfile = lazy(() => import('./pages/MyProfile'));
const MyAttendance = lazy(() => import('./pages/MyAttendance'));
const MyLeaves = lazy(() => import('./pages/MyLeaves'));
const MyPayslips = lazy(() => import('./pages/MyPayslips'));
const MyContracts = lazy(() => import('./pages/MyContracts'));
const InventoryDashboard = lazy(() => import('./pages/InventoryDashboard'));
const InvProducts = lazy(() => import('./pages/InvProducts'));
const InvCategories = lazy(() => import('./pages/InvCategories'));
const InvSuppliers = lazy(() => import('./pages/InvSuppliers'));
const InvInventory = lazy(() => import('./pages/InvInventory'));
const InvPurchases = lazy(() => import('./pages/InvPurchases'));

const PageLoader = () => (
  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
    <LoadingSkeleton rows={4} />
  </div>
);

function RoleRedirect() {
  const user = useAuthStore(s => s.user);
  const slug = user?.role?.slug;
  // POS roles: cashier, manager, inventory_staff -> POS
  // HRMS roles: admin, hr, employee -> HRMS Dashboard
  if (slug === 'cashier' || slug === 'manager' || slug === 'inventory_staff') {
    return <Navigate to="/pos" replace />;
  }
  // The HR layout and every route inside it is gated to admin/hr/manager, and
  // /my-profile is gated to employee/cashier/inventory_staff. So an employee —
  // or an account with a missing or unrecognised role — has no landing page.
  // Send them to the login screen rather than bouncing between two routes that
  // would each render "Access Denied".
  if (slug === 'employee') {
    return <Navigate to="/my-profile" replace />;
  }
  if (!slug || !['admin', 'hr', 'manager'].includes(slug)) {
    return <Navigate to="/login" replace />;
  }
  return (
    <HrmsLayout>
      <Suspense fallback={<PageLoader />}><Dashboard /></Suspense>
    </HrmsLayout>
  );
}

function SelfServiceLayout({ children }) {
  const role = useAuthStore(s => s.user?.role?.slug);
  return role === 'inventory_staff' ? <InventoryStaffLayout>{children}</InventoryStaffLayout> : <EmployeeLayout>{children}</EmployeeLayout>;
}

export default function App() {
  return (
    <ThemeProvider>
      <ErrorBoundary>
        <ToastProvider>
          <GlobalSearchProvider>
            <Routes>
          <Route path="/login" element={<Suspense fallback={<PageLoader />}><Login /></Suspense>} />
          <Route path="/forgot-password" element={<Suspense fallback={<PageLoader />}><ForgotPassword /></Suspense>} />
          <Route path="/reset-password" element={<Suspense fallback={<PageLoader />}><ResetPassword /></Suspense>} />
          <Route path="/careers" element={<Suspense fallback={<PageLoader />}><JobPortal /></Suspense>} />

          {/* POS — accessible by all authenticated roles */}
          <Route path="/pos" element={<ProtectedRoute><Suspense fallback={<PageLoader />}><PosEmbed /></Suspense></ProtectedRoute>} />

          {/* Root redirect — role-based, accessible by all */}
          <Route path="/" element={<ProtectedRoute><RoleRedirect /></ProtectedRoute>} />

          {/* HR/Admin layout routes */}
          <Route element={<ProtectedRoute allowedRoles={['admin', 'manager', 'hr']}><HrmsLayout /></ProtectedRoute>}>
            <Route path="/employees" element={<Suspense fallback={null}><Employees /></Suspense>} />
            <Route path="/employees/:id" element={<Suspense fallback={null}><EmployeeDetail /></Suspense>} />
            <Route path="/departments" element={<Suspense fallback={null}><Departments /></Suspense>} />
            <Route path="/attendance" element={<Suspense fallback={null}><Attendance /></Suspense>} />
            <Route path="/attendance/calendar" element={<Suspense fallback={null}><AttendanceCalendar /></Suspense>} />
            <Route path="/schedules" element={<Suspense fallback={null}><Schedules /></Suspense>} />
            <Route path="/jobs" element={<Suspense fallback={null}><JobPostings /></Suspense>} />
            <Route path="/interviews" element={<Suspense fallback={null}><Interviews /></Suspense>} />
            <Route path="/contracts" element={<Suspense fallback={null}><Contracts /></Suspense>} />
            <Route path="/leaves" element={<Suspense fallback={null}><Leaves /></Suspense>} />
            <Route path="/payroll" element={<Suspense fallback={null}><Payroll /></Suspense>} />
          </Route>

          {/* Employee self-service routes — layout chosen by role so staff keep their own sidebar */}
          <Route path="/my-profile" element={<ProtectedRoute allowedRoles={['employee', 'cashier', 'inventory_staff']}><SelfServiceLayout><Suspense fallback={<PageLoader />}><MyProfile /></Suspense></SelfServiceLayout></ProtectedRoute>} />
          <Route path="/my-attendance" element={<ProtectedRoute allowedRoles={['employee', 'cashier', 'inventory_staff']}><SelfServiceLayout><Suspense fallback={<PageLoader />}><MyAttendance /></Suspense></SelfServiceLayout></ProtectedRoute>} />
          <Route path="/my-leaves" element={<ProtectedRoute allowedRoles={['employee', 'cashier', 'inventory_staff']}><SelfServiceLayout><Suspense fallback={<PageLoader />}><MyLeaves /></Suspense></SelfServiceLayout></ProtectedRoute>} />
          <Route path="/my-payslips" element={<ProtectedRoute allowedRoles={['employee', 'cashier', 'inventory_staff']}><SelfServiceLayout><Suspense fallback={<PageLoader />}><MyPayslips /></Suspense></SelfServiceLayout></ProtectedRoute>} />
          <Route path="/my-contracts" element={<ProtectedRoute allowedRoles={['employee', 'cashier', 'inventory_staff']}><SelfServiceLayout><Suspense fallback={<PageLoader />}><MyContracts /></Suspense></SelfServiceLayout></ProtectedRoute>} />

          {/* Inventory staff layout routes */}
          <Route element={<ProtectedRoute allowedRoles={['inventory_staff']}><InventoryStaffLayout /></ProtectedRoute>}>
            <Route path="/inventory-dashboard" element={<Suspense fallback={null}><InventoryDashboard /></Suspense>} />
            <Route path="/products" element={<Suspense fallback={null}><InvProducts /></Suspense>} />
            <Route path="/categories" element={<Suspense fallback={null}><InvCategories /></Suspense>} />
            <Route path="/suppliers" element={<Suspense fallback={null}><InvSuppliers /></Suspense>} />
            <Route path="/inventory" element={<Suspense fallback={null}><InvInventory /></Suspense>} />
            <Route path="/purchases" element={<Suspense fallback={null}><InvPurchases /></Suspense>} />
          </Route>

          <Route path="*" element={<Suspense fallback={<PageLoader />}><NotFound /></Suspense>} />
          </Routes>
          </GlobalSearchProvider>
        </ToastProvider>
      </ErrorBoundary>
    </ThemeProvider>
  );
}
