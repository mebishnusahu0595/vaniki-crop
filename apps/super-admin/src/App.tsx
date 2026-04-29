import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AdminLayout } from './layouts/AdminLayout';
import DashboardPage from './pages/Dashboard';
import LoginPage from './pages/Login';
import ProductsPage from './pages/Products';
import ProductFormPage from './pages/ProductForm';
import CategoriesPage from './pages/Categories';
import OrdersPage from './pages/Orders';
import CustomersPage from './pages/Customers';
import CouponsPage from './pages/Coupons';
import ReviewsPage from './pages/Reviews';
import BannersPage from './pages/Banners';
import PaymentsPage from './pages/Payments';
import SettingsPage from './pages/Settings';
import ProfileSettingsPage from './pages/ProfileSettings';
import StoresPage from './pages/Stores';
import AdminsPage from './pages/Admins';
import TestimonialsPage from './pages/Testimonials';
import ProductRequestsPage from './pages/ProductRequests';
import LoyaltyPage from './pages/Loyalty';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/superadmin" element={<LoginPage />} />
        <Route path="/login" element={<Navigate to="/superadmin" replace />} />
        <Route element={<AdminLayout />}>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/stores" element={<StoresPage />} />
          <Route path="/admins" element={<AdminsPage />} />
          <Route path="/product-requests" element={<ProductRequestsPage />} />
          <Route path="/products" element={<ProductsPage />} />
          <Route path="/products/new" element={<ProductFormPage />} />
          <Route path="/products/:id/edit" element={<ProductFormPage />} />
          <Route path="/categories" element={<CategoriesPage />} />
          <Route path="/orders" element={<OrdersPage />} />
          <Route path="/customers" element={<CustomersPage />} />
          <Route path="/coupons" element={<CouponsPage />} />
          <Route path="/reviews" element={<ReviewsPage />} />
          <Route path="/banners" element={<BannersPage />} />
          <Route path="/payments" element={<PaymentsPage />} />
          <Route path="/testimonials" element={<TestimonialsPage />} />
          <Route path="/loyalty" element={<LoyaltyPage />} />
          <Route path="/site-settings" element={<SettingsPage />} />
          <Route path="/settings" element={<ProfileSettingsPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
