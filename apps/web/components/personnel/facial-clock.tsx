'use client';

import { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Camera, CheckCircle2, Fingerprint, Loader2, MapPin, RefreshCw, ShieldCheck, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

type FaceApi = typeof import('@vladmandic/face-api');
type Challenge = { id: string; nonce: string; livenessAction: 'BLINK' | 'TURN_LEFT' | 'TURN_RIGHT'; noticeVersion: string };
type Status = { enrolled: boolean; noticeVersion: string; profile: { status: string; enrolledAt: string; lastVerifiedAt: string | null; lockedUntil: string | null } | null };
type LivenessProof = { action: string; passed: true; durationMs: number; frames: number };

const MODEL_URL = '/models/face';
const ACTION_LABEL = { BLINK: 'Pisque os dois olhos', TURN_LEFT: 'Vire o rosto para a esquerda', TURN_RIGHT: 'Vire o rosto para a direita' };
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
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const cancelledRef = useRef(false);
  const [phase, setPhase] = useState<'IDLE' | 'PREPARING' | 'LIVENESS' | 'CAPTURING' | 'READY' | 'SUCCESS'>('IDLE');
  const [instruction, setInstruction] = useState('Posicione o rosto dentro da moldura');
  const [error, setError] = useState<string | null>(null);
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [descriptor, setDescriptor] = useState<number[] | null>(null);
  const [enrollmentSamples, setEnrollmentSamples] = useState<number[][]>([]);
  const [liveness, setLiveness] = useState<LivenessProof | null>(null);
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [location, setLocation] = useState<{ latitude: number; longitude: number; accuracy: number } | null>(null);

  const statusQuery = useQuery<Status>({ queryKey: ['personnel', 'biometrics', 'me'], queryFn: () => api('/personnel/biometrics/me') });
  const enrolled = Boolean(statusQuery.data?.enrolled);

  useEffect(() => () => stopCamera(), []);

  const start = async () => {
    setError(null);
    setPhase('PREPARING');
    cancelledRef.current = false;
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error('Este aparelho não oferece acesso seguro à câmera. Use Chrome/Edge atualizado em HTTPS.');
      const [engine, nextChallenge, position] = await Promise.all([
        loadFaceEngine(),
        api<Challenge>(`/personnel/biometrics/challenge/${enrolled ? 'punch' : 'enroll'}`, { method: 'POST', json: {} }),
        currentPositionOrNull(),
      ]);
      void engine;
      setChallenge(nextChallenge);
      setLocation(position);
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 720 }, height: { ideal: 720 } }, audio: false });
      streamRef.current = stream;
      if (!videoRef.current) throw new Error('Não foi possível inicializar a câmera.');
      videoRef.current.srcObject = stream;
      await videoRef.current.play();
      await runCapture(nextChallenge, enrolled);
    } catch (err: any) {
      stopCamera();
      setPhase('IDLE');
      setError(cameraError(err));
    }
  };

  const runCapture = async (nextChallenge: Challenge, isEnrolled: boolean) => {
    const faceapi = await loadFaceEngine();
    setPhase('LIVENESS');
    setInstruction(ACTION_LABEL[nextChallenge.livenessAction]);
    const proof = await performLiveness(faceapi, nextChallenge.livenessAction, videoRef.current!, cancelledRef);
    setLiveness(proof);
    setPhase('CAPTURING');
    setInstruction(isEnrolled ? 'Olhe de frente e mantenha o rosto parado' : 'Confirmando seu rosto…');
    await delay(600);
    if (isEnrolled) {
      const samples: number[][] = [];
      for (let index = 0; index < 3; index++) {
        setInstruction(`Capturando amostra ${index + 1} de 3 — olhe de frente`);
        samples.push(await captureDescriptor(faceapi, videoRef.current!));
        await delay(500);
      }
      setEnrollmentSamples(samples);
    } else {
      setDescriptor(await captureDescriptor(faceapi, videoRef.current!));
    }
    stopCamera();
    setPhase('READY');
    setInstruction('Rosto e vivacidade confirmados');
  };

  const submit = async () => {
    if (!challenge || !liveness) return;
    setPhase('PREPARING');
    setError(null);
    try {
      if (enrolled) {
        const result = await api<any>('/personnel/biometrics/verify-and-punch', {
          method: 'POST',
          json: { challengeId: challenge.id, nonce: challenge.nonce, descriptor, liveness, ...(location ?? {}) },
        });
        const label = result?.entry?.kind === 'OUT' ? 'Saída' : 'Entrada';
        toast.success(`${label} registrada com reconhecimento facial`);
      } else {
        if (!privacyAccepted) throw new Error('Aceite o aviso de privacidade para cadastrar a biometria.');
        await api('/personnel/biometrics/enroll', {
          method: 'POST',
          json: {
            challengeId: challenge.id, nonce: challenge.nonce, descriptors: enrollmentSamples, liveness,
            acceptedPrivacyNotice: true, noticeVersion: challenge.noticeVersion, legalBasis: 'CONSENTIMENTO_ESPECIFICO',
          },
        });
        toast.success('Biometria facial cadastrada com segurança');
      }
      setPhase('SUCCESS');
      void qc.invalidateQueries({ queryKey: ['personnel', 'biometrics'] });
      void qc.invalidateQueries({ queryKey: ['time-clock'] });
    } catch (err: any) {
      setPhase('READY');
      setError(err?.message ?? 'Não foi possível concluir a operação.');
    }
  };

  const reset = () => {
    cancelledRef.current = true;
    stopCamera();
    setChallenge(null); setDescriptor(null); setEnrollmentSamples([]); setLiveness(null); setError(null); setPhase('IDLE');
  };

  const revoke = async () => {
    if (!window.confirm('Revogar sua biometria facial? O registro de ponto convencional continuará disponível.')) return;
    try {
      await api('/personnel/biometrics/revoke', { method: 'POST', json: { reason: 'Revogação solicitada pelo titular no PWA' } });
      toast.success('Biometria revogada e template inutilizado');
      reset();
      void qc.invalidateQueries({ queryKey: ['personnel', 'biometrics'] });
    } catch (err: any) { toast.error(err?.message ?? 'Não foi possível revogar a biometria.'); }
  };

  function stopCamera() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }

  return (
    <div className="mx-auto grid max-w-5xl gap-5 lg:grid-cols-[1fr,340px]">
      <Card className="overflow-hidden border-slate-200 bg-slate-950 text-white shadow-xl">
        <CardContent className="p-0">
          <div className="relative aspect-square max-h-[68vh] min-h-[360px] overflow-hidden bg-gradient-to-b from-slate-900 to-slate-950">
            <video ref={videoRef} muted playsInline className={cn('h-full w-full scale-x-[-1] object-cover transition-opacity', streamRef.current ? 'opacity-100' : 'opacity-20')} />
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div className={cn('h-[68%] w-[62%] max-w-[330px] rounded-[45%] border-4 shadow-[0_0_0_999px_rgba(2,6,23,.52)] transition-colors', phase === 'READY' || phase === 'SUCCESS' ? 'border-emerald-400' : phase === 'LIVENESS' || phase === 'CAPTURING' ? 'border-cyan-400' : 'border-white/60')} />
            </div>
            <div className="absolute inset-x-4 bottom-4 rounded-2xl border border-white/10 bg-slate-950/80 p-3 text-center backdrop-blur">
              <div className="flex items-center justify-center gap-2 text-sm font-bold">
                {(phase === 'PREPARING' || phase === 'LIVENESS' || phase === 'CAPTURING') && <Loader2 className="h-4 w-4 animate-spin text-cyan-400" />}
                {(phase === 'READY' || phase === 'SUCCESS') && <CheckCircle2 className="h-4 w-4 text-emerald-400" />}
                {instruction}
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
            <div><h2 className="font-bold">{enrolled ? 'Registrar ponto facial' : 'Cadastrar reconhecimento facial'}</h2><p className="mt-1 text-xs text-muted-foreground">{enrolled ? 'Confirme sua identidade e registre a batida em poucos segundos.' : 'Serão capturadas três amostras. As fotos não são enviadas nem armazenadas.'}</p></div>
          </div>

          {!enrolled && phase === 'READY' && (
            <label className="flex items-start gap-2 rounded-xl border bg-muted/30 p-3 text-xs leading-5">
              <input type="checkbox" className="mt-1" checked={privacyAccepted} onChange={(event) => setPrivacyAccepted(event.target.checked)} />
              <span>Li e aceito o tratamento do meu template biométrico para controle de ponto. Sei que posso revogar o cadastro e usar a alternativa convencional.</span>
            </label>
          )}

          {error && <div className="flex gap-2 rounded-xl border border-red-400/40 bg-red-500/5 p-3 text-xs text-red-600"><AlertTriangle className="h-4 w-4 shrink-0" />{error}</div>}

          {phase === 'IDLE' && <Button size="lg" className="w-full bg-cyan-600 font-bold text-white hover:bg-cyan-700" onClick={start}><Camera className="mr-2 h-5 w-5" />{enrolled ? 'Reconhecer meu rosto' : 'Iniciar cadastro facial'}</Button>}
          {phase === 'READY' && <Button size="lg" className="w-full bg-emerald-600 font-bold text-white hover:bg-emerald-700" disabled={!enrolled && !privacyAccepted} onClick={submit}><ShieldCheck className="mr-2 h-5 w-5" />{enrolled ? 'Registrar ponto agora' : 'Confirmar cadastro facial'}</Button>}
          {phase === 'SUCCESS' && <Button size="lg" variant="outline" className="w-full" onClick={reset}><RefreshCw className="mr-2 h-4 w-4" />Fazer novo registro</Button>}
          {phase !== 'IDLE' && phase !== 'SUCCESS' && <Button variant="ghost" className="w-full" onClick={reset}>Cancelar e reiniciar</Button>}
        </CardContent></Card>

        <Card><CardContent className="space-y-3 p-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-2 font-semibold text-foreground"><ShieldCheck className="h-4 w-4 text-emerald-500" />Privacidade e segurança</div>
          <ul className="list-disc space-y-1 pl-4"><li>Processamento facial feito no aparelho.</li><li>Servidor guarda apenas descritor matemático cifrado.</li><li>Desafio de vivacidade aleatório e de uso único.</li><li>Geolocalização, horário, hash e auditoria da batida.</li></ul>
          {enrolled && <Button variant="ghost" size="sm" className="h-8 w-full text-red-600 hover:text-red-700" onClick={revoke}><Trash2 className="mr-2 h-3.5 w-3.5" />Revogar minha biometria</Button>}
        </CardContent></Card>
      </div>
    </div>
  );
}

