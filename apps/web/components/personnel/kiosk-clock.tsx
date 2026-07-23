'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  Camera,
  CheckCircle2,
  Fingerprint,
  KeyRound,
  Loader2,
  LockKeyhole,
  MapPin,
  RefreshCw,
  UsersRound,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

type FaceApi = typeof import('@vladmandic/face-api');

type Phase =
  | 'INITIALIZING'
  | 'SETUP'
  | 'READY'
  | 'PREPARING'
  | 'SCANNING'
  | 'SUBMITTING'
  | 'SUCCESS'
  | 'ERROR';

type KioskChallenge = {
  id: string;
  nonce: string;
  expiresAt: string;
  descriptorVersion: string;
  antiSpoofing: string;
};

type KioskPunchResult = {
  user?: { name?: string };
  entry?: {
    id?: string;
    punchedAt?: string;
    kind?: string;
    nsr?: string | number | null;
  };
  idempotent?: boolean;
};

type Position = {
  latitude: number;
  longitude: number;
  accuracy: number;
};

type CapturedFace = {
  descriptor: number[];
  faceCount: 1;
  detectionScore: number;
};

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3333/api';
const MODEL_URL = '/models/face';
const FACE_DESCRIPTOR_VERSION = 'face-api-128-v1';
const TOKEN_STORAGE_KEY = 'g360.personnel.kioskToken.v1';
const CAPTURE_TIMEOUT_MS = 25_000;
const SUCCESS_RESET_MS = 8_000;
const ERROR_RESET_MS = 10_000;

let modelPromise: Promise<FaceApi> | null = null;

async function loadFaceEngine(): Promise<FaceApi> {
  if (!modelPromise) {
    modelPromise = import('@vladmandic/face-api')
      .then(async (faceapi) => {
        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
          faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
          faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
        ]);
        return faceapi;
      })
      .catch((error) => {
        modelPromise = null;
        throw error;
      });
  }
  return modelPromise;
}

