/**
 * Rascunho do preenchimento em andamento.
 *
 * Em campo, tirar foto no celular manda o navegador para segundo plano enquanto
 * a câmera abre. Sob pressão de memória o Android/iOS descarta a aba, e ao
 * voltar o navegador RECARREGA a página: o React perde todo o estado e o técnico
 * cai de volta na lista de formulários com o checklist em branco.
 *
 * Não dá para impedir o sistema operacional de descartar a aba — o que dá é
 * sobreviver a isso. A cada mudança o preenchimento é gravado no aparelho e,
 * quando a tela de preencher abre de novo, ele volta de onde parou.
 *
 * Vai em IndexedDB e não em localStorage porque as fotos entram junto: uma foto
 * comprimida em base64 passa de 400 KB, e dez delas estouram a cota de ~5 MB do
 * localStorage — justamente no caso em que o rascunho mais importa.
 */

const DB_NAME = 'g360-forms';
const DB_VERSION = 1;
const STORE = 'submission-drafts';
/** Rascunho velho é lixo: uma inspeção não fica dias em aberto. */
const MAX_AGE_MS = 48 * 60 * 60 * 1000;

export interface SubmissionDraft {
  templateId: string;
  updatedAt: number;
  answers: Record<string, string>;
  notes: string;
  /** `Participant[]` e `CapturedPhoto[]` da tela; guardados como vieram. */
  participants: unknown[];
  photos: unknown[];
  execution: { areaId: string; sectorId: string };
}

function openDb(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === 'undefined') return Promise.resolve(null);
  return new Promise((resolve) => {
    let request: IDBOpenDBRequest;
    try {
      request = indexedDB.open(DB_NAME, DB_VERSION);
    } catch {
      resolve(null);
      return;
    }
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'templateId' });
    };
    request.onsuccess = () => resolve(request.result);
    // Navegador em modo privado/sem cota: o preenchimento segue normal, só não
    // sobrevive a um recarregamento.
    request.onerror = () => resolve(null);
    request.onblocked = () => resolve(null);
  });
}

function runTx<T>(mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest<T>): Promise<T | null> {
  return openDb().then(
    (db) =>
      new Promise<T | null>((resolve) => {
        if (!db) {
          resolve(null);
          return;
        }
        try {
          const tx = db.transaction(STORE, mode);
          const request = action(tx.objectStore(STORE));
          request.onsuccess = () => resolve(request.result ?? null);
          request.onerror = () => resolve(null);
          tx.oncomplete = () => db.close();
        } catch {
          resolve(null);
        }
      }),
  );
}

export async function saveSubmissionDraft(draft: SubmissionDraft): Promise<void> {
  await runTx('readwrite', (store) => store.put(draft));
}

/** Devolve o rascunho do modelo, descartando o que já passou da validade. */
export async function loadSubmissionDraft(templateId: string): Promise<SubmissionDraft | null> {
  const draft = (await runTx<SubmissionDraft>('readonly', (store) => store.get(templateId))) as SubmissionDraft | null;
  if (!draft) return null;
  if (Date.now() - (draft.updatedAt ?? 0) > MAX_AGE_MS) {
    await clearSubmissionDraft(templateId);
    return null;
  }
  return draft;
}

export async function clearSubmissionDraft(templateId: string): Promise<void> {
  await runTx('readwrite', (store) => store.delete(templateId));
}

/** O rascunho tem algo digitado? (evita "recuperar" um formulário em branco) */
export function draftHasContent(draft: SubmissionDraft): boolean {
  if (draft.notes.trim()) return true;
  if (draft.photos.length > 0 || draft.participants.length > 0) return true;
  if (draft.execution.areaId || draft.execution.sectorId) return true;
  return Object.values(draft.answers ?? {}).some((value) => String(value ?? '').trim());
}
