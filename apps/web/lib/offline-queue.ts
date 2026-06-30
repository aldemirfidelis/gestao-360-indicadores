import { api } from '@/lib/api';

/**
 * Fila offline genérica (IndexedDB) para uso em campo (rondas/ocorrências/inspeções
 * sem internet). Cada item guarda a chamada de API original; ao reconectar, a fila
 * é reenviada. Operações de campo são idempotentes/dedupáveis (visita = Set no
 * servidor; ocorrência via offline-sync dedup por localId).
 */

const DB_NAME = 'g360-offline';
const STORE = 'queue';
const DB_VERSION = 1;

export interface QueuedRequest {
  id: string; // localId (uuid) — também usado para dedupe no servidor quando aplicável
  path: string;
  method: string;
  body?: unknown;
  label: string;
  createdAt: number;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'id' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function run<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const t = db.transaction(STORE, mode);
        const r = fn(t.objectStore(STORE));
        r.onsuccess = () => resolve(r.result as T);
        r.onerror = () => reject(r.error);
      }),
  );
}

type Listener = () => void;
const listeners = new Set<Listener>();
export function onQueueChange(l: Listener): () => void {
  listeners.add(l);
  return () => { listeners.delete(l); };
}
function notify() { listeners.forEach((l) => l()); }

export async function listQueue(): Promise<QueuedRequest[]> {
  const all = await run<QueuedRequest[]>('readonly', (s) => s.getAll());
  return (all ?? []).sort((a, b) => a.createdAt - b.createdAt);
}

export async function pendingCount(): Promise<number> {
  try { return await run<number>('readonly', (s) => s.count()); } catch { return 0; }
}

async function put(rec: QueuedRequest) { await run('readwrite', (s) => s.put(rec)); notify(); }
async function remove(id: string) { await run('readwrite', (s) => s.delete(id)); notify(); }

function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `q_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

function isNetworkError(e: any): boolean {
  if (e && typeof e.status === 'number') return e.status === 0; // ApiError com status HTTP = não é rede
  return true; // sem status (fetch lançou) = rede/offline
}

/**
 * Tenta enviar; se offline ou falha de rede, enfileira para reenvio. Erros de
 * validação (4xx) são propagados para o chamador tratar.
 */
export async function sendOrQueue(req: { path: string; method?: string; body?: unknown; label: string; id?: string }): Promise<{ status: 'sent' | 'queued'; result?: unknown }> {
  const id = req.id ?? newId();
  const method = req.method ?? 'POST';
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    await put({ id, path: req.path, method, body: req.body, label: req.label, createdAt: Date.now() });
    return { status: 'queued' };
  }
  try {
    const result = await api(req.path, { method: method as any, json: req.body as any });
    return { status: 'sent', result };
  } catch (e: any) {
    if (isNetworkError(e)) {
      await put({ id, path: req.path, method, body: req.body, label: req.label, createdAt: Date.now() });
      return { status: 'queued' };
    }
    throw e;
  }
}

/** Reenvia a fila em ordem. Para no primeiro erro de rede (ainda sem internet). */
export async function flush(): Promise<{ sent: number; remaining: number }> {
  const items = await listQueue();
  let sent = 0;
  for (const it of items) {
    try {
      await api(it.path, { method: it.method as any, json: it.body as any });
      await remove(it.id);
      sent += 1;
    } catch (e: any) {
      if (isNetworkError(e)) break; // segue offline; tenta de novo depois
      // Erro definitivo (4xx/conflito): descarta para não travar a fila.
      // eslint-disable-next-line no-console
      console.error('Offline: descartando item com erro definitivo:', it.label, e?.message);
      await remove(it.id);
    }
  }
  return { sent, remaining: await pendingCount() };
}

let started = false;
/** Liga o reenvio automático ao reconectar. Chamar uma vez no cliente. */
export function startOfflineSync(): void {
  if (started || typeof window === 'undefined') return;
  started = true;
  window.addEventListener('online', () => { void flush(); });
  if (navigator.onLine) void flush();
}
