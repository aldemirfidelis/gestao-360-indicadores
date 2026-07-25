'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  Camera,
  CheckCircle2,
  Fingerprint,
  Loader2,
  RefreshCw,
  Search,
  ShieldCheck,
  Trash2,
  UserRound,
  UsersRound,
} from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

type FaceApi = typeof import('@vladmandic/face-api');
type BiometricProfile = {
  id: string;
  status: 'ACTIVE' | 'LOCKED' | 'REVOKED';
  sampleCount: number;
  enrolledAt: string;
  lastVerifiedAt: string | null;
  lockedUntil: string | null;
  revokedAt: string | null;
  updatedAt: string;
};
type Employee = {
  id: string;
  name: string;
  registrationId: string | null;
  status: string;
  orgNode: { id: string; name: string } | null;
  biometricProfile: BiometricProfile | null;
};
type EmployeeResponse = {
  items: Employee[];
  summary: { total: number; active: number; pending: number };
  noticeVersion: string;
};
type Challenge = { id: string; nonce: string; noticeVersion: string };
type CapturePhase = 'IDLE' | 'STARTING' | 'SCANNING' | 'SAVING' | 'SUCCESS' | 'ERROR';

const MODEL_URL = '/models/face';
const ENROLL_SAMPLES = 3;
const CAPTURE_TIMEOUT_MS = 20_000;
let faceModelPromise: Promise<FaceApi> | null = null;

async function loadFaceEngine(): Promise<FaceApi> {
  if (!faceModelPromise) {
    faceModelPromise = import('@vladmandic/face-api')
      .then(async (faceapi) => {
        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
          faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
          faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
        ]);
        return faceapi;
      })
      .catch((error) => {
        faceModelPromise = null;
        throw error;
      });
  }
  return faceModelPromise;
}

