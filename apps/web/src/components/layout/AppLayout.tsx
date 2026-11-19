import { Outlet } from 'react-router-dom';
import { Navbar } from './Navbar';
import { ToastViewport } from '../ui/Toast';
import { ChatbotOverlay } from '../chatbot/ChatbotOverlay';
import { useAuthStore } from '../../stores/authStore';

export function AppLayout() {
  const user = useAuthStore((s) => s.user);
  const isOwner = user?.role === 'owner';

  return (
    <div className="min-h-screen bg-bg">
      <Navbar />
      <main>
        <Outlet />
      </main>
      {!isOwner && <ChatbotOverlay />}
      <ToastViewport />
    </div>
  );
}
