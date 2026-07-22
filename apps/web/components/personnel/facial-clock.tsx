'use client';

/**
 * Ponto facial — fluxo simplificado para uso corporativo interno.
 *
 * Cadastro: aceitar o aviso de privacidade → olhar para a câmera → o sistema
 * captura três amostras sozinho e salva. Batida: olhar para a câmera → o
 * sistema reconhece e registra a entrada/saída automaticamente. Sem provas de
 * vivacidade (piscar/virar o rosto); o desafio de uso único no servidor segue
 * como antirreplay e as fotos nunca saem do aparelho.
 */

import { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Camera, CheckCircle2, Fingerprint, Loader2, MapPin, RefreshCw, ShieldCheck, Trash2, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { useAuth } from '@/components/auth/auth-provider';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

type FaceApi = typeof import('@vladmandic/face-api');
type Challenge = { id: string; nonce: string; noticeVersion: string };
type Status = { enrolled: boolean; noticeVersion: string; profile: { status: string; enrolledAt: string; lastVerifiedAt: string | null; lockedUntil: string | null } | null };

const MODEL_URL = '/models/face';
const ENROLL_SAMPLES = 3;
const CAPTURE_TIMEOUT_MS = 20_000;
let modelPromise: Promise<FaceApi> | null = null;

async function loadFaceEngine(): Promise<FaceApi> {
  if (!modelPromise) {
    modelPromise = import('@vladmandic/face-api').then(async (faceapi) => {
      await Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
        faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
        faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
      ]);
      return faceapi;
    });
  }
  return modelPromise;
}

