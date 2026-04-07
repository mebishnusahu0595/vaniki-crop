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

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route element={<AdminLayout />}>
          <Route path="/" element={<DashboardPage />} />
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
          <Route path="/settings" element={<SettingsPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