export function KioskClock() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const resetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancelledRef = useRef(false);
  const inFlightRef = useRef(false);
  // Falhas consecutivas de reconhecimento — após 3, orienta procurar o Serviço Pessoal.
  const failCountRef = useRef(0);

  const [phase, setPhase] = useState<Phase>('INITIALIZING');
  const [deviceToken, setDeviceToken] = useState('');
  const [provisioningToken, setProvisioningToken] = useState('');
  const [instruction, setInstruction] = useState('Toque no botão para registrar seu ponto');
  const [cameraActive, setCameraActive] = useState(false);
  const [position, setPosition] = useState<Position | null>(null);
  const [error, setError] = useState('');
  const [result, setResult] = useState<KioskPunchResult | null>(null);

  const clearResetTimer = useCallback(() => {
    if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
    resetTimerRef.current = null;
  }, []);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraActive(false);
  }, []);

  const resetToReady = useCallback(() => {
    clearResetTimer();
    cancelledRef.current = true;
    stopCamera();
    setError('');
    setResult(null);
    setPosition(null);
    setInstruction('Toque no botão para registrar seu ponto');
    setPhase(deviceToken ? 'READY' : 'SETUP');
  }, [clearResetTimer, deviceToken, stopCamera]);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(TOKEN_STORAGE_KEY)?.trim() ?? '';
      setDeviceToken(stored);
      setPhase(stored ? 'READY' : 'SETUP');
    } catch {
      setError('Este navegador bloqueou o armazenamento local. Autorize o armazenamento do site para provisionar o terminal.');
      setPhase('SETUP');
    }
    return () => {
      cancelledRef.current = true;
      clearResetTimer();
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, [clearResetTimer]);

  const scheduleReset = useCallback(
    (delay: number) => {
      clearResetTimer();
      resetTimerRef.current = setTimeout(resetToReady, delay);
    },
    [clearResetTimer, resetToReady],
  );

  const provision = () => {
    const token = provisioningToken.trim();
    if (token.length < 20) {
      setError('Informe o token completo fornecido pelo administrador do ponto.');
      return;
    }
    try {
      window.localStorage.setItem(TOKEN_STORAGE_KEY, token);
    } catch {
      setError('Não foi possível guardar o token neste aparelho. Verifique as permissões de armazenamento do navegador.');
      return;
    }
    setDeviceToken(token);
    setProvisioningToken('');
    setError('');
    setInstruction('Terminal pronto para registrar ponto');
    setPhase('READY');
  };

  const fail = useCallback(
    (message: string, reset = true) => {
      stopCamera();
      setError(message);
      setInstruction('PONTO NÃO REGISTRADO');
      setPhase('ERROR');
      if (reset) scheduleReset(ERROR_RESET_MS);
    },
    [scheduleReset, stopCamera],
  );

  const registerPunch = async () => {
    if (inFlightRef.current || !deviceToken || !['READY', 'ERROR', 'SUCCESS'].includes(phase)) return;
    inFlightRef.current = true;
    clearResetTimer();
    cancelledRef.current = false;
    setError('');
    setResult(null);
    setPosition(null);
    setPhase('PREPARING');
    setInstruction('Preparando a câmera e o reconhecimento...');

    let challengeCompleted = false;
    try {
      if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
        throw new Error('A câmera exige HTTPS e um navegador Android atualizado.');
      }

      const [engine, stream, location] = await Promise.all([
        loadFaceEngine(),
        navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: 'user',
            width: { ideal: 960 },
            height: { ideal: 720 },
          },
          audio: false,
        }),
        currentPositionOrNull(),
      ]);

      if (cancelledRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }

      streamRef.current = stream;
      setCameraActive(true);
      setPosition(location);
      const video = videoRef.current;
      if (!video) throw new Error('Não foi possível inicializar a visualização da câmera.');
      video.srcObject = stream;
      await video.play();

      const challenge = await kioskRequest<KioskChallenge>('/personnel/kiosk/challenge', deviceToken);
      challengeCompleted = true;
      if (challenge.descriptorVersion !== FACE_DESCRIPTOR_VERSION) {
        throw new Error('O modelo facial deste terminal precisa ser atualizado pelo administrador.');
      }

      setPhase('SCANNING');
      setInstruction('Olhe para a câmera — permaneça sozinho na imagem');
      const captured = await captureExactlyOneFace(engine, video, cancelledRef, setInstruction);

      stopCamera();
      setPhase('SUBMITTING');
      setInstruction('Identificando e registrando o ponto...');

      const punch = await kioskRequest<KioskPunchResult>('/personnel/kiosk/identify-punch', deviceToken, {
        challengeId: challenge.id,
        nonce: challenge.nonce,
        descriptorVersion: FACE_DESCRIPTOR_VERSION,
        descriptor: captured.descriptor,
        faceCount: captured.faceCount,
        detectionScore: captured.detectionScore,
        syncId: createSyncId(),
        deviceTime: new Date().toISOString(),
        ...(location ?? {}),
      });

      failCountRef.current = 0;
      setResult(punch);
      setInstruction('Ponto registrado');
      setPhase('SUCCESS');
      scheduleReset(SUCCESS_RESET_MS);
    } catch (caught) {
      if (cancelledRef.current) return;
      const normalized = normalizeKioskError(caught);
      // Falha de autenticação do próprio dispositivo exige novo provisionamento.
      if (!challengeCompleted && (normalized.status === 401 || normalized.status === 403)) {
        stopCamera();
        removeStoredToken();
        setDeviceToken('');
        setError('Token do terminal inválido, expirado ou desativado. Solicite um novo token ao administrador.');
        setInstruction('Provisionamento necessário');
        setPhase('SETUP');
        return;
      }
      failCountRef.current += 1;
      fail(
        failCountRef.current >= 3
          ? 'Não foi possível reconhecer o rosto após 3 tentativas. Procure o Serviço Pessoal da sua empresa.'
          : normalized.message,
      );
    } finally {
      inFlightRef.current = false;
    }
  };

  const cancel = () => {
    cancelledRef.current = true;
    resetToReady();
  };

  const busy = phase === 'PREPARING' || phase === 'SCANNING' || phase === 'SUBMITTING';
  const entryLabel = result?.entry?.kind === 'OUT' ? 'Saída' : 'Entrada';
  const punchedAt = result?.entry?.punchedAt ? formatClock(result.entry.punchedAt) : null;

  return (
    <main
      className="fixed inset-0 z-[100] overflow-y-auto bg-slate-950 text-white"
      style={{
        paddingTop: 'max(1rem, env(safe-area-inset-top))',
        paddingRight: 'max(1rem, env(safe-area-inset-right))',
        paddingBottom: 'max(1rem, env(safe-area-inset-bottom))',
        paddingLeft: 'max(1rem, env(safe-area-inset-left))',
      }}
    >
      <div className="mx-auto flex min-h-full w-full max-w-6xl flex-col gap-4 lg:gap-6">
        <header className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 backdrop-blur sm:px-5">
          <div className="flex min-w-0 items-center gap-3">
            <div className="rounded-xl bg-cyan-400/10 p-2.5 text-cyan-300">
              <Fingerprint className="h-6 w-6" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-base font-black tracking-tight sm:text-lg">Gestão 360 · Ponto Totem</p>
              <p className="truncate text-[11px] text-slate-400 sm:text-xs">Terminal compartilhado de registro facial</p>
            </div>
          </div>
        </header>

        <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(340px,.65fr)] lg:gap-6">
          <section className="relative min-h-[360px] overflow-hidden rounded-[1.75rem] border border-white/10 bg-slate-900 shadow-2xl sm:min-h-[480px] lg:min-h-[560px]">
            <video
              ref={videoRef}
              muted
              playsInline
              aria-label="Visualização da câmera frontal do terminal"
              className={cn(
                'absolute inset-0 h-full w-full scale-x-[-1] object-cover transition-opacity duration-300',
                cameraActive ? 'opacity-100' : 'opacity-20',
              )}
            />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(34,211,238,.12),transparent_48%),linear-gradient(to_bottom,transparent,rgba(2,6,23,.72))]" />

            <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-8">
              <div
                className={cn(
                  'h-[64%] max-h-[430px] min-h-[230px] w-[66%] max-w-[350px] rounded-[46%] border-[3px] transition-all duration-300',
                  phase === 'SUCCESS'
                    ? 'border-emerald-400 shadow-[0_0_55px_rgba(52,211,153,.32)]'
                    : phase === 'ERROR'
                      ? 'border-rose-400 shadow-[0_0_45px_rgba(251,113,133,.24)]'
                      : busy
                        ? 'border-cyan-300 shadow-[0_0_50px_rgba(103,232,249,.26)]'
                        : 'border-white/35',
                )}
              />
            </div>

            {!cameraActive && phase !== 'SUCCESS' && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="rounded-full border border-white/10 bg-slate-950/70 p-6 text-slate-500">
                  {phase === 'SETUP' ? <LockKeyhole className="h-16 w-16" /> : <Camera className="h-16 w-16" />}
                </div>
              </div>
            )}

            {phase === 'SUCCESS' && (
              <div className="absolute inset-0 flex items-center justify-center bg-emerald-950/82 p-6 text-center backdrop-blur-sm">
                <div>
                  <CheckCircle2 className="mx-auto h-20 w-20 text-emerald-300" />
                  <p className="mt-5 text-2xl font-black sm:text-4xl">{entryLabel} registrada</p>
                  <p className="mt-2 text-lg font-semibold text-emerald-100 sm:text-2xl">{result?.user?.name ?? 'Colaborador identificado'}</p>
                  <div className="mt-4 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-sm text-emerald-100/75">
                    {punchedAt && <span>{punchedAt}</span>}
                    {result?.entry?.nsr != null && <span>NSR {String(result.entry.nsr)}</span>}
                  </div>
                  <p className="mt-5 text-xs text-emerald-100/60">A tela será liberada automaticamente para a próxima pessoa.</p>
                </div>
              </div>
            )}

            <div className="absolute inset-x-3 bottom-3 rounded-2xl border border-white/10 bg-slate-950/85 px-4 py-3 text-center shadow-xl backdrop-blur sm:inset-x-5 sm:bottom-5 sm:px-5 sm:py-4">
              <div className="flex items-center justify-center gap-2 text-sm font-bold sm:text-base">
                {busy && <Loader2 className="h-5 w-5 animate-spin text-cyan-300" />}
                {phase === 'ERROR' && <AlertTriangle className="h-5 w-5 text-rose-300" />}
                {phase === 'SUCCESS' && <CheckCircle2 className="h-5 w-5 text-emerald-300" />}
                <span>{instruction}</span>
              </div>
              {position && busy && (
                <p className="mt-1.5 flex items-center justify-center gap-1 text-[10px] text-slate-400 sm:text-xs">
                  <MapPin className="h-3 w-3" /> Localização obtida · precisão aproximada de {Math.round(position.accuracy)} m
                </p>
              )}
            </div>
          </section>

          <aside className="flex flex-col gap-4">
            <section className="rounded-[1.5rem] border border-white/10 bg-white/[0.05] p-5 shadow-xl sm:p-6">
              {phase === 'INITIALIZING' && (
                <div className="flex min-h-44 items-center justify-center gap-3 text-slate-300">
                  <Loader2 className="h-6 w-6 animate-spin text-cyan-300" /> Inicializando o terminal...
                </div>
              )}

              {phase === 'SETUP' && (
                <div className="space-y-5">
                  <div className="flex items-start gap-3">
                    <div className="rounded-xl bg-amber-400/10 p-2.5 text-amber-300"><KeyRound className="h-6 w-6" /></div>
                    <div>
                      <h1 className="text-lg font-black">Provisionar este aparelho</h1>
                      <p className="mt-1 text-sm leading-6 text-slate-400">Operação exclusiva do administrador. Informe manualmente o token emitido para este terminal.</p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label htmlFor="kiosk-token" className="text-xs font-bold uppercase tracking-wide text-slate-300">Token do terminal</label>
                    <Input
                      id="kiosk-token"
                      type="password"
                      value={provisioningToken}
                      onChange={(event) => setProvisioningToken(event.target.value)}
                      onKeyDown={(event) => { if (event.key === 'Enter') provision(); }}
                      autoComplete="off"
                      autoCapitalize="none"
                      spellCheck={false}
                      placeholder="Cole o token fornecido pelo administrador"
                      className="h-12 border-white/15 bg-slate-950 text-white placeholder:text-slate-600"
                    />
                    <p className="text-[11px] leading-5 text-slate-500">O token fica somente no armazenamento local deste navegador. Ele nunca deve ser enviado por URL, QR Code público ou mensagem de log.</p>
                  </div>

                  {error && <ErrorBox message={error} />}

                  <Button type="button" size="lg" className="h-14 w-full bg-cyan-500 text-base font-black text-slate-950 hover:bg-cyan-400" onClick={provision}>
                    <LockKeyhole className="mr-2 h-5 w-5" /> Ativar este terminal
                  </Button>
                </div>
              )}

              {phase !== 'INITIALIZING' && phase !== 'SETUP' && (
                <div className="space-y-5">
                  {phase === 'ERROR' && error && <ErrorBox message={error} />}

                  {!busy && phase !== 'SUCCESS' && (
                    <Button
                      type="button"
                      size="lg"
                      className="min-h-20 w-full rounded-2xl bg-cyan-400 text-lg font-black text-slate-950 shadow-[0_14px_45px_rgba(34,211,238,.2)] hover:bg-cyan-300 sm:min-h-24 sm:text-xl"
                      onClick={registerPunch}
                    >
                      {phase === 'ERROR' ? <RefreshCw className="mr-3 h-7 w-7" /> : <Fingerprint className="mr-3 h-8 w-8" />}
                      {phase === 'ERROR' ? 'Tentar novamente' : 'Registrar ponto'}
                    </Button>
                  )}

                  {busy && (
                    <Button type="button" variant="outline" size="lg" className="h-14 w-full border-white/15 bg-transparent text-white hover:bg-white/10 hover:text-white" onClick={cancel}>
                      Cancelar operação
                    </Button>
                  )}

                  {phase === 'SUCCESS' && (
                    <Button type="button" variant="outline" size="lg" className="h-14 w-full border-white/15 bg-transparent text-white hover:bg-white/10 hover:text-white" onClick={resetToReady}>
                      <UsersRound className="mr-2 h-5 w-5" /> Liberar para próxima pessoa
                    </Button>
                  )}
                </div>
              )}
            </section>
          </aside>
        </div>

        <footer className="flex flex-wrap items-center justify-between gap-2 px-1 text-[10px] text-slate-600 sm:text-xs">
          <span>Uso interno autorizado · não compartilhe o token deste terminal</span>
          <span>Gestão 360</span>
        </footer>
      </div>
    </main>
  );
}