export function FacialClock() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const firstName = (user?.name ?? '').trim().split(/\s+/)[0] || (user?.name ?? '');
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const cancelledRef = useRef(false);
  const [phase, setPhase] = useState<'IDLE' | 'STARTING' | 'SCANNING' | 'SUBMITTING' | 'SUCCESS' | 'FAILED'>('IDLE');
  const [instruction, setInstruction] = useState('Posicione o rosto dentro da moldura');
  const [error, setError] = useState<string | null>(null);
  const [failMessage, setFailMessage] = useState<string | null>(null);
  const [failCount, setFailCount] = useState(0);
  const [successMessage, setSuccessMessage] = useState('');
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [location, setLocation] = useState<{ latitude: number; longitude: number; accuracy: number } | null>(null);

  const statusQuery = useQuery<Status>({ queryKey: ['personnel', 'biometrics', 'me'], queryFn: () => api('/personnel/biometrics/me') });
  const enrolled = Boolean(statusQuery.data?.enrolled);

  useEffect(() => () => stopCamera(), []);
  // Pré-carrega os modelos de reconhecimento em segundo plano — ao clicar, a câmera
  // abre sem esperar o download dos ~7MB de modelos (principal causa da lentidão).
  useEffect(() => { void loadFaceEngine().catch(() => undefined); }, []);

  const start = async () => {
    setError(null);
    setPhase('STARTING');
    setInstruction('Abrindo a câmera...');
    cancelledRef.current = false;
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error('Este aparelho não oferece acesso seguro à câmera. Use Chrome/Edge atualizado em HTTPS.');
      const [engine, challenge, position] = await Promise.all([
        loadFaceEngine(),
        api<Challenge>(`/personnel/biometrics/challenge/${enrolled ? 'punch' : 'enroll'}`, { method: 'POST', json: {} }),
        currentPositionOrNull(),
      ]);
      setLocation(position);
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 720 }, height: { ideal: 720 } }, audio: false });
      streamRef.current = stream;
      if (!videoRef.current) throw new Error('Não foi possível inicializar a câmera.');
      videoRef.current.srcObject = stream;
      await videoRef.current.play();

      setPhase('SCANNING');
      setInstruction('Olhe para a câmera');
      if (enrolled) {
        const descriptor = await captureDescriptor(engine, videoRef.current, cancelledRef);
        stopCamera();
        setPhase('SUBMITTING');
        setInstruction('Confirmando sua identidade...');
        const result = await api<any>('/personnel/biometrics/verify-and-punch', {
          method: 'POST',
          json: { challengeId: challenge.id, nonce: challenge.nonce, descriptor, ...(position ?? {}) },
        });
        const label = result?.entry?.kind === 'OUT' ? 'Saída' : 'Entrada';
        setSuccessMessage(`${label} registrada${firstName ? `, ${firstName}` : ''}!`);
        toast.success(`${label} registrada com reconhecimento facial`);
        setFailCount(0);
        void qc.invalidateQueries({ queryKey: ['time-clock'] });
      } else {
        const samples: number[][] = [];
        for (let index = 0; index < ENROLL_SAMPLES; index++) {
          setInstruction(index === 0 ? 'Olhe para a câmera' : `Capturando... (${index + 1} de ${ENROLL_SAMPLES})`);
          samples.push(await captureDescriptor(engine, videoRef.current, cancelledRef));
          await delay(350);
        }
        stopCamera();
        setPhase('SUBMITTING');
        setInstruction('Salvando seu cadastro facial...');
        await api('/personnel/biometrics/enroll', {
          method: 'POST',
          json: {
            challengeId: challenge.id, nonce: challenge.nonce, descriptors: samples,
            acceptedPrivacyNotice: true, noticeVersion: challenge.noticeVersion, legalBasis: 'CONSENTIMENTO_ESPECIFICO',
          },
        });
        setSuccessMessage('Rosto cadastrado! A partir de agora é só olhar para a câmera para bater o ponto.');
        toast.success('Biometria facial cadastrada com segurança');
      }
      setPhase('SUCCESS');
      setInstruction('Tudo certo!');
      void qc.invalidateQueries({ queryKey: ['personnel', 'biometrics'] });
    } catch (err: any) {
      stopCamera();
      // Erro de permissão/câmera: aviso normal e volta ao início.
      if (isCameraAccessError(err) || !enrolled) {
        setPhase('IDLE');
        setError(cameraError(err));
        return;
      }
      // Reconhecimento/registro falhou: "Ponto não registrado" (barra vermelha).
      const next = failCount + 1;
      setFailCount(next);
      setPhase('FAILED');
      setInstruction('Ponto não registrado');
      setFailMessage(
        next >= 3
          ? 'Não conseguimos te reconhecer após 3 tentativas. Procure o Serviço Pessoal da sua empresa.'
          : (err?.message ?? 'Não reconhecemos seu rosto. Tente de novo, com boa iluminação e o rosto centralizado na moldura.'),
      );
    }
  };

  const reset = () => {
    cancelledRef.current = true;
    stopCamera();
    setError(null);
    setFailMessage(null);
    setSuccessMessage('');
    setInstruction('Posicione o rosto dentro da moldura');
    setPhase('IDLE');
  };

  const revoke = async () => {
    if (!window.confirm('Revogar sua biometria facial? O registro de ponto convencional continuará disponível.')) return;
    try {
      await api('/personnel/biometrics/revoke', { method: 'POST', json: { reason: 'Revogação solicitada pelo titular no PWA' } });
      toast.success('Biometria revogada e template inutilizado');
      reset();
      setPrivacyAccepted(false);
      void qc.invalidateQueries({ queryKey: ['personnel', 'biometrics'] });
    } catch (err: any) { toast.error(err?.message ?? 'Não foi possível revogar a biometria.'); }
  };

  function stopCamera() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }

  const busy = phase === 'STARTING' || phase === 'SCANNING' || phase === 'SUBMITTING';

  return (
    <div className="mx-auto grid max-w-5xl gap-5 lg:grid-cols-[1fr,340px]">
      <Card className="overflow-hidden border-slate-200 bg-slate-950 text-white shadow-xl">
        <CardContent className="p-0">
          <div className="relative aspect-square max-h-[68vh] min-h-[360px] overflow-hidden bg-gradient-to-b from-slate-900 to-slate-950">
            <video ref={videoRef} muted playsInline className={cn('h-full w-full scale-x-[-1] object-cover transition-opacity', streamRef.current ? 'opacity-100' : 'opacity-20')} />
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div className={cn('h-[68%] w-[62%] max-w-[330px] rounded-[45%] border-4 shadow-[0_0_0_999px_rgba(2,6,23,.52)] transition-colors', phase === 'SUCCESS' ? 'border-emerald-400' : phase === 'FAILED' ? 'border-red-500' : busy ? 'border-cyan-400' : 'border-white/60')} />
            </div>
            {phase === 'SUCCESS' && firstName && (
              <div className="pointer-events-none absolute inset-x-0 top-6 text-center text-2xl font-black tracking-tight text-emerald-300 drop-shadow-lg sm:text-3xl">{firstName}</div>
            )}
            <div className={cn('absolute inset-x-4 bottom-4 rounded-2xl border p-3 text-center backdrop-blur', phase === 'FAILED' ? 'border-red-500 bg-red-600/90' : 'border-white/10 bg-slate-950/80')}>
              <div className="flex items-center justify-center gap-2 text-sm font-bold">
                {busy && <Loader2 className="h-4 w-4 animate-spin text-cyan-400" />}
                {phase === 'SUCCESS' && <CheckCircle2 className="h-4 w-4 text-emerald-400" />}
                {phase === 'FAILED' && <XCircle className="h-4 w-4 text-white" />}
                <span className={phase === 'FAILED' ? 'text-white' : undefined}>{instruction}</span>
              </div>
              {location && <div className="mt-1 flex items-center justify-center gap-1 text-[10px] text-slate-400"><MapPin className="h-3 w-3" />Localização obtida (precisão aproximada de {Math.round(location.accuracy)} m)</div>}
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-4">
        <Card><CardContent className="space-y-4 p-5">
          <div className="flex items-start gap-3">
            <div className="rounded-xl bg-cyan-500/10 p-2"><Fingerprint className="h-6 w-6 text-cyan-500" /></div>
            <div><h2 className="font-bold">{enrolled ? 'Registrar ponto facial' : 'Cadastrar reconhecimento facial'}</h2><p className="mt-1 text-xs text-muted-foreground">{enrolled ? 'Olhe para a câmera e a batida é registrada automaticamente.' : 'Aceite o aviso, olhe para a câmera e pronto — o cadastro é automático. As fotos não são enviadas nem armazenadas.'}</p></div>
          </div>

          {!enrolled && phase !== 'SUCCESS' && (
            <label className="flex items-start gap-2 rounded-xl border bg-muted/30 p-3 text-xs leading-5">
              <input type="checkbox" className="mt-1" checked={privacyAccepted} disabled={busy} onChange={(event) => setPrivacyAccepted(event.target.checked)} />
              <span>Li e aceito o tratamento do meu template biométrico para controle de ponto. Sei que posso revogar o cadastro e usar a alternativa convencional.</span>
            </label>
          )}

          {error && <div className="flex gap-2 rounded-xl border border-red-400/40 bg-red-500/5 p-3 text-xs text-red-600"><AlertTriangle className="h-4 w-4 shrink-0" />{error}</div>}
          {phase === 'SUCCESS' && successMessage && (
            <div className="rounded-xl border border-emerald-400/40 bg-emerald-500/10 p-3 text-emerald-700 dark:text-emerald-400">
              {firstName && <div className="text-lg font-black text-emerald-600 dark:text-emerald-300">{firstName}</div>}
              <div className="flex items-center gap-2 text-sm font-semibold"><CheckCircle2 className="h-4 w-4 shrink-0" />{successMessage}</div>
            </div>
          )}
          {phase === 'FAILED' && (
            <div className="rounded-xl bg-red-600 p-3 text-white shadow">
              <div className="flex items-center gap-2 text-base font-black"><XCircle className="h-5 w-5 shrink-0" />PONTO NÃO REGISTRADO</div>
              {failMessage && <div className="mt-1 text-xs font-medium leading-5">{failMessage}</div>}
            </div>
          )}

          {phase === 'IDLE' && (
            <Button size="lg" className="w-full bg-cyan-600 font-bold text-white hover:bg-cyan-700" disabled={!enrolled && !privacyAccepted} onClick={start}>
              <Camera className="mr-2 h-5 w-5" />{enrolled ? 'Registrar ponto com meu rosto' : 'Cadastrar meu rosto'}
            </Button>
          )}
          {phase === 'FAILED' && failCount < 3 && (
            <Button size="lg" className="w-full bg-cyan-600 font-bold text-white hover:bg-cyan-700" onClick={start}>
              <RefreshCw className="mr-2 h-5 w-5" />Tentar novamente
            </Button>
          )}
          {phase === 'FAILED' && failCount >= 3 && (
            <Button size="lg" variant="outline" className="w-full" onClick={reset}>Recomeçar</Button>
          )}
          {phase === 'SUCCESS' && <Button size="lg" variant="outline" className="w-full" onClick={reset}><RefreshCw className="mr-2 h-4 w-4" />Fazer novo registro</Button>}
          {busy && <Button variant="ghost" className="w-full" onClick={reset}>Cancelar</Button>}
        </CardContent></Card>

        <Card><CardContent className="space-y-3 p-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-2 font-semibold text-foreground"><ShieldCheck className="h-4 w-4 text-emerald-500" />Privacidade e segurança</div>
          <ul className="list-disc space-y-1 pl-4"><li>Processamento facial feito no aparelho.</li><li>Servidor guarda apenas descritor matemático cifrado.</li><li>Geolocalização, horário, hash e auditoria da batida.</li><li>Você pode revogar o cadastro quando quiser.</li></ul>
          {enrolled && <Button variant="ghost" size="sm" className="h-8 w-full text-red-600 hover:text-red-700" onClick={revoke}><Trash2 className="mr-2 h-3.5 w-3.5" />Revogar minha biometria</Button>}
        </CardContent></Card>
      </div>
    </div>
  );
}

