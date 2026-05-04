import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AdminLayout } from './layouts/AdminLayout';
import LoginPage from './pages/Login';
import OrdersPage from './pages/Orders';
import InventoryPage from './pages/Inventory';
import ProductRequestsPage from './pages/ProductRequests';
import SettingsPage from './pages/Profile';

import RequestHistoryPage from './pages/RequestHistory';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<Navigate to="/login?mode=signup" replace />} />
        <Route element={<AdminLayout />}>
          <Route path="/" element={<Navigate to="/orders" replace />} />
          <Route path="/orders" element={<OrdersPage />} />
          <Route path="/inventory" element={<InventoryPage />} />
          <Route path="/product-requests" element={<ProductRequestsPage />} />
          <Route path="/request-history" element={<RequestHistoryPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/profile" element={<Navigate to="/settings" replace />} />
        </Route>
        <Route path="*" element={<Navigate to="/orders" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