export function EmployeeBiometricEnrollment() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [selected, setSelected] = useState<Employee | null>(null);

  const query = useQuery<EmployeeResponse>({
    queryKey: ['personnel', 'biometrics', 'employees', search, statusFilter],
    queryFn: () => {
      const params = new URLSearchParams();
      if (search.trim()) params.set('search', search.trim());
      if (statusFilter) params.set('biometricStatus', statusFilter);
      return api(`/personnel/biometrics/employees?${params.toString()}`);
    },
  });

  const revoke = useMutation({
    mutationFn: (employee: Employee) =>
      api(`/personnel/biometrics/employees/${employee.id}/revoke`, {
        method: 'POST',
        json: { reason: 'Revogação solicitada pelo responsável do Serviço Pessoal' },
      }),
    onSuccess: async () => {
      toast.success('Biometria revogada e descritor inutilizado');
      await qc.invalidateQueries({ queryKey: ['personnel', 'biometrics', 'employees'] });
    },
    onError: (error: any) => toast.error(error?.message ?? 'Não foi possível revogar a biometria.'),
  });

  const requestRevoke = (employee: Employee) => {
    if (!window.confirm(`Revogar a biometria facial de "${employee.name}"? A pessoa deixará de ser reconhecida nos totens.`)) return;
    revoke.mutate(employee);
  };

  const summary = query.data?.summary ?? { total: 0, active: 0, pending: 0 };

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-3">
        <SummaryCard label="Colaboradores encontrados" value={summary.total} icon={<UsersRound className="h-5 w-5" />} />
        <SummaryCard label="Biometrias ativas" value={summary.active} icon={<Fingerprint className="h-5 w-5 text-emerald-500" />} />
        <SummaryCard label="Pendentes de cadastro" value={summary.pending} icon={<AlertTriangle className="h-5 w-5 text-amber-500" />} />
      </div>

      <Card>
        <CardContent className="space-y-4 p-5">
          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="pl-9"
                placeholder="Buscar por nome, matrícula ou CPF"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              className="h-10 rounded-md border bg-background px-3 text-sm"
            >
              <option value="">Todas as situações</option>
              <option value="ACTIVE">Biometria ativa</option>
              <option value="PENDING">Cadastro pendente</option>
              <option value="LOCKED">Temporariamente bloqueada</option>
              <option value="REVOKED">Revogada</option>
            </select>
          </div>

          <div className="rounded-xl border">
            <div className="hidden grid-cols-[minmax(220px,1.4fr),140px,minmax(160px,1fr),150px,220px] gap-3 border-b bg-muted/40 px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground lg:grid">
              <span>Colaborador</span>
              <span>Matrícula</span>
              <span>Área</span>
              <span>Situação</span>
              <span className="text-right">Ações</span>
            </div>

            {query.isLoading && (
              <div className="flex min-h-40 items-center justify-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" /> Carregando colaboradores...
              </div>
            )}
            {query.isError && (
              <div className="m-4 rounded-xl border border-red-400/40 bg-red-500/5 p-4 text-sm text-red-600">
                Não foi possível carregar os cadastros faciais.
              </div>
            )}
            {!query.isLoading && !query.isError && !query.data?.items.length && (
              <div className="p-10 text-center text-sm text-muted-foreground">Nenhum colaborador encontrado.</div>
            )}

            {query.data?.items.map((employee) => (
              <div
                key={employee.id}
                className="grid gap-3 border-b px-4 py-4 last:border-b-0 lg:grid-cols-[minmax(220px,1.4fr),140px,minmax(160px,1fr),150px,220px] lg:items-center"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-cyan-500/10 text-cyan-600">
                    <UserRound className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{employee.name}</p>
                    <p className="text-[11px] text-muted-foreground">{employee.status === 'ACTIVE' ? 'Colaborador ativo' : 'Colaborador inativo'}</p>
                  </div>
                </div>
                <div className="text-sm">
                  <span className="mr-2 text-xs text-muted-foreground lg:hidden">Matrícula:</span>
                  <span className="font-mono">{employee.registrationId ?? '—'}</span>
                </div>
                <div className="truncate text-sm text-muted-foreground">{employee.orgNode?.name ?? 'Sem área definida'}</div>
                <BiometricStatus profile={employee.biometricProfile} />
                <div className="flex flex-wrap justify-end gap-2">
                  {employee.biometricProfile?.status === 'ACTIVE' && (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="text-red-600"
                      disabled={revoke.isPending}
                      onClick={() => requestRevoke(employee)}
                    >
                      <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Revogar
                    </Button>
                  )}
                  <Button
                    type="button"
                    size="sm"
                    disabled={employee.status !== 'ACTIVE'}
                    onClick={() => setSelected(employee)}
                  >
                    <Camera className="mr-1.5 h-3.5 w-3.5" />
                    {employee.biometricProfile?.status === 'ACTIVE' ? 'Recadastrar' : 'Cadastrar face'}
                  </Button>
                </div>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            São exibidos no máximo 500 colaboradores por consulta. Refine a busca por matrícula ou nome em empresas maiores.
          </p>
        </CardContent>
      </Card>

      <EnrollmentDialog
        employee={selected}
        noticeVersion={query.data?.noticeVersion ?? ''}
        onClose={() => setSelected(null)}
        onSaved={async () => {
          await qc.invalidateQueries({ queryKey: ['personnel', 'biometrics', 'employees'] });
        }}
      />
    </div>
  );
}

function EnrollmentDialog({
  employee,
  noticeVersion,
  onClose,
  onSaved,
}: {
  employee: Employee | null;
  noticeVersion: string;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const cancelledRef = useRef(false);
  const [phase, setPhase] = useState<CapturePhase>('IDLE');
  const [instruction, setInstruction] = useState('Confirme o colaborador e inicie a captura');
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [error, setError] = useState('');

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  };

  const reset = () => {
    cancelledRef.current = true;
    stopCamera();
    setPhase('IDLE');
    setInstruction('Confirme o colaborador e inicie a captura');
    setError('');
  };

  useEffect(() => {
    if (!employee) {
      reset();
      setPrivacyAccepted(false);
    } else {
      void loadFaceEngine().catch(() => undefined);
    }
    return () => stopCamera();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employee?.id]);

  const capture = async () => {
    if (!employee || !noticeVersion) return;
    cancelledRef.current = false;
    setError('');
    setPhase('STARTING');
    setInstruction('Preparando câmera e reconhecimento...');
    try {
      if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
        throw new Error('A câmera exige HTTPS e um navegador atualizado.');
      }
      const [engine, challenge, stream] = await Promise.all([
        loadFaceEngine(),
        api<Challenge>(`/personnel/biometrics/employees/${employee.id}/challenge`, { method: 'POST', json: {} }),
        navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user', width: { ideal: 720 }, height: { ideal: 720 } },
          audio: false,
        }),
      ]);
      if (cancelledRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      streamRef.current = stream;
      if (!videoRef.current) throw new Error('Não foi possível inicializar a câmera.');
      videoRef.current.srcObject = stream;
      await videoRef.current.play();

      const samples: number[][] = [];
      setPhase('SCANNING');
      for (let index = 0; index < ENROLL_SAMPLES; index++) {
        setInstruction(`Olhe para a câmera — amostra ${index + 1} de ${ENROLL_SAMPLES}`);
        samples.push(await captureExactlyOneFace(engine, videoRef.current, cancelledRef));
        await delay(450);
      }
      stopCamera();
      setPhase('SAVING');
      setInstruction('Vinculando a biometria à matrícula...');
      await api(`/personnel/biometrics/employees/${employee.id}/enroll`, {
        method: 'POST',
        json: {
          challengeId: challenge.id,
          nonce: challenge.nonce,
          descriptors: samples,
          acceptedPrivacyNotice: true,
          noticeVersion: challenge.noticeVersion,
          legalBasis: 'CONSENTIMENTO_ESPECIFICO',
        },
      });
      setPhase('SUCCESS');
      setInstruction('Cadastro facial concluído');
      toast.success(`Biometria de ${employee.name} cadastrada`);
      await onSaved();
    } catch (caught: any) {
      stopCamera();
      setPhase('ERROR');
      setInstruction('Cadastro não concluído');
      setError(cameraError(caught));
    }
  };

  const busy = ['STARTING', 'SCANNING', 'SAVING'].includes(phase);
  return (
    <Dialog open={Boolean(employee)} onOpenChange={(open) => { if (!open) { reset(); onClose(); } }}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{employee?.biometricProfile?.status === 'ACTIVE' ? 'Recadastrar biometria facial' : 'Cadastrar biometria facial'}</DialogTitle>
          <DialogDescription>
            A captura será vinculada ao cadastro funcional selecionado. Fotos e quadros da câmera não serão armazenados.
          </DialogDescription>
        </DialogHeader>

        {employee && (
          <div className="grid gap-5 md:grid-cols-[1.15fr,.85fr]">
            <div className="relative aspect-square min-h-80 overflow-hidden rounded-2xl bg-slate-950">
              <video ref={videoRef} muted playsInline className="h-full w-full scale-x-[-1] object-cover" />
              <div className="pointer-events-none absolute inset-0 grid place-items-center">
                <div className={cn(
                  'h-[65%] w-[58%] rounded-[45%] border-4 shadow-[0_0_0_999px_rgba(2,6,23,.55)]',
                  phase === 'SUCCESS' ? 'border-emerald-400' : phase === 'ERROR' ? 'border-red-400' : busy ? 'border-cyan-300' : 'border-white/55',
                )} />
              </div>
              <div className="absolute inset-x-4 bottom-4 rounded-xl border border-white/10 bg-slate-950/85 p-3 text-center text-sm font-semibold text-white backdrop-blur">
                <div className="flex items-center justify-center gap-2">
                  {busy && <Loader2 className="h-4 w-4 animate-spin text-cyan-300" />}
                  {phase === 'SUCCESS' && <CheckCircle2 className="h-4 w-4 text-emerald-300" />}
                  {instruction}
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="rounded-xl border bg-muted/30 p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Colaborador selecionado</p>
                <p className="mt-2 text-lg font-bold">{employee.name}</p>
                <p className="mt-1 font-mono text-sm">Matrícula {employee.registrationId ?? 'não informada'}</p>
                <p className="mt-1 text-xs text-muted-foreground">{employee.orgNode?.name ?? 'Sem área definida'}</p>
              </div>

              <label className="flex items-start gap-2 rounded-xl border p-3 text-xs leading-5">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={privacyAccepted}
                  disabled={busy || phase === 'SUCCESS'}
                  onChange={(event) => setPrivacyAccepted(event.target.checked)}
                />
                <span>Confirmo que o colaborador foi informado e autorizou o cadastramento do template facial para controle de ponto.</span>
              </label>

              <div className="rounded-xl border border-emerald-400/30 bg-emerald-500/5 p-3 text-xs leading-5 text-muted-foreground">
                <div className="mb-1 flex items-center gap-2 font-semibold text-foreground">
                  <ShieldCheck className="h-4 w-4 text-emerald-500" /> Privacidade desde a captura
                </div>
                Três descritores matemáticos são combinados e cifrados no servidor. Nenhuma fotografia é enviada ou persistida.
              </div>

              {error && (
                <div className="flex gap-2 rounded-xl bg-red-600 p-3 text-xs font-medium text-white">
                  <AlertTriangle className="h-4 w-4 shrink-0" /> {error}
                </div>
              )}
              {phase === 'SUCCESS' && (
                <div className="rounded-xl border border-emerald-400/40 bg-emerald-500/10 p-3 text-sm font-semibold text-emerald-700">
                  O colaborador já pode ser reconhecido nos totens autorizados da empresa.
                </div>
              )}

              {phase === 'IDLE' && (
                <Button className="w-full" size="lg" disabled={!privacyAccepted} onClick={capture}>
                  <Camera className="mr-2 h-5 w-5" /> Iniciar captura facial
                </Button>
              )}
              {phase === 'ERROR' && (
                <Button className="w-full" size="lg" onClick={capture}>
                  <RefreshCw className="mr-2 h-5 w-5" /> Tentar novamente
                </Button>
              )}
              {busy && <Button className="w-full" variant="outline" onClick={reset}>Cancelar captura</Button>}
            </div>
          </div>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => { reset(); onClose(); }}>
            {phase === 'SUCCESS' ? 'Concluir' : 'Fechar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SummaryCard({ label, value, icon }: { label: string; value: number; icon: ReactNode }) {
  return (
    <Card>
      <CardContent className="flex items-center justify-between p-4">
        <div>
          <p className="text-2xl font-black">{value}</p>
          <p className="text-xs text-muted-foreground">{label}</p>
        </div>
        <div className="rounded-xl bg-muted p-2.5">{icon}</div>
      </CardContent>
    </Card>
  );
}

function BiometricStatus({ profile }: { profile: BiometricProfile | null }) {
  if (!profile || profile.status === 'REVOKED') {
    return <Badge variant="secondary" className="w-fit">{profile?.status === 'REVOKED' ? 'Revogada' : 'Pendente'}</Badge>;
  }
  if (profile.status === 'LOCKED') return <Badge variant="destructive" className="w-fit">Bloqueada</Badge>;
  return (
    <div>
      <Badge className="w-fit bg-emerald-600">Ativa</Badge>
      <p className="mt-1 text-[10px] text-muted-foreground">{profile.sampleCount} amostras · {formatDate(profile.enrolledAt)}</p>
    </div>
  );
}

async function captureExactlyOneFace(
  faceapi: FaceApi,
  video: HTMLVideoElement,
  cancelled: { current: boolean },
): Promise<number[]> {
  const startedAt = Date.now();
  const options = new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.65 });
  while (Date.now() - startedAt < CAPTURE_TIMEOUT_MS) {
    if (cancelled.current) throw new Error('Captura cancelada.');
    const faces = await faceapi.detectAllFaces(video, options).withFaceLandmarks().withFaceDescriptors();
    if (faces.length === 1 && faces[0].detection.score >= 0.7) return Array.from(faces[0].descriptor);
    if (faces.length > 1) throw new Error('Há mais de uma pessoa na imagem. Deixe somente o colaborador selecionado diante da câmera.');
    await delay(220);
  }
  throw new Error('Não foi possível capturar o rosto com qualidade. Melhore a iluminação, centralize o rosto e tente novamente.');
}

function cameraError(error: any) {
  if (error?.name === 'NotAllowedError') return 'Permissão da câmera negada. Autorize a câmera nas configurações do navegador.';
  if (error?.name === 'NotFoundError') return 'Nenhuma câmera frontal foi encontrada neste aparelho.';
  return error?.message ?? 'Não foi possível concluir o cadastro facial.';
}

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'data indisponível' : new Intl.DateTimeFormat('pt-BR').format(date);
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