function ErrorBox({ message }: { message: string }) {
  return (
    <div role="alert" className="rounded-xl bg-red-600 p-4 text-white shadow-lg">
      <div className="flex items-center gap-2.5 text-lg font-black tracking-wide">
        <AlertTriangle className="h-6 w-6 shrink-0" />
        PONTO NÃO REGISTRADO
      </div>
      <p className="mt-1 text-sm font-medium leading-5 text-red-50">{message}</p>
    </div>
  );
}

async function captureExactlyOneFace(
  faceapi: FaceApi,
  video: HTMLVideoElement,
  cancelled: { current: boolean },
  setInstruction: (message: string) => void,
): Promise<CapturedFace> {
  const startedAt = Date.now();
  const options = new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.65 });

  while (Date.now() - startedAt < CAPTURE_TIMEOUT_MS) {
    if (cancelled.current) throw new Error('Operação cancelada.');
    const faces = await faceapi.detectAllFaces(video, options).withFaceLandmarks().withFaceDescriptors();

    if (faces.length === 0) {
      setInstruction('Nenhum rosto detectado — aproxime-se e centralize o rosto');
      await delay(220);
      continue;
    }
    if (faces.length > 1) {
      setInstruction('Mais de um rosto detectado — apenas uma pessoa deve aparecer');
      await delay(300);
      continue;
    }

    const face = faces[0];
    if (face.detection.score < 0.7) {
      setInstruction('Melhore a iluminação e mantenha o rosto voltado para a câmera');
      await delay(220);
      continue;
    }

    return {
      descriptor: Array.from(face.descriptor),
      faceCount: 1,
      detectionScore: face.detection.score,
    };
  }

  throw new Error('Tempo de captura esgotado. Garanta boa iluminação, fique sozinho na imagem e tente novamente.');
}

