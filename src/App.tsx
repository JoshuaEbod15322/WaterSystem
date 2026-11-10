import { useEffect } from 'react'
import {
  Navigate,
  Route,
  Routes,
  useLocation,
} from 'react-router-dom'
import { useAuth } from './contexts/AuthContext'
import { ROLE_HOME } from './utils/constants'
import { FullPageSpinner } from './components/common/ui'
import {
  GuestOnly,
  ProtectedRoute,
} from './components/common/ProtectedRoute'
import { AdminLayout } from './layouts/AdminLayout'
import { CustomerLayout } from './layouts/CustomerLayout'
import { DriverLayout } from './layouts/DriverLayout'
import { LandingPage } from './pages/public/LandingPage'
import { LoginPage } from './pages/auth/LoginPage'
import { SignupPage } from './pages/auth/SignupPage'
import { NotFoundPage } from './pages/NotFoundPage'
import { AdminDashboardPage } from './pages/admin/DashboardPage'
import { AdminOrdersPage } from './pages/admin/OrdersPage'
import { AdminOrderDetailPage } from './pages/admin/OrderDetailPage'
import { AdminCustomersPage } from './pages/admin/CustomersPage'
import { AdminDriversPage } from './pages/admin/DriversPage'
import { AdminPricingPage } from './pages/admin/PricingPage'
import { AdminDistanceRulesPage } from './pages/admin/DistanceRulesPage'
import { AdminSchedulesPage } from './pages/admin/SchedulesPage'
import { AdminReportsPage } from './pages/admin/ReportsPage'
import { AdminRoutesPage } from './pages/admin/RoutesPage'
import { AdminSettingsPage } from './pages/admin/SettingsPage'
import { CustomerDashboardPage } from './pages/customer/DashboardPage'
import { CustomerOrderWaterPage } from './pages/customer/OrderWaterPage'
import { PaymentPage } from './pages/customer/PaymentPage'
import { CustomerOrdersPage } from './pages/customer/OrdersPage'
import { CustomerOrderDetailPage } from './pages/customer/OrderDetailPage'
import { CustomerProfilePage } from './pages/customer/ProfilePage'
import { DriverPendingOrdersPage } from './pages/driver/PendingOrdersPage'
import { DriverActiveRoutePage } from './pages/driver/ActiveRoutePage'
import { DriverDeliveryPage } from './pages/driver/DeliveryPage'
import { DriverHistoryPage } from './pages/driver/HistoryPage'

function ScrollToTop() {
  const { pathname } = useLocation()

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' })
  }, [pathname])

  return null
}

/** Send signed-in users straight to their role dashboard. */
function HomeRedirect() {
  const { session, profile, loading, configured } = useAuth()

  if (!configured) return <LandingPage />
  if (loading && session && !profile) {
    return <FullPageSpinner label="Opening your dashboard…" />
  }
  if (session && profile) {
    return <Navigate to={ROLE_HOME[profile.role]} replace />
  }
  return <LandingPage />
}

export default function App() {
  return (
    <>
      <ScrollToTop />
      <Routes>
        <Route path="/" element={<HomeRedirect />} />
        <Route
          path="/login"
          element={
            <GuestOnly>
              <LoginPage />
            </GuestOnly>
          }
        />
        <Route
          path="/signup"
          element={
            <GuestOnly>
              <SignupPage />
            </GuestOnly>
          }
        />

        <Route
          path="/admin"
          element={
            <ProtectedRoute role="admin">
              <AdminLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<AdminDashboardPage />} />
          <Route path="orders" element={<AdminOrdersPage />} />
          <Route path="orders/:orderId" element={<AdminOrderDetailPage />} />
          <Route path="customers" element={<AdminCustomersPage />} />
          <Route path="drivers" element={<AdminDriversPage />} />
          <Route path="pricing" element={<AdminPricingPage />} />
          <Route path="distance-rules" element={<AdminDistanceRulesPage />} />
          <Route path="schedules" element={<AdminSchedulesPage />} />
          <Route path="routes" element={<AdminRoutesPage />} />
          <Route path="reports" element={<AdminReportsPage />} />
          <Route path="settings" element={<AdminSettingsPage />} />
        </Route>

        <Route
          path="/customer"
          element={
            <ProtectedRoute role="customer">
              <CustomerLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<CustomerDashboardPage />} />
          <Route path="order" element={<CustomerOrderWaterPage />} />
          <Route path="checkout/:orderId" element={<PaymentPage />} />
          <Route path="orders" element={<CustomerOrdersPage />} />
          <Route path="orders/:orderId" element={<CustomerOrderDetailPage />} />
          <Route path="profile" element={<CustomerProfilePage />} />
        </Route>

        <Route
          path="/driver"
          element={
            <ProtectedRoute role="driver">
              <DriverLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<DriverPendingOrdersPage />} />
          <Route path="route" element={<DriverActiveRoutePage />} />
          <Route path="deliveries/:orderId" element={<DriverDeliveryPage />} />
          <Route path="history" element={<DriverHistoryPage />} />
        </Route>

        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </>
  )
}
