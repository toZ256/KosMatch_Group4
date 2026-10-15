import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { AppLayout } from './components/layout/AppLayout';
import { ProtectedRoute } from './components/layout/ProtectedRoute';
import { LandingPage } from './pages/LandingPage';
import { LoginPage, RegisterPage } from './pages/AuthPages';
import { SearchPage } from './pages/SearchPage';
import { KosDetailPage } from './pages/KosDetailPage';
import { BookmarkPage, NotFoundPage, NotificationsPage } from './pages/SimplePages';
import { ChatPage } from './pages/ChatPage';
import { OwnerDashboardPage, OwnerKosFormPage } from './pages/OwnerPages';

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppLayout />}>
          {/* Public routes */}
          <Route index element={<LandingPage />} />
          <Route path="login" element={<LoginPage />} />
          <Route path="register" element={<RegisterPage />} />
          <Route path="cari" element={<SearchPage />} />
          <Route path="kos/:id" element={<KosDetailPage />} />
          <Route path="notifikasi" element={<NotificationsPage />} />

          {/* Tenant protected routes */}
          <Route element={<ProtectedRoute />}>
            <Route path="tersimpan" element={<BookmarkPage />} />
            <Route path="chat" element={<ChatPage />} />
            <Route path="chat/:userId" element={<ChatPage />} />
          </Route>

          {/* Owner protected routes */}
          <Route element={<ProtectedRoute role="owner" />}>
            <Route path="owner/kos" element={<OwnerDashboardPage />} />
            <Route path="owner/kos/baru" element={<OwnerKosFormPage />} />
            <Route path="owner/kos/:id/edit" element={<OwnerKosFormPage />} />
          </Route>

          {/* Catch-all */}
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