async function kioskRequest<T>(path: string, token: string, json?: unknown): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${token}`,
        ...(json === undefined ? {} : { 'content-type': 'application/json' }),
      },
      body: json === undefined ? undefined : JSON.stringify(json),
      cache: 'no-store',
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
    });
  } catch {
    throw new KioskHttpError(0, 'Sem conexão com o servidor. Nenhuma marcação foi guardada para envio posterior.');
  }

  const raw = await response.text();
  const body = raw ? safeJson(raw) : null;
  if (!response.ok) {
    const apiMessage = body && typeof body === 'object' && 'message' in body ? String((body as { message: unknown }).message) : '';
    throw new KioskHttpError(response.status, apiMessage || `Não foi possível concluir o registro (${response.status}).`);
  }
  return body as T;
}

class KioskHttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

function normalizeKioskError(error: unknown): { status: number; message: string } {
  if (error instanceof KioskHttpError) return { status: error.status, message: error.message };
  if (error instanceof DOMException && error.name === 'NotAllowedError') {
    return { status: 0, message: 'Permissão da câmera ou localização negada. Autorize o acesso nas configurações do navegador.' };
  }
  if (error instanceof DOMException && error.name === 'NotFoundError') {
    return { status: 0, message: 'Nenhuma câmera frontal foi encontrada neste aparelho.' };
  }
  return { status: 0, message: error instanceof Error ? error.message : 'Falha inesperada ao registrar o ponto.' };
}

function currentPositionOrNull(): Promise<Position | null> {
  return new Promise((resolve) => {
    if (!navigator.geolocation) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      (position) => resolve({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy,
      }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 8_000, maximumAge: 15_000 },
    );
  });
}

function createSyncId(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (value) => value.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function formatClock(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'medium' }).format(date);
}

function safeJson(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function removeStoredToken() {
  try {
    window.localStorage.removeItem(TOKEN_STORAGE_KEY);
  } catch {
    // O estado em memória ainda é limpo; o administrador pode corrigir as
    // permissões de armazenamento antes de provisionar novamente.
  }
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
