import { Outlet } from 'react-router-dom';
import { Navbar } from './Navbar';
import { ToastViewport } from '../ui/Toast';
import { ChatbotOverlay } from '../chatbot/ChatbotOverlay';

export function AppLayout() {
  return (
    <div className="min-h-screen bg-bg">
      <Navbar />
      <main>
        <Outlet />
      </main>
      <ChatbotOverlay />
      <ToastViewport />
    </div>
  );
}