async function captureDescriptor(faceapi: FaceApi, video: HTMLVideoElement): Promise<number[]> {
  const result = await faceapi.detectSingleFace(video, new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.65 })).withFaceLandmarks().withFaceDescriptor();
  if (!result) throw new Error('Não foi possível detectar um único rosto. Centralize-se, retire acessórios e melhore a iluminação.');
  if (result.detection.score < 0.65) throw new Error('Qualidade facial insuficiente. Melhore a iluminação e tente novamente.');
  return Array.from(result.descriptor);
}

async function performLiveness(faceapi: FaceApi, action: Challenge['livenessAction'], video: HTMLVideoElement, cancelled: { current: boolean }): Promise<LivenessProof> {
  const started = Date.now();
  let frames = 0;
  let eyesWereOpen = false;
  while (Date.now() - started < 15_000) {
    if (cancelled.current) throw new Error('Operação cancelada.');
    const result = await faceapi.detectSingleFace(video, new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.6 })).withFaceLandmarks();
    if (result) {
      frames += 1;
      const points = result.landmarks.positions;
      const leftEar = eyeAspectRatio(points.slice(36, 42));
      const rightEar = eyeAspectRatio(points.slice(42, 48));
      const eyeRatio = (leftEar + rightEar) / 2;
      if (eyeRatio > 0.22) eyesWereOpen = true;
      const noseRatio = (points[30].x - points[0].x) / Math.max(1, points[16].x - points[0].x);
      const passed = action === 'BLINK' ? eyesWereOpen && eyeRatio < 0.18 : action === 'TURN_LEFT' ? noseRatio > 0.58 : noseRatio < 0.42;
      if (passed && frames >= 4 && Date.now() - started >= 800) return { action, passed: true, durationMs: Date.now() - started, frames };
    }
    await delay(180);
  }
  throw new Error('Não foi possível confirmar a prova de vivacidade. Reinicie e faça o movimento indicado com calma.');
}

function eyeAspectRatio(points: Array<{ x: number; y: number }>): number {
  const distance = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);
  return (distance(points[1], points[5]) + distance(points[2], points[4])) / Math.max(1, 2 * distance(points[0], points[3]));
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

function delay(ms: number) { return new Promise((resolve) => setTimeout(resolve, ms)); }
