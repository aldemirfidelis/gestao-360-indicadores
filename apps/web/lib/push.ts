'use client';

import { api } from './api';

function urlBase64ToUint8Array(base64String: string): BufferSource {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const buffer = new ArrayBuffer(raw.length);
  const output = new Uint8Array(buffer);
  for (let i = 0; i < raw.length; i += 1) output[i] = raw.charCodeAt(i);
  return output as BufferSource;
}

export function pushSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

export function notificationPermission(): NotificationPermission | 'unsupported' {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported';
  return Notification.permission;
}

export type EnableResult = { ok: boolean; reason?: 'unsupported' | 'denied' | 'not-configured' | 'error' };

/** Pede permissao, assina o Web Push e registra a inscricao no backend (vinculada ao usuario). */
export async function enablePushNotifications(): Promise<EnableResult> {
  try {
    if (!pushSupported()) return { ok: false, reason: 'unsupported' };
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return { ok: false, reason: 'denied' };

    const reg = await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      const { publicKey } = await api<{ publicKey: string | null }>('/push/public-key');
      if (!publicKey) return { ok: false, reason: 'not-configured' };
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });
    }
    await api('/push/subscribe', { method: 'POST', json: sub.toJSON() });
    return { ok: true };
  } catch (err) {
    return { ok: false, reason: 'error' };
  }
}

/** Dispara uma notificacao de teste pelo backend para validar a configuracao. */
export async function sendTestPush(): Promise<void> {
  await api('/push/test', { method: 'POST' });
}
