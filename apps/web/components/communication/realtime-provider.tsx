'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState, ReactNode } from 'react';
import type { Socket } from 'socket.io-client';
import { useAuth } from '@/components/auth/auth-provider';
import { getSocket, disconnectSocket } from '@/lib/socket';
import { WS, type PresenceStatus } from '@/lib/communication/events';

interface RealtimeCtx {
  socket: Socket | null;
  connected: boolean;
  onlineCount: number;
  myStatus: PresenceStatus;
  presenceOf: (userId: string, fallback?: PresenceStatus) => PresenceStatus;
  setStatus: (status: PresenceStatus) => void;
}

const Ctx = createContext<RealtimeCtx | null>(null);

const HEARTBEAT_MS = 25_000;
const IDLE_MS = 3 * 60_000;

export function RealtimeProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [onlineCount, setOnlineCount] = useState(0);
  const [myStatus, setMyStatus] = useState<PresenceStatus>('OFFLINE');
  const [presence, setPresence] = useState<Record<string, PresenceStatus>>({});
  const lastActivity = useRef<number>(Date.now());

  useEffect(() => {
    if (!user?.id) {
      disconnectSocket();
      setSocket(null);
      setConnected(false);
      setMyStatus('OFFLINE');
      return;
    }

    const s = getSocket();
    setSocket(s);

    const markActive = () => {
      lastActivity.current = Date.now();
    };
    window.addEventListener('mousemove', markActive, { passive: true });
    window.addEventListener('keydown', markActive);
    window.addEventListener('click', markActive);
    window.addEventListener('visibilitychange', markActive);

    const handleUnload = () => {
      disconnectSocket();
    };
    window.addEventListener('beforeunload', handleUnload);
    window.addEventListener('pagehide', handleUnload);

    const isActive = () =>
      typeof document !== 'undefined' &&
      document.visibilityState === 'visible' &&
      Date.now() - lastActivity.current < IDLE_MS;

    const onConnect = () => {
      setConnected(true);
      setMyStatus('ONLINE');
      s.emit(WS.PRESENCE_HEARTBEAT, { active: true });
    };
    const onDisconnect = () => setConnected(false);
    const onCount = (p: { count: number }) => setOnlineCount(p?.count ?? 0);
    const onPresence = (p: { userId: string; status: PresenceStatus }) => {
      if (!p?.userId) return;
      setPresence((prev) => ({ ...prev, [p.userId]: p.status }));
      if (p.userId === user.id) setMyStatus(p.status);
    };

    s.on('connect', onConnect);
    s.on('disconnect', onDisconnect);
    s.on(WS.PRESENCE_ONLINE_COUNT, onCount);
    s.on(WS.PRESENCE_UPDATED, onPresence);
    s.connect();

    const beat = setInterval(() => {
      if (s.connected) s.emit(WS.PRESENCE_HEARTBEAT, { active: isActive() });
    }, HEARTBEAT_MS);

    return () => {
      clearInterval(beat);
      window.removeEventListener('mousemove', markActive);
      window.removeEventListener('keydown', markActive);
      window.removeEventListener('click', markActive);
      window.removeEventListener('visibilitychange', markActive);
      window.removeEventListener('beforeunload', handleUnload);
      window.removeEventListener('pagehide', handleUnload);
      s.off('connect', onConnect);
      s.off('disconnect', onDisconnect);
      s.off(WS.PRESENCE_ONLINE_COUNT, onCount);
      s.off(WS.PRESENCE_UPDATED, onPresence);
    };
  }, [user?.id]);

  const presenceOf = useCallback(
    (userId: string, fallback: PresenceStatus = 'OFFLINE') => presence[userId] ?? fallback,
    [presence],
  );

  const setStatus = useCallback(
    (status: PresenceStatus) => {
      socket?.emit(WS.PRESENCE_SET_STATUS, { status });
      setMyStatus(status);
    },
    [socket],
  );

  return (
    <Ctx.Provider value={{ socket, connected, onlineCount, myStatus, presenceOf, setStatus }}>
      {children}
    </Ctx.Provider>
  );
}

export function useRealtime(): RealtimeCtx {
  const ctx = useContext(Ctx);
  if (!ctx) {
    // Fallback no-op: componentes podem ser usados fora do provider sem quebrar.
    return {
      socket: null,
      connected: false,
      onlineCount: 0,
      myStatus: 'OFFLINE',
      presenceOf: (_id, fallback = 'OFFLINE') => fallback,
      setStatus: () => undefined,
    };
  }
  return ctx;
}
