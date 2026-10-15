import { io, type Socket } from 'socket.io-client';
import { create } from 'zustand';
import type { ChatHistory } from '@kosmatch/shared';
import { post } from '../api/client';
import { useAuthStore } from '../stores/authStore';

export type ConnectionStatus = 'connected' | 'connecting';

export const useConnectionStore = create<{ status: ConnectionStatus }>(() => ({ status: 'connecting' }));

let socket: Socket | null = null;
let socketToken: string | null = null;

export function connectSocket(token: string): Socket {
  if (socket && socketToken === token) return socket;
  socket?.disconnect();
  useConnectionStore.setState({ status: 'connecting' });
  socketToken = token;
  socket = io({
    auth: { token },
    reconnection: true,
    reconnectionDelay: 500,
    reconnectionDelayMax: 3000,
  });
  socket.on('connect', () => useConnectionStore.setState({ status: 'connected' }));
  socket.on('disconnect', () => useConnectionStore.setState({ status: 'connecting' }));
  socket.on('connect_error', () => useConnectionStore.setState({ status: 'connecting' }));
  return socket;
}

export function disconnectSocket(): void {
  socket?.disconnect();
  socket = null;
  socketToken = null;
  useConnectionStore.setState({ status: 'connecting' });
}

export const getSocket = (): Socket | null => socket;

// Drop the connection when the user logs out.
useAuthStore.subscribe((state) => {
  if (!state.token) disconnectSocket();
});

type Ack = { ok: true; message: ChatHistory } | { ok: false; error: string };

/** Sends over Socket.IO when connected, otherwise falls back to the REST endpoint. */
export async function sendChatMessage(receiverId: string, pesan: string): Promise<ChatHistory> {
  if (socket?.connected) {
    const ack = (await socket.timeout(5000).emitWithAck('message:send', { receiverId, pesan })) as Ack;
    if (!ack.ok) throw new Error(ack.error);
    return ack.message;
  }
  return post<ChatHistory>(`/chats/${receiverId}`, { pesan });
}