/**
 * Aguarda um rosto estável na frente da câmera e retorna o descritor.
 * Tenta continuamente (sem pedir nenhuma ação ao usuário) até dar certo ou
 * estourar o tempo limite.
 */
async function captureDescriptor(faceapi: FaceApi, video: HTMLVideoElement, cancelled: { current: boolean }): Promise<number[]> {
  const started = Date.now();
  while (Date.now() - started < CAPTURE_TIMEOUT_MS) {
    if (cancelled.current) throw new Error('Operação cancelada.');
    const result = await faceapi.detectSingleFace(video, new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.6 })).withFaceLandmarks().withFaceDescriptor();
    if (result && result.detection.score >= 0.6) return Array.from(result.descriptor);
    await delay(200);
  }
  throw new Error('Não foi possível detectar seu rosto. Centralize-se na moldura, melhore a iluminação e tente novamente.');
}

function currentPositionOrNull(): Promise<{ latitude: number; longitude: number; accuracy: number } | null> {
  return new Promise((resolve) => {
    if (!navigator.geolocation) return resolve(null);
    navigator.geolocation.getCurrentPosition((position) => resolve({ latitude: position.coords.latitude, longitude: position.coords.longitude, accuracy: position.coords.accuracy }), () => resolve(null), { enableHighAccuracy: true, timeout: 5000, maximumAge: 30_000 });
  });
}

function cameraError(error: any): string {
  if (error?.name === 'NotAllowedError') return 'Permissão da câmera negada. Autorize a câmera nas configurações do navegador.';
  if (error?.name === 'NotFoundError') return 'Nenhuma câmera frontal foi encontrada neste aparelho.';
  return error?.message ?? 'Não foi possível iniciar o reconhecimento facial.';
}

/** Distingue erro de acesso à câmera (permissão/hardware) de falha de reconhecimento. */
function isCameraAccessError(error: any): boolean {
  if (error?.name === 'NotAllowedError' || error?.name === 'NotFoundError') return true;
  return /acesso seguro à câmera|inicializar a câmera/i.test(String(error?.message ?? ''));
}

function delay(ms: number) { return new Promise((resolve) => setTimeout(resolve, ms)); }
