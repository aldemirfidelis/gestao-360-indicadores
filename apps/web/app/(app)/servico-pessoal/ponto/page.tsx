'use client';

import { useEffect, useState, type Dispatch, type SetStateAction } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  AlarmClockCheck,
  AlertTriangle,
  Calculator,
  CalendarClock,
  Camera,
  CheckCircle2,
  Copy,
  Download,
  FileDown,
  Fingerprint,
  History,
  ListChecks,
  Lock,
  LockOpen,
  MapPin,
  MonitorSmartphone,
  Plus,
  Trash2,
  Upload,
  Users,
  X,
} from 'lucide-react';
import { PageHeader } from '@/components/shell/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/select';
import { Sheet, SheetBody, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/components/auth/auth-provider';
import { api, getAccessToken } from '@/lib/api';
import { cn, formatDate } from '@/lib/utils';
import { ReasonDialog, type ReasonDialogState } from '@/components/platform/reason-dialog';

type DayStatus = 'DAY_OFF' | 'IN_PROGRESS' | 'OK' | 'INCOMPLETE' | 'ABSENT' | 'OVERTIME' | 'UNDERTIME' | 'VACATION' | 'LEAVE' | 'JUSTIFIED' | 'HOLIDAY';

interface PunchEntry {
  id: string;
  punchedAt: string;
  kind: 'IN' | 'OUT';
  source: string;
  note: string | null;
  hasLocation: boolean;
  nsr: string | null;
}

interface OccurrenceDetection {
  type: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  minutes?: number;
}

interface OccurrenceRow {
  id: string;
  dayKey: string;
  type: string;
  severity: OccurrenceDetection['severity'];
  minutes: number | null;
  status: 'OPEN' | 'JUSTIFIED' | 'DISMISSED' | 'RESOLVED';
  justification: string | null;
  user?: { id: string; name: string; email: string } | null;
}

interface MirrorDay {
  dayKey: string;
  weekday: string;
  hasSchedule: boolean;
  holiday: string | null;
  plannedMinutes: number;
  workedMinutes: number;
  status: DayStatus;
  balanceMinutes: number;
  adjustment: { id: string; status: string; reason: string } | null;
  entries: PunchEntry[];
  detected?: OccurrenceDetection[];
}

interface HolidayRow {
  id: string;
  dayKey: string;
  name: string;
  kind: 'NATIONAL' | 'STATE' | 'MUNICIPAL' | 'COMPANY';
}

interface MirrorResponse {
  from: string;
  to: string;
  today: string;
  days: MirrorDay[];
  totals: { plannedMinutes: number; workedMinutes: number; balanceMinutes: number; okDays: number; inconsistentDays: number; absentDays: number };
}

interface SummaryResponse {
  today: MirrorDay & { nextKind: 'IN' | 'OUT'; expectedStartAt: string | null; expectedEndAt: string | null };
  month: MirrorResponse['totals'];
  bank: { totalMinutes: number; closedMinutes: number; liveMinutes: number };
  pendingAdjustments: number;
  myPendingAdjustments: number;
  period: { ref: string; status: string };
}

interface TeamRow {
  user: { id: string; name: string; email: string; jobTitle: string | null };
  hasSchedule: boolean;
  plannedMinutes: number;
  workedMinutes: number;
  status: DayStatus;
  balanceMinutes: number;
  entries: PunchEntry[];
  detected?: OccurrenceDetection[];
}

interface BankStatement {
  balanceMinutes: number;
  policy: { enabled: boolean; validityMonths: number; maxPositiveMinutes: number | null; maxNegativeMinutes: number | null; expirationAction: string };
  expiringSoonMinutes: number;
  alerts: Array<{ type: 'MAX_POSITIVE' | 'MAX_NEGATIVE'; overBy: number }>;
  entries: Array<{ id: string; kind: string; source: string; minutes: number; periodRef: string | null; expiresAt: string | null; note: string | null; createdAt: string }>;
}

interface PayrollRubric {
  id: string;
  eventKey: string;
  payrollCode: string;
  description: string;
  unit: string;
  active: boolean;
}

interface PayrollEventsResponse {
  periodRef: string;
  status: string;
  rows: Array<{
    user: { id: string; name: string; email: string };
    quantities: Record<string, number>;
  }>;
}

interface ClosingPreview {
  periodRef: string;
  status: string;
  readyToClose: boolean;
  checklist: Array<{ key: string; label: string; count: number; blocking: boolean; ok: boolean }>;
  withoutSchedule: Array<{ id: string; name: string }>;
  totals: { employees: number; inconsistentDays: number; absentDays: number; openAdjustments: number; openOccurrences: number; entries: number };
}

interface AdjustmentRequest {
  id: string;
  dayKey: string;
  type?: 'HORARIOS' | 'ABONO_DIA';
  category?: string | null;
  proposedTimes: string[];
  reason: string;
  status: 'REQUESTED' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
  decisionNote: string | null;
  createdAt: string;
  user?: { id: string; name: string; email: string } | null;
  decidedBy?: { id: string; name: string; email: string } | null;
}

interface ShiftTemplate {
  id: string;
  name: string;
  description: string | null;
  toleranceMinutes: number;
  kind: 'WEEKLY' | 'CYCLE';
  weeklyRules: Record<string, { start: string; end: string; breakMinutes?: number } | null>;
  cycleRules: Array<{ start: string; end: string; breakMinutes?: number } | null> | null;
  worksHolidays: boolean;
  active: boolean;
  activeAssignments: number;
}

interface CalculationExplanation {
  dayKey: string;
  processedAt?: string;
  user: { id: string; name: string; email?: string };
  schedule: {
    name: string;
    kind: 'WEEKLY' | 'CYCLE';
    toleranceMinutes: number;
    cycleAnchorDay: string | null;
    rule: { start: string; end: string; breakMinutes?: number } | null;
    version?: number | string | null;
  } | null;
  holiday: string | null;
  status: DayStatus;
  plannedMinutes: number;
  workedMinutes: number;
  balanceMinutes: number;
  consideredEntries: Array<PunchEntry & { original?: string | null; effective?: string | null; clamped?: boolean }>;
  cancelledEntries: Array<PunchEntry & { status?: string }>;
  pairs: string[];
  steps: string[];
  memory?: { id: string; algorithmVersion: string; inputHash: string; calculatedAt: string };
}

interface PunchReceipt {
  documentType: 'INTERNAL_TIME_RECORD_EXTRACT';
  legalNotice: string;
  company: { name: string; registrationMasked: string | null };
  employee: { name: string; registrationMasked: string | null };
  entry: {
    id: string;
    nsr: string | null;
    recordSequence: string;
    punchedAt: string;
    recordedAt: string;
    dayKey: string;
    kind: 'IN' | 'OUT';
    source: string;
  };
  snapshot: { capturedAt: string; origin: string; timezone: string; checksum: string };
  generatedAt: string;
}

interface KioskDevice {
  id: string;
  name: string;
  active: boolean;
  lastSeenAt?: string | null;
  createdAt: string;
}

interface PeriodRow {
  id: string | null;
  periodRef: string;
  status: 'OPEN' | 'CLOSED';
  closedAt: string | null;
  totals: { entries?: number } | null;
  version?: number;
  closedByUser?: { id: string; name: string } | null;
}

const STATUS_LABEL: Record<DayStatus, string> = {
  DAY_OFF: 'Folga',
  IN_PROGRESS: 'Em andamento',
  OK: 'OK',
  INCOMPLETE: 'Inconsistente',
  ABSENT: 'Falta',
  OVERTIME: 'Hora extra',
  UNDERTIME: 'Débito',
  VACATION: 'Férias',
  LEAVE: 'Afastamento',
  JUSTIFIED: 'Abonado',
  HOLIDAY: 'Feriado',
};

const STATUS_CLASS: Record<DayStatus, string> = {
  DAY_OFF: 'border-border text-muted-foreground',
  IN_PROGRESS: 'border-status-blue/40 text-status-blue',
  OK: 'border-status-green/40 text-status-green',
  INCOMPLETE: 'border-status-yellow/40 text-status-yellow',
  ABSENT: 'border-status-red/40 text-status-red',
  OVERTIME: 'border-status-purple/40 text-status-purple',
  UNDERTIME: 'border-status-red/40 text-status-red',
  VACATION: 'border-sky-400/50 text-sky-500',
  LEAVE: 'border-status-purple/40 text-status-purple',
  JUSTIFIED: 'border-teal-400/50 text-teal-600',
  HOLIDAY: 'border-amber-400/50 text-amber-600',
};

const OCCURRENCE_TYPE_LABEL: Record<string, string> = {
  ABSENT: 'Falta',
  MISSING_PUNCH: 'Batida ausente',
  LATE: 'Atraso',
  EARLY_LEAVE: 'Saída antecipada',
  MISSING_BREAK: 'Intervalo não registrado',
  SHORT_BREAK: 'Intervalo insuficiente',
  SHORT_REST: 'Interjornada insuficiente',
  OVERLONG_DAY: 'Excesso de jornada',
  WORK_ON_VACATION: 'Trabalho em férias',
  WORK_ON_LEAVE: 'Trabalho em afastamento',
  WORK_ON_HOLIDAY: 'Feriado trabalhado',
  NO_SCHEDULE: 'Batida sem escala',
};

const OCCURRENCE_SEVERITY_META: Record<OccurrenceDetection['severity'], { label: string; className: string }> = {
  CRITICAL: { label: 'Crítica', className: 'border-status-red/50 bg-status-red/10 text-status-red' },
  HIGH: { label: 'Alta', className: 'border-status-red/40 text-status-red' },
  MEDIUM: { label: 'Média', className: 'border-status-yellow/40 text-status-yellow' },
  LOW: { label: 'Baixa', className: 'border-border text-muted-foreground' },
};

const OCCURRENCE_STATUS_LABEL: Record<OccurrenceRow['status'], string> = {
  OPEN: 'Em aberto',
  JUSTIFIED: 'Justificada',
  DISMISSED: 'Dispensada',
  RESOLVED: 'Resolvida',
};

const ADJUSTMENT_CATEGORY_LABEL: Record<string, string> = {
  ESQUECIMENTO: 'Esquecimento de marcação',
  ATESTADO: 'Atestado/consulta',
  TRABALHO_EXTERNO: 'Trabalho externo',
  TREINAMENTO: 'Treinamento',
  VIAGEM: 'Viagem a serviço',
  OUTRO: 'Outro motivo',
};

const HOLIDAY_KIND_LABEL: Record<HolidayRow['kind'], string> = {
  NATIONAL: 'Nacional',
  STATE: 'Estadual',
  MUNICIPAL: 'Municipal',
  COMPANY: 'Empresa',
};

const ADJUSTMENT_STATUS_LABEL: Record<string, string> = {
  REQUESTED: 'Aguardando aprovação',
  APPROVED: 'Aprovado',
  REJECTED: 'Rejeitado',
  CANCELLED: 'Cancelado',
};

const BANK_SOURCE_LABEL: Record<string, string> = {
  CLOSING: 'Fechamento de competência',
  EXPIRATION: 'Vencimento',
  MANUAL: 'Lançamento manual',
};

const PUNCH_SOURCE_LABEL: Record<string, string> = {
  WEB: 'Navegador/PWA',
  FACIAL: 'Reconhecimento facial individual',
  FACIAL_KIOSK: 'Totem facial',
  MANUAL: 'Ajuste manual auditado',
  IMPORT: 'Importação',
  API: 'Integração por API',
};

const WEEKDAYS: Array<{ key: string; label: string }> = [
  { key: 'mon', label: 'Segunda' },
  { key: 'tue', label: 'Terça' },
  { key: 'wed', label: 'Quarta' },
  { key: 'thu', label: 'Quinta' },
  { key: 'fri', label: 'Sexta' },
  { key: 'sat', label: 'Sábado' },
  { key: 'sun', label: 'Domingo' },
];

const WEEKDAY_SHORT: Record<string, string> = {
  mon: 'Seg', tue: 'Ter', wed: 'Qua', thu: 'Qui', fri: 'Sex', sat: 'Sáb', sun: 'Dom',
};

type TemplateDayForm = { enabled: boolean; start: string; end: string; breakMinutes: string };
type ScheduleKind = 'WEEKLY' | 'CYCLE';

const DEFAULT_TEMPLATE_FORM = () => ({
  name: '',
  description: '',
  toleranceMinutes: '10',
  kind: 'WEEKLY' as ScheduleKind,
  worksHolidays: false,
  days: Object.fromEntries(
    WEEKDAYS.map(({ key }) => [key, { enabled: !['sat', 'sun'].includes(key), start: '08:00', end: '17:00', breakMinutes: '60' } satisfies TemplateDayForm]),
  ) as Record<string, TemplateDayForm>,
  cycleDays: [
    { enabled: true, start: '07:00', end: '19:00', breakMinutes: '60' },
    { enabled: false, start: '07:00', end: '19:00', breakMinutes: '60' },
  ] satisfies TemplateDayForm[],
});

type TemplateFormState = ReturnType<typeof DEFAULT_TEMPLATE_FORM>;

export default function TimeClockPage() {
  const qc = useQueryClient();
  const searchParams = useSearchParams();
  const { hasPermission, user } = useAuth();
  const canTeam = hasPermission(['ponto:team', 'ponto:manage']);
  const canManage = hasPermission(['ponto:manage']);

  const [tab, setTab] = useState(searchParams.get('tab') ?? 'meu-ponto');
  const [now, setNow] = useState(() => new Date());
  const [teamDay, setTeamDay] = useState('');
  const [reasonDialog, setReasonDialog] = useState<ReasonDialogState | null>(null);
  const [adjustDialog, setAdjustDialog] = useState<{ dayKey: string; times: string[]; reason: string; type: 'HORARIOS' | 'ABONO_DIA'; category: string } | null>(null);
  const [occurrenceFilter, setOccurrenceFilter] = useState(() => ({
    status: 'OPEN',
    from: `${new Date().toISOString().slice(0, 7)}-01`,
    to: new Date().toISOString().slice(0, 10),
  }));
  const [previewRef, setPreviewRef] = useState<string | null>(null);
  const [bankOpen, setBankOpen] = useState(false);
  const [payrollRef, setPayrollRef] = useState(() => new Date().toISOString().slice(0, 7));
  const [rubricsOpen, setRubricsOpen] = useState(false);
  const [templateDialog, setTemplateDialog] = useState(false);
  const [templateForm, setTemplateForm] = useState(DEFAULT_TEMPLATE_FORM);
  const [assignForm, setAssignForm] = useState<{ templateId: string; userIds: string[]; cycleAnchorDay: string }>({ templateId: '', userIds: [], cycleAnchorDay: '' });
  const [mirrorMonth, setMirrorMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [importDialog, setImportDialog] = useState(false);
  const [importResult, setImportResult] = useState<{ imported: number; duplicates: number; errors: string[] } | null>(null);
  const [holidayYear, setHolidayYear] = useState(() => String(new Date().getFullYear()));
  const [holidayForm, setHolidayForm] = useState<{ dayKey: string; name: string; kind: HolidayRow['kind'] }>({ dayKey: '', name: '', kind: 'COMPANY' });
  const [explainTarget, setExplainTarget] = useState<{ userId: string; dayKey: string } | null>(null);
  const [receiptEntryId, setReceiptEntryId] = useState<string | null>(null);
  const [kioskName, setKioskName] = useState('');
  const [createdKiosk, setCreatedKiosk] = useState<{ device: KioskDevice; token: string } | null>(null);
  const currentMonth = new Date().toISOString().slice(0, 7);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const summaryQuery = useQuery<SummaryResponse>({
    queryKey: ['time-clock', 'summary'],
    queryFn: () => api<SummaryResponse>('/personnel/time-clock/summary'),
    refetchInterval: 60_000,
  });
  const mirrorQuery = useQuery<MirrorResponse>({
    queryKey: ['time-clock', 'mirror', mirrorMonth],
    queryFn: () => api<MirrorResponse>(`/personnel/time-clock/me?from=${mirrorMonth}-01&to=${monthEnd(mirrorMonth)}`),
  });
  const myAdjustmentsQuery = useQuery<AdjustmentRequest[]>({
    queryKey: ['time-clock', 'adjustments', 'mine'],
    queryFn: () => api<AdjustmentRequest[]>('/personnel/time-clock/adjustments'),
  });
  const teamQuery = useQuery<{ dayKey: string; rows: TeamRow[] }>({
    queryKey: ['time-clock', 'team', teamDay],
    queryFn: () => api(`/personnel/time-clock/team${teamDay ? `?day=${teamDay}` : ''}`),
    enabled: canTeam && tab === 'equipe',
  });
  const pendingQuery = useQuery<AdjustmentRequest[]>({
    queryKey: ['time-clock', 'adjustments', 'pending'],
    queryFn: () => api<AdjustmentRequest[]>('/personnel/time-clock/adjustments/pending'),
    enabled: canManage,
  });
  const templatesQuery = useQuery<ShiftTemplate[]>({
    queryKey: ['time-clock', 'templates'],
    queryFn: () => api<ShiftTemplate[]>('/personnel/schedules'),
    enabled: tab === 'escalas' || tab === 'meu-ponto',
  });
  const assignmentsQuery = useQuery<Array<{ id: string; startsAt: string; cycleAnchorDay: string | null; user: { id: string; name: string } | null; template: { id: string; name: string; kind?: 'WEEKLY' | 'CYCLE' } }>>({
    queryKey: ['time-clock', 'assignments'],
    queryFn: () => api('/personnel/schedules/assignments'),
    enabled: canManage && tab === 'escalas',
  });
  const optionsQuery = useQuery<{ users: Array<{ id: string; name: string; email: string; jobTitle: string | null }> }>({
    queryKey: ['time-clock', 'options'],
    queryFn: () => api('/personnel/options'),
    enabled: canManage && tab === 'escalas',
  });
  const periodsQuery = useQuery<PeriodRow[]>({
    queryKey: ['time-clock', 'periods'],
    queryFn: () => api<PeriodRow[]>('/personnel/time-clock/periods'),
    enabled: canManage && tab === 'fechamento',
  });
  const holidaysQuery = useQuery<HolidayRow[]>({
    queryKey: ['time-clock', 'holidays', holidayYear],
    queryFn: () => api<HolidayRow[]>(`/personnel/holidays?year=${holidayYear}`),
    enabled: canManage && tab === 'escalas',
  });
  const explainQuery = useQuery<CalculationExplanation>({
    queryKey: ['time-clock', 'explain', explainTarget?.userId, explainTarget?.dayKey],
    queryFn: () => api<CalculationExplanation>(`/personnel/time-clock/explain/${encodeURIComponent(explainTarget!.userId)}/${explainTarget!.dayKey}`),
    enabled: Boolean(explainTarget),
  });
  const kioskDevicesQuery = useQuery<KioskDevice[]>({
    queryKey: ['time-clock', 'kiosk-devices'],
    queryFn: () => api<KioskDevice[]>('/personnel/kiosk/devices'),
    enabled: canManage && tab === 'escalas',
  });
  const occurrencesQuery = useQuery<OccurrenceRow[]>({
    queryKey: ['time-clock', 'occurrences', occurrenceFilter],
    queryFn: () =>
      api<OccurrenceRow[]>(
        `/personnel/occurrences?status=${occurrenceFilter.status}&from=${occurrenceFilter.from}&to=${occurrenceFilter.to}`,
      ),
    enabled: canTeam && tab === 'ocorrencias',
  });
  const myOccurrencesQuery = useQuery<OccurrenceRow[]>({
    queryKey: ['time-clock', 'occurrences', 'mine'],
    queryFn: () => api<OccurrenceRow[]>('/personnel/occurrences/mine'),
  });
  const bankQuery = useQuery<BankStatement>({
    queryKey: ['time-clock', 'bank', 'me'],
    queryFn: () => api<BankStatement>('/personnel/time-bank/me'),
  });
  const closingPreviewQuery = useQuery<ClosingPreview>({
    queryKey: ['time-clock', 'closing-preview', previewRef],
    queryFn: () => api<ClosingPreview>(`/personnel/time-clock/periods/${previewRef}/preview`),
    enabled: canManage && Boolean(previewRef),
  });
  const payrollEventsQuery = useQuery<PayrollEventsResponse>({
    queryKey: ['time-clock', 'payroll-events', payrollRef],
    queryFn: () => api<PayrollEventsResponse>(`/personnel/payroll/events/${payrollRef}`),
    enabled: canManage && tab === 'fechamento' && Boolean(payrollRef),
  });
  const payrollRubricsQuery = useQuery<PayrollRubric[]>({
    queryKey: ['time-clock', 'payroll-rubrics'],
    queryFn: () => api<PayrollRubric[]>('/personnel/payroll/rubrics'),
    enabled: canManage && tab === 'fechamento',
  });

  const summary = summaryQuery.data;
  const mirror = mirrorQuery.data;
  const selectedTemplate = (templatesQuery.data ?? []).find((template) => template.id === assignForm.templateId) ?? null;
  const templateValidation = validateTemplateForm(templateForm);

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ['time-clock'] });
    void qc.invalidateQueries({ queryKey: ['my-day'] });
  };

  const punch = useMutation({
    mutationFn: async () => {
      const position = await currentPositionOrNull();
      return api('/personnel/time-clock/punch', {
        method: 'POST',
        json: position
          ? { latitude: position.coords.latitude, longitude: position.coords.longitude, accuracy: position.coords.accuracy }
          : {},
      });
    },
    onSuccess: (result: any) => {
      const kind = result?.entry?.kind === 'OUT' ? 'Saída' : 'Entrada';
      toast.success(`${kind} registrada às ${formatTime(result?.entry?.punchedAt)}`);
      invalidate();
    },
    onError: (e: any) => toast.error(e?.message ?? 'Não foi possível registrar a batida'),
  });

  const requestAdjustment = useMutation({
    mutationFn: (payload: { dayKey: string; proposedTimes: string[]; reason: string; type: 'HORARIOS' | 'ABONO_DIA'; category: string }) =>
      api('/personnel/time-clock/adjustments', { method: 'POST', json: payload }),
    onSuccess: (_result, variables) => {
      toast.success(variables.type === 'ABONO_DIA' ? 'Pedido de abono enviado' : 'Solicitação de ajuste enviada');
      setAdjustDialog(null);
      invalidate();
    },
    onError: (e: any) => toast.error(e?.message ?? 'Não foi possível solicitar o ajuste'),
  });

  const treatOccurrence = useMutation({
    mutationFn: ({ id, action, note }: { id: string; action: 'justify' | 'dismiss'; note: string }) =>
      api(`/personnel/occurrences/${id}/${action}`, { method: 'POST', json: { note } }),
    onSuccess: (_result, variables) => {
      toast.success(variables.action === 'justify' ? 'Ocorrência justificada' : 'Ocorrência dispensada');
      void qc.invalidateQueries({ queryKey: ['time-clock', 'occurrences'] });
    },
    onError: (e: any) => toast.error(e?.message ?? 'Não foi possível tratar a ocorrência'),
  });

  const scanOccurrences = useMutation({
    mutationFn: () =>
      api<{ created: number; resolved: number; users: number }>('/personnel/occurrences/scan', {
        method: 'POST',
        json: { from: occurrenceFilter.from, to: occurrenceFilter.to },
      }),
    onSuccess: (result) => {
      toast.success(`Varredura concluída: ${result.created} nova(s), ${result.resolved} resolvida(s) em ${result.users} colaborador(es)`);
      void qc.invalidateQueries({ queryKey: ['time-clock', 'occurrences'] });
    },
    onError: (e: any) => toast.error(e?.message ?? 'Não foi possível varrer o período'),
  });

  const decideAdjustment = useMutation({
    mutationFn: ({ id, action, note }: { id: string; action: 'approve' | 'reject'; note?: string }) =>
      api(`/personnel/time-clock/adjustments/${id}/${action}`, { method: 'POST', json: { note } }),
    onSuccess: (_, variables) => {
      toast.success(variables.action === 'approve' ? 'Ajuste aprovado e espelho atualizado' : 'Ajuste rejeitado');
      invalidate();
    },
    onError: (e: any) => toast.error(e?.message ?? 'Não foi possível decidir o ajuste'),
  });

  const createTemplate = useMutation({
    mutationFn: () => {
      const weeklyRules = Object.fromEntries(
        WEEKDAYS.map(({ key }) => {
          const day = templateForm.days[key];
          return [key, day.enabled ? { start: day.start, end: day.end, breakMinutes: Number(day.breakMinutes) || 0 } : null];
        }),
      );
      const cycleRules = templateForm.cycleDays.map((day) =>
        day.enabled ? { start: day.start, end: day.end, breakMinutes: Number(day.breakMinutes) || 0 } : null,
      );
      return api('/personnel/schedules', {
        method: 'POST',
        json: {
          name: templateForm.name,
          description: templateForm.description || null,
          toleranceMinutes: Number(templateForm.toleranceMinutes),
          kind: templateForm.kind,
          worksHolidays: templateForm.worksHolidays,
          ...(templateForm.kind === 'CYCLE' ? { cycleRules } : { weeklyRules }),
        },
      });
    },
    onSuccess: () => {
      toast.success('Escala criada');
      setTemplateDialog(false);
      setTemplateForm(DEFAULT_TEMPLATE_FORM());
      invalidate();
    },
    onError: (e: any) => toast.error(e?.message ?? 'Não foi possível criar a escala'),
  });

  const patchTemplate = useMutation({
    mutationFn: ({ id, json }: { id: string; json: Record<string, unknown> }) =>
      api(`/personnel/schedules/${id}`, { method: 'PATCH', json }),
    onSuccess: () => {
      toast.success('Escala atualizada');
      invalidate();
    },
    onError: (e: any) => toast.error(e?.message ?? 'Não foi possível atualizar a escala'),
  });

  const assign = useMutation({
    mutationFn: () => api('/personnel/schedules/assign', { method: 'POST', json: assignForm }),
    onSuccess: (result: any) => {
      toast.success(`Escala atribuída a ${result?.assigned ?? assignForm.userIds.length} colaborador(es)`);
      setAssignForm({ templateId: '', userIds: [], cycleAnchorDay: '' });
      invalidate();
    },
    onError: (e: any) => toast.error(e?.message ?? 'Não foi possível atribuir a escala'),
  });

  const importPunches = useMutation({
    mutationFn: (content: string) => api<{ imported: number; duplicates: number; errors: string[] }>('/personnel/time-clock/import', { method: 'POST', json: { content } }),
    onSuccess: (result) => {
      setImportResult(result);
      toast.success(`${result.imported} batida(s) importada(s)`);
      invalidate();
    },
    onError: (e: any) => toast.error(e?.message ?? 'Não foi possível importar as batidas'),
  });

  const closePeriod = useMutation({
    mutationFn: (ref: string) => api(`/personnel/time-clock/periods/${ref}/close`, { method: 'POST', json: {} }),
    onSuccess: () => {
      toast.success('Competência fechada');
      setPreviewRef(null);
      invalidate();
    },
    onError: (e: any) => toast.error(e?.message ?? 'Não foi possível fechar a competência'),
  });

  const setRubric = useMutation({
    mutationFn: (payload: { eventKey: string; payrollCode: string }) => api('/personnel/payroll/rubrics', { method: 'POST', json: payload }),
    onSuccess: () => {
      toast.success('Rubrica atualizada');
      void qc.invalidateQueries({ queryKey: ['time-clock', 'payroll-rubrics'] });
    },
    onError: (e: any) => toast.error(e?.message ?? 'Não foi possível salvar a rubrica'),
  });

  const reopenPeriod = useMutation({
    mutationFn: ({ ref, note }: { ref: string; note: string }) =>
      api(`/personnel/time-clock/periods/${ref}/reopen`, { method: 'POST', json: { note } }),
    onSuccess: () => {
      toast.success('Competência reaberta');
      invalidate();
    },
    onError: (e: any) => toast.error(e?.message ?? 'Não foi possível reabrir a competência'),
  });

  const createHoliday = useMutation({
    mutationFn: () => api('/personnel/holidays', { method: 'POST', json: holidayForm }),
    onSuccess: () => {
      toast.success('Feriado cadastrado');
      setHolidayForm({ dayKey: '', name: '', kind: 'COMPANY' });
      void qc.invalidateQueries({ queryKey: ['time-clock', 'holidays'] });
      invalidate();
    },
    onError: (e: any) => toast.error(e?.message ?? 'Não foi possível cadastrar o feriado'),
  });

  const generateHolidays = useMutation({
    mutationFn: () => api<{ created: number }>('/personnel/holidays/generate', { method: 'POST', json: { year: Number(holidayYear) } }),
    onSuccess: (result) => {
      toast.success(`${result.created} feriado(s) nacional(is) carregado(s) para ${holidayYear}`);
      void qc.invalidateQueries({ queryKey: ['time-clock', 'holidays'] });
      invalidate();
    },
    onError: (e: any) => toast.error(e?.message ?? 'Não foi possível gerar os feriados'),
  });

  const deleteHoliday = useMutation({
    mutationFn: (id: string) => api(`/personnel/holidays/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast.success('Feriado removido');
      void qc.invalidateQueries({ queryKey: ['time-clock', 'holidays'] });
      invalidate();
    },
    onError: (e: any) => toast.error(e?.message ?? 'Não foi possível remover o feriado'),
  });

  const createKiosk = useMutation({
    mutationFn: () => api<{ device: KioskDevice; token: string }>('/personnel/kiosk/devices', { method: 'POST', json: { name: kioskName } }),
    onSuccess: (result) => {
      setCreatedKiosk(result);
      setKioskName('');
      toast.success('Totem cadastrado. Guarde o token exibido agora.');
      void qc.invalidateQueries({ queryKey: ['time-clock', 'kiosk-devices'] });
    },
    onError: (e: any) => toast.error(e?.message ?? 'Não foi possível cadastrar o totem'),
  });

  const toggleKiosk = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) => api<KioskDevice>(`/personnel/kiosk/devices/${id}`, { method: 'PATCH', json: { active } }),
    onSuccess: (_, variables) => {
      toast.success(variables.active ? 'Totem ativado' : 'Totem desativado');
      void qc.invalidateQueries({ queryKey: ['time-clock', 'kiosk-devices'] });
    },
    onError: (e: any) => toast.error(e?.message ?? 'Não foi possível atualizar o totem'),
  });

  const openAdjustDialog = (day: MirrorDay) => {
    const times = day.entries.map((entry) => formatTime(entry.punchedAt));
    setAdjustDialog({
      dayKey: day.dayKey,
      times: times.length ? times : ['08:00', '17:00'],
      reason: '',
      // Falta sem batidas sugere abono; demais casos sugerem correção de horários.
      type: day.status === 'ABSENT' ? 'ABONO_DIA' : 'HORARIOS',
      category: day.status === 'ABSENT' ? 'ATESTADO' : 'ESQUECIMENTO',
    });
  };

  const downloadReceipt = async (entry: PunchEntry) => {
    setReceiptEntryId(entry.id);
    try {
      const receipt = await api<PunchReceipt>(`/personnel/time-clock/entries/${entry.id}/receipt`);
      await buildPunchReceiptPdf(receipt);
      toast.success('Extrato interno da marcação gerado');
    } catch (error: any) {
      toast.error(error?.message ?? 'Não foi possível gerar o extrato da marcação');
    } finally {
      setReceiptEntryId(null);
    }
  };

  const monthBalance = summary?.month?.balanceMinutes ?? 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Controle de Ponto"
        description="Batida com geolocalização, espelho explicável, extratos internos, ajustes auditados, escalas semanais ou cíclicas e fechamento de competência."
      />

      <Tabs value={tab} onValueChange={setTab} className="space-y-4">
        <TabsList className="bg-slate-100 dark:bg-slate-800">
          <TabsTrigger value="meu-ponto" className="text-xs font-semibold"><Fingerprint className="mr-2 h-4 w-4" />Meu Ponto</TabsTrigger>
          {canTeam && <TabsTrigger value="equipe" className="text-xs font-semibold"><Users className="mr-2 h-4 w-4" />Equipe</TabsTrigger>}
          {canTeam && (
            <TabsTrigger value="ajustes" className="text-xs font-semibold">
              <ListChecks className="mr-2 h-4 w-4" />Ajustes
              {(summary?.pendingAdjustments ?? 0) > 0 && (
                <span className="ml-1.5 rounded-full bg-status-yellow/20 px-1.5 text-[10px] font-bold text-status-yellow">{summary?.pendingAdjustments}</span>
              )}
            </TabsTrigger>
          )}
          {canTeam && <TabsTrigger value="ocorrencias" className="text-xs font-semibold"><AlertTriangle className="mr-2 h-4 w-4" />Ocorrências</TabsTrigger>}
          {canManage && <TabsTrigger value="escalas" className="text-xs font-semibold"><CalendarClock className="mr-2 h-4 w-4" />Escalas</TabsTrigger>}
          {canManage && <TabsTrigger value="fechamento" className="text-xs font-semibold"><Lock className="mr-2 h-4 w-4" />Fechamento</TabsTrigger>}
        </TabsList>

        {/* ------------------------------ Meu Ponto ------------------------------ */}
        <TabsContent value="meu-ponto">
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-[360px_1fr]">
            <div className="space-y-4">
              {/* Cartão de batida */}
              <Card className="border border-slate-100 bg-white shadow-sm dark:border-slate-800/80 dark:bg-slate-900/50">
                <CardContent className="space-y-4 p-5 text-center">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    {now.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })}
                  </div>
                  <div className="font-mono text-4xl font-extrabold tabular-nums text-slate-900 dark:text-white">
                    {now.toLocaleTimeString('pt-BR')}
                  </div>
                  <Button
                    size="lg"
                    className="h-12 w-full bg-sky-500 text-sm font-bold text-white hover:bg-sky-600"
                    disabled={punch.isPending || summary?.period?.status === 'CLOSED'}
                    onClick={() => punch.mutate()}
                  >
                    <AlarmClockCheck className="mr-2 h-5 w-5" />
                    {punch.isPending
                      ? 'Registrando...'
                      : summary?.today?.nextKind === 'OUT'
                        ? 'Registrar saída'
                        : 'Registrar entrada'}
                  </Button>
                  <Button asChild variant="outline" size="lg" className="h-11 w-full border-cyan-500/40 text-cyan-700 hover:bg-cyan-500/5 dark:text-cyan-300">
                    <Link href="/servico-pessoal/ponto-facial"><Camera className="mr-2 h-5 w-5" />Usar reconhecimento facial</Link>
                  </Button>
                  {summary?.today?.expectedEndAt && summary?.today?.nextKind === 'OUT' && (
                    <div className="rounded-md border border-sky-400/30 bg-sky-500/5 p-2 text-[11px] text-sky-700 dark:text-sky-300">
                      Saída prevista às <span className="font-bold tabular-nums">{formatTime(summary.today.expectedEndAt)}</span>
                    </div>
                  )}
                  {summary?.today?.expectedStartAt && summary?.today?.nextKind === 'IN' && (summary?.today?.entries ?? []).length === 0 && (
                    <div className="rounded-md border border-sky-400/30 bg-sky-500/5 p-2 text-[11px] text-sky-700 dark:text-sky-300">
                      Próxima marcação esperada: entrada às <span className="font-bold tabular-nums">{formatTime(summary.today.expectedStartAt)}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-center gap-1 text-[10px] text-muted-foreground">
                    <MapPin className="h-3 w-3" />A localização é registrada junto com a batida, quando autorizada.
                  </div>
                  {summary?.period?.status === 'CLOSED' && (
                    <div className="rounded-md border border-status-red/40 bg-status-red/5 p-2 text-[11px] text-status-red">
                      Competência {summary.period.ref} fechada — batidas bloqueadas.
                    </div>
                  )}
                  <div className="border-t pt-3">
                    <div className="mb-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Batidas de hoje</div>
                    {(summary?.today?.entries ?? []).length === 0 ? (
                      <div className="text-xs text-muted-foreground">Nenhuma batida registrada hoje.</div>
                    ) : (
                      <div className="flex flex-wrap justify-center gap-1.5">
                        {(summary?.today?.entries ?? []).map((entry) => (
                          <span key={entry.id} className="inline-flex items-center rounded-md border bg-background">
                            <Badge variant="outline" className={cn('border-0 text-[10px] tabular-nums', entry.kind === 'IN' ? 'text-status-green' : 'text-status-red')}>
                              {entry.kind === 'IN' ? '→' : '←'} {formatTime(entry.punchedAt)}
                              {entry.nsr ? ` · NSR ${entry.nsr}` : ''}
                              {entry.source === 'MANUAL' && ' (ajuste)'}
                              {entry.source === 'FACIAL' && ' (facial)'}
                            </Badge>
                            <button
                              type="button"
                              className="border-l px-1.5 py-1 text-muted-foreground transition hover:text-sky-600 disabled:opacity-50"
                              disabled={Boolean(receiptEntryId)}
                              title="Baixar extrato interno — não substitui comprovante REP-P"
                              aria-label={`Baixar extrato interno da marcação${entry.nsr ? ` NSR ${entry.nsr}` : ''}`}
                              onClick={() => void downloadReceipt(entry)}
                            >
                              <FileDown className="h-3 w-3" />
                            </button>
                          </span>
                        ))}
                      </div>
                    )}
                    {(summary?.today?.entries ?? []).length > 0 && (
                      <div className="mt-2 text-[9px] text-muted-foreground">O extrato interno não substitui o comprovante oficial de um REP-P.</div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Resumo do mês */}
              <Card className="border border-slate-100 bg-white shadow-sm dark:border-slate-800/80 dark:bg-slate-900/50">
                <CardContent className="space-y-2 p-4 text-xs">
                  <div className="font-semibold text-slate-800 dark:text-slate-200">Resumo do mês</div>
                  <SummaryLine label="Horas previstas" value={minutesLabel(summary?.month?.plannedMinutes ?? 0)} />
                  <SummaryLine label="Horas trabalhadas" value={minutesLabel(summary?.month?.workedMinutes ?? 0)} />
                  <SummaryLine
                    label="Banco de horas (mês)"
                    value={`${monthBalance > 0 ? '+' : ''}${minutesLabel(monthBalance)}`}
                    className={monthBalance > 0 ? 'text-status-green' : monthBalance < 0 ? 'text-status-red' : undefined}
                  />
                  <SummaryLine
                    label="Banco acumulado"
                    value={`${(summary?.bank?.totalMinutes ?? 0) > 0 ? '+' : ''}${minutesLabel(summary?.bank?.totalMinutes ?? 0)}`}
                    className={(summary?.bank?.totalMinutes ?? 0) > 0 ? 'text-status-green' : (summary?.bank?.totalMinutes ?? 0) < 0 ? 'text-status-red' : undefined}
                  />
                  <SummaryLine label="Dias inconsistentes" value={String(summary?.month?.inconsistentDays ?? 0)} className={summary?.month?.inconsistentDays ? 'text-status-yellow' : undefined} />
                  <SummaryLine label="Faltas" value={String(summary?.month?.absentDays ?? 0)} className={summary?.month?.absentDays ? 'text-status-red' : undefined} />
                  {(bankQuery.data?.expiringSoonMinutes ?? 0) > 0 && (
                    <div className="rounded-md border border-amber-400/40 bg-amber-500/5 p-2 text-[11px] text-amber-700 dark:text-amber-300">
                      {minutesLabel(bankQuery.data!.expiringSoonMinutes)} do seu banco vencem nos próximos 30 dias.
                    </div>
                  )}
                  <Button variant="outline" size="sm" className="mt-1 h-7 w-full text-[11px]" onClick={() => setBankOpen(true)}>
                    <History className="mr-1.5 h-3.5 w-3.5" />Ver extrato do banco de horas
                  </Button>
                </CardContent>
              </Card>

              {/* Minhas solicitações */}
              <Card className="border border-slate-100 bg-white shadow-sm dark:border-slate-800/80 dark:bg-slate-900/50">
                <CardContent className="space-y-2 p-4 text-xs">
                  <div className="font-semibold text-slate-800 dark:text-slate-200">Minhas solicitações de ajuste</div>
                  {(myAdjustmentsQuery.data ?? []).length === 0 && <div className="text-muted-foreground">Nenhuma solicitação enviada.</div>}
                  {(myAdjustmentsQuery.data ?? []).slice(0, 6).map((request) => (
                    <div key={request.id} className="flex items-center justify-between gap-2 rounded-md border p-2">
                      <div className="min-w-0">
                        <div className="font-semibold tabular-nums">{formatDayKey(request.dayKey)}</div>
                        <div className="truncate text-[10px] text-muted-foreground">{request.reason}</div>
                      </div>
                      <Badge variant="outline" className={cn('shrink-0 text-[9px]', request.status === 'APPROVED' ? 'border-status-green/40 text-status-green' : request.status === 'REJECTED' ? 'border-status-red/40 text-status-red' : 'border-status-yellow/40 text-status-yellow')}>
                        {ADJUSTMENT_STATUS_LABEL[request.status] ?? request.status}
                      </Badge>
                    </div>
                  ))}
                </CardContent>
              </Card>

              {/* Minhas ocorrências (últimos 60 dias) */}
              <Card className="border border-slate-100 bg-white shadow-sm dark:border-slate-800/80 dark:bg-slate-900/50">
                <CardContent className="space-y-2 p-4 text-xs">
                  <div className="font-semibold text-slate-800 dark:text-slate-200">Minhas ocorrências</div>
                  {(myOccurrencesQuery.data ?? []).length === 0 && (
                    <div className="text-muted-foreground">Nenhuma ocorrência nos últimos 60 dias. 🎉</div>
                  )}
                  {(myOccurrencesQuery.data ?? []).slice(0, 6).map((occurrence) => (
                    <div key={occurrence.id} className="flex items-center justify-between gap-2 rounded-md border p-2">
                      <div className="min-w-0">
                        <div className="font-semibold tabular-nums">{formatDayKey(occurrence.dayKey)}</div>
                        <div className="truncate text-[10px] text-muted-foreground">
                          {OCCURRENCE_TYPE_LABEL[occurrence.type] ?? occurrence.type}
                          {occurrence.minutes ? ` · ${minutesLabel(occurrence.minutes)}` : ''}
                        </div>
                      </div>
                      <Badge
                        variant="outline"
                        className={cn(
                          'shrink-0 text-[9px]',
                          occurrence.status === 'OPEN' ? 'border-status-yellow/40 text-status-yellow' : occurrence.status === 'RESOLVED' ? 'border-status-green/40 text-status-green' : 'border-border text-muted-foreground',
                        )}
                      >
                        {OCCURRENCE_STATUS_LABEL[occurrence.status]}
                      </Badge>
                    </div>
                  ))}
                  <div className="text-[9px] text-muted-foreground">
                    Ocorrências em aberto podem ser resolvidas solicitando um ajuste ou abono do dia no espelho.
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Espelho do mês */}
            <Card className="min-w-0 border border-slate-100 bg-white shadow-sm dark:border-slate-800/80 dark:bg-slate-900/50">
              <div className="flex items-center justify-between border-b px-4 py-2.5">
                <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-white">
                  <History className="h-4 w-4 text-sky-500" />Espelho de ponto — {formatDayKey(`${mirrorMonth}-01`).slice(3)}
                </h3>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => setMirrorMonth((m) => addMonths(m, -1))}>‹ mês anterior</Button>
                  <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" disabled={mirrorMonth >= currentMonth} onClick={() => setMirrorMonth((m) => addMonths(m, 1))}>próximo ›</Button>
                </div>
              </div>
              <CardContent className="overflow-x-auto p-0">
                <table className="w-full min-w-[900px] text-xs">
                  <thead className="border-b bg-slate-50/60 text-[10px] uppercase tracking-wider text-muted-foreground dark:bg-slate-900/40">
                    <tr>
                      <th className="px-4 py-2.5 text-left">Dia</th>
                      <th className="px-2 py-2.5 text-left">Batidas</th>
                      <th className="px-2 py-2.5 text-right">Prevista</th>
                      <th className="px-2 py-2.5 text-right">Trabalhada</th>
                      <th className="px-2 py-2.5 text-right">Saldo</th>
                      <th className="px-2 py-2.5 text-left">Situação</th>
                      <th className="px-4 py-2.5 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                    {(mirror?.days ?? []).map((day) => (
                      <tr key={day.dayKey} className={cn(day.dayKey === mirror?.today && 'bg-sky-50/40 dark:bg-sky-950/20')}>
                        <td className="px-4 py-2 font-semibold tabular-nums">
                          {formatDayKey(day.dayKey)} <span className="text-[10px] font-normal text-muted-foreground">{WEEKDAY_SHORT[day.weekday]}</span>
                        </td>
                        <td className="px-2 py-2">
                          {day.entries.length === 0 ? (
                            <span className="text-muted-foreground">—</span>
                          ) : (
                            <span className="flex flex-wrap gap-1">
                              {day.entries.map((entry) => (
                                <span key={entry.id} className="inline-flex items-center rounded border bg-background tabular-nums">
                                  <span className="px-1.5 py-0.5" title={entry.nsr ? `NSR ${entry.nsr}` : undefined}>
                                    {formatTime(entry.punchedAt)}{entry.nsr ? ` · ${entry.nsr}` : ''}
                                  </span>
                                  <button
                                    type="button"
                                    className="border-l px-1 py-0.5 text-muted-foreground hover:text-sky-600 disabled:opacity-50"
                                    disabled={Boolean(receiptEntryId)}
                                    title="Extrato interno — não substitui comprovante REP-P"
                                    aria-label={`Baixar extrato interno da marcação${entry.nsr ? ` NSR ${entry.nsr}` : ''}`}
                                    onClick={() => void downloadReceipt(entry)}
                                  >
                                    <FileDown className="h-3 w-3" />
                                  </button>
                                </span>
                              ))}
                            </span>
                          )}
                        </td>
                        <td className="px-2 py-2 text-right tabular-nums">{day.plannedMinutes ? minutesLabel(day.plannedMinutes) : '—'}</td>
                        <td className="px-2 py-2 text-right tabular-nums">{day.workedMinutes ? minutesLabel(day.workedMinutes) : '—'}</td>
                        <td className={cn('px-2 py-2 text-right font-semibold tabular-nums', day.balanceMinutes > 0 ? 'text-status-green' : day.balanceMinutes < 0 ? 'text-status-red' : 'text-muted-foreground')}>
                          {day.balanceMinutes ? `${day.balanceMinutes > 0 ? '+' : ''}${minutesLabel(day.balanceMinutes)}` : '—'}
                        </td>
                        <td className="px-2 py-2">
                          <Badge variant="outline" className={cn('text-[10px]', STATUS_CLASS[day.status])} title={day.holiday ?? undefined}>
                            {STATUS_LABEL[day.status]}
                          </Badge>
                          {day.holiday && day.status !== 'HOLIDAY' && (
                            <Badge variant="outline" className="ml-1 border-amber-400/50 text-[9px] text-amber-600" title={day.holiday}>feriado</Badge>
                          )}
                          {day.adjustment?.status === 'REQUESTED' && (
                            <Badge variant="outline" className="ml-1 border-status-yellow/40 text-[9px] text-status-yellow">ajuste pendente</Badge>
                          )}
                        </td>
                        <td className="px-4 py-2 text-right">
                          <div className="flex flex-wrap justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 text-[10px]"
                              disabled={!user?.id}
                              onClick={() => user?.id && setExplainTarget({ userId: user.id, dayKey: day.dayKey })}
                            >
                              <Calculator className="mr-1 h-3 w-3" />Entenda o cálculo
                            </Button>
                            {day.dayKey <= (mirror?.today ?? '') && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 text-[10px]"
                                disabled={day.adjustment?.status === 'REQUESTED'}
                                onClick={() => openAdjustDialog(day)}
                              >
                                Solicitar ajuste
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ------------------------------ Equipe ------------------------------ */}
        {canTeam && (
          <TabsContent value="equipe">
            <Card className="border border-slate-100 bg-white shadow-sm dark:border-slate-800/80 dark:bg-slate-900/50">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
                <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-white">
                  <Users className="h-4 w-4 text-sky-500" />Espelho da equipe — {teamQuery.data ? formatDayKey(teamQuery.data.dayKey) : ''}
                </h3>
                <Input type="date" className="h-8 w-40 text-xs" value={teamDay} onChange={(e) => setTeamDay(e.target.value)} />
              </div>
              <CardContent className="overflow-x-auto p-0">
                <table className="w-full min-w-[900px] text-xs">
                  <thead className="border-b bg-slate-50/60 text-[10px] uppercase tracking-wider text-muted-foreground dark:bg-slate-900/40">
                    <tr>
                      <th className="px-4 py-2.5 text-left">Colaborador</th>
                      <th className="px-2 py-2.5 text-left">Batidas</th>
                      <th className="px-2 py-2.5 text-right">Prevista</th>
                      <th className="px-2 py-2.5 text-right">Trabalhada</th>
                      <th className="px-2 py-2.5 text-left">Situação</th>
                      <th className="px-4 py-2.5 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                    {(teamQuery.data?.rows ?? []).map((row) => (
                      <tr key={row.user.id}>
                        <td className="max-w-[240px] px-4 py-2">
                          <div className="truncate font-medium text-slate-800 dark:text-slate-200">{row.user.name}</div>
                          <div className="truncate text-[10px] text-muted-foreground">{row.user.jobTitle ?? row.user.email}</div>
                        </td>
                        <td className="px-2 py-2 tabular-nums">
                          {row.entries.length === 0 ? <span className="text-muted-foreground">—</span> : row.entries.map((entry) => formatTime(entry.punchedAt)).join(' · ')}
                        </td>
                        <td className="px-2 py-2 text-right tabular-nums">{row.plannedMinutes ? minutesLabel(row.plannedMinutes) : '—'}</td>
                        <td className="px-2 py-2 text-right tabular-nums">{row.workedMinutes ? minutesLabel(row.workedMinutes) : '—'}</td>
                        <td className="px-2 py-2">
                          <Badge variant="outline" className={cn('text-[10px]', STATUS_CLASS[row.status])}>{STATUS_LABEL[row.status]}</Badge>
                          {!row.hasSchedule && <span className="ml-1 text-[9px] text-muted-foreground">sem escala</span>}
                        </td>
                        <td className="px-4 py-2 text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 text-[10px]"
                            onClick={() => setExplainTarget({ userId: row.user.id, dayKey: teamQuery.data?.dayKey ?? teamDay })}
                          >
                            <Calculator className="mr-1 h-3 w-3" />Entenda o cálculo
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {teamQuery.isLoading && <div className="p-6 text-center text-xs text-muted-foreground">Carregando equipe...</div>}
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {/* ------------------------------ Central de Ocorrências ------------------------------ */}
        {canTeam && (
          <TabsContent value="ocorrencias">
            <Card className="border border-slate-100 bg-white shadow-sm dark:border-slate-800/80 dark:bg-slate-900/50">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
                <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-white">
                  <AlertTriangle className="h-4 w-4 text-sky-500" />Central de Ocorrências
                </h3>
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <NativeSelect className="h-8 w-36 text-xs" value={occurrenceFilter.status} onChange={(e) => setOccurrenceFilter((f) => ({ ...f, status: e.target.value }))}>
                    <option value="OPEN">Em aberto</option>
                    <option value="JUSTIFIED">Justificadas</option>
                    <option value="DISMISSED">Dispensadas</option>
                    <option value="RESOLVED">Resolvidas</option>
                    <option value="">Todas</option>
                  </NativeSelect>
                  <Input type="date" className="h-8 w-36 text-xs" value={occurrenceFilter.from} onChange={(e) => setOccurrenceFilter((f) => ({ ...f, from: e.target.value }))} />
                  <Input type="date" className="h-8 w-36 text-xs" value={occurrenceFilter.to} onChange={(e) => setOccurrenceFilter((f) => ({ ...f, to: e.target.value }))} />
                  <Button size="sm" variant="outline" className="h-8 text-xs" disabled={scanOccurrences.isPending} onClick={() => scanOccurrences.mutate()}>
                    {scanOccurrences.isPending ? 'Varrendo...' : 'Varrer período'}
                  </Button>
                </div>
              </div>
              <CardContent className="overflow-x-auto p-0">
                <table className="w-full min-w-[860px] text-xs">
                  <thead className="border-b bg-slate-50/60 text-[10px] uppercase tracking-wider text-muted-foreground dark:bg-slate-900/40">
                    <tr>
                      <th className="px-4 py-2.5 text-left">Dia</th>
                      <th className="px-2 py-2.5 text-left">Colaborador</th>
                      <th className="px-2 py-2.5 text-left">Ocorrência</th>
                      <th className="px-2 py-2.5 text-left">Criticidade</th>
                      <th className="px-2 py-2.5 text-right">Impacto</th>
                      <th className="px-2 py-2.5 text-left">Situação</th>
                      <th className="px-4 py-2.5 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                    {(occurrencesQuery.data ?? []).map((occurrence) => (
                      <tr key={occurrence.id}>
                        <td className="px-4 py-2 font-semibold tabular-nums">{formatDayKey(occurrence.dayKey)}</td>
                        <td className="px-2 py-2">
                          <div className="max-w-[220px] truncate">{occurrence.user?.name ?? '—'}</div>
                        </td>
                        <td className="px-2 py-2">{OCCURRENCE_TYPE_LABEL[occurrence.type] ?? occurrence.type}</td>
                        <td className="px-2 py-2">
                          <Badge variant="outline" className={cn('text-[9px]', OCCURRENCE_SEVERITY_META[occurrence.severity].className)}>
                            {OCCURRENCE_SEVERITY_META[occurrence.severity].label}
                          </Badge>
                        </td>
                        <td className="px-2 py-2 text-right tabular-nums">{occurrence.minutes ? minutesLabel(occurrence.minutes) : '—'}</td>
                        <td className="px-2 py-2">
                          <Badge variant="outline" className="text-[9px]" title={occurrence.justification ?? undefined}>
                            {OCCURRENCE_STATUS_LABEL[occurrence.status]}
                          </Badge>
                        </td>
                        <td className="px-4 py-2 text-right">
                          {occurrence.status === 'OPEN' && (
                            <>
                              <Button variant="ghost" size="sm" className="h-6 text-[10px]" onClick={() => setReasonDialog({
                                title: `Justificar — ${OCCURRENCE_TYPE_LABEL[occurrence.type] ?? occurrence.type} (${formatDayKey(occurrence.dayKey)})`,
                                label: 'Justificativa',
                                required: true,
                                confirmLabel: 'Justificar ocorrência',
                                onConfirm: (reason) => treatOccurrence.mutate({ id: occurrence.id, action: 'justify', note: reason }),
                              })}>
                                Justificar
                              </Button>
                              {canManage && (
                                <Button variant="ghost" size="sm" className="h-6 text-[10px] text-muted-foreground" onClick={() => setReasonDialog({
                                  title: `Dispensar ocorrência (${formatDayKey(occurrence.dayKey)})`,
                                  label: 'Motivo da dispensa',
                                  required: true,
                                  confirmLabel: 'Dispensar',
                                  destructive: true,
                                  onConfirm: (reason) => treatOccurrence.mutate({ id: occurrence.id, action: 'dismiss', note: reason }),
                                })}>
                                  Dispensar
                                </Button>
                              )}
                            </>
                          )}
                          <Button variant="ghost" size="sm" className="h-6 text-[10px]" onClick={() => occurrence.user && setExplainTarget({ userId: occurrence.user.id, dayKey: occurrence.dayKey })}>
                            Entenda
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {occurrencesQuery.isLoading && <div className="p-6 text-center text-xs text-muted-foreground">Carregando ocorrências...</div>}
                {!occurrencesQuery.isLoading && (occurrencesQuery.data ?? []).length === 0 && (
                  <div className="p-6 text-center text-xs text-muted-foreground">
                    Nenhuma ocorrência {occurrenceFilter.status === 'OPEN' ? 'em aberto' : ''} no período. A varredura automática roda diariamente; use &quot;Varrer período&quot; para reprocessar agora.
                  </div>
                )}
                <div className="border-t p-3 text-[10px] text-muted-foreground">
                  Ocorrências são detectadas pela apuração (falta, batida ausente, atraso, intervalo, interjornada, excesso de jornada, trabalho em férias/afastamento/feriado). Justificar registra o tratamento; ajustes/abonos aprovados resolvem automaticamente.
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {/* ------------------------------ Ajustes ------------------------------ */}
        {canTeam && (
          <TabsContent value="ajustes">
            <Card className="border border-slate-100 bg-white shadow-sm dark:border-slate-800/80 dark:bg-slate-900/50">
              <div className="border-b px-4 py-2.5">
                <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-white">
                  <ListChecks className="h-4 w-4 text-sky-500" />Ajustes aguardando aprovação
                </h3>
              </div>
              <CardContent className="space-y-3 p-4">
                {(pendingQuery.data ?? []).length === 0 && (
                  <div className="rounded-md border border-dashed p-6 text-center text-xs text-muted-foreground">Nenhum ajuste pendente. 🎉</div>
                )}
                {(pendingQuery.data ?? []).map((request) => (
                  <div key={request.id} className="rounded-md border p-3 text-xs">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <span className="font-semibold text-slate-800 dark:text-slate-200">{request.user?.name ?? 'Colaborador'}</span>
                        <span className="ml-2 tabular-nums text-muted-foreground">{formatDayKey(request.dayKey)}</span>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" className="h-7 bg-status-green text-[11px] text-white hover:bg-status-green/90" disabled={decideAdjustment.isPending} onClick={() => decideAdjustment.mutate({ id: request.id, action: 'approve' })}>
                          <CheckCircle2 className="mr-1 h-3.5 w-3.5" />Aprovar
                        </Button>
                        <Button size="sm" variant="outline" className="h-7 text-[11px]" disabled={decideAdjustment.isPending} onClick={() => setReasonDialog({
                          title: 'Rejeitar ajuste de ponto',
                          label: 'Justificativa da rejeição',
                          confirmLabel: 'Rejeitar',
                          destructive: true,
                          onConfirm: (note) => decideAdjustment.mutate({ id: request.id, action: 'reject', note }),
                        })}>
                          <X className="mr-1 h-3.5 w-3.5" />Rejeitar
                        </Button>
                      </div>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {request.type === 'ABONO_DIA' ? (
                        <Badge variant="outline" className="border-teal-400/50 text-[10px] text-teal-600">
                          Abono do dia{request.category ? ` · ${ADJUSTMENT_CATEGORY_LABEL[request.category] ?? request.category}` : ''}
                        </Badge>
                      ) : (
                        (request.proposedTimes ?? []).map((time, index) => (
                          <Badge key={`${request.id}-${index}`} variant="outline" className={cn('text-[10px] tabular-nums', index % 2 === 0 ? 'border-status-green/40 text-status-green' : 'border-status-red/40 text-status-red')}>
                            {index % 2 === 0 ? '→' : '←'} {time}
                          </Badge>
                        ))
                      )}
                    </div>
                    <div className="mt-2 text-muted-foreground">Motivo: {request.reason}</div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {/* ------------------------------ Escalas ------------------------------ */}
        {canManage && (
          <TabsContent value="escalas">
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
              <Card className="border border-slate-100 bg-white shadow-sm dark:border-slate-800/80 dark:bg-slate-900/50">
                <div className="flex items-center justify-between border-b px-4 py-2.5">
                  <h3 className="text-sm font-semibold text-slate-800 dark:text-white">Escalas de trabalho</h3>
                  <Button size="sm" className="h-8 bg-sky-500 text-xs font-semibold text-white hover:bg-sky-600" onClick={() => setTemplateDialog(true)}>
                    <Plus className="mr-1.5 h-3.5 w-3.5" />Nova escala
                  </Button>
                </div>
                <CardContent className="space-y-2 p-4">
                  {(templatesQuery.data ?? []).length === 0 && (
                    <div className="rounded-md border border-dashed p-6 text-center text-xs text-muted-foreground">
                      Nenhuma escala cadastrada. Crie a primeira para habilitar o cálculo do espelho.
                    </div>
                  )}
                  {(templatesQuery.data ?? []).map((template) => (
                    <div key={template.id} className={cn('rounded-md border p-3 text-xs', !template.active && 'opacity-60')}>
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="font-semibold text-slate-800 dark:text-slate-200">{template.name}</span>
                            <Badge variant="outline" className="h-4 px-1.5 text-[9px]">
                              {template.kind === 'CYCLE' ? `Ciclo · ${template.cycleRules?.length ?? 0} dias` : 'Semanal'}
                            </Badge>
                            {!template.active && <Badge variant="outline" className="h-4 px-1.5 text-[9px]">Inativa</Badge>}
                          </div>
                          <div className="mt-0.5 text-[10px] text-muted-foreground">
                            Tolerância {template.toleranceMinutes} min · {template.activeAssignments} colaborador(es)
                            {template.worksHolidays ? ' · trabalha em feriados' : ''}
                          </div>
                        </div>
                        <Button variant="ghost" size="sm" className="h-7 shrink-0 text-[10px]" disabled={patchTemplate.isPending} onClick={() => patchTemplate.mutate({ id: template.id, json: { active: !template.active } })}>
                          {template.active ? 'Desativar' : 'Ativar'}
                        </Button>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-1">
                        {template.kind === 'CYCLE'
                          ? (template.cycleRules ?? []).map((rule, index) => (
                              <span key={index} className={cn('rounded border px-1.5 py-0.5 text-[9px] tabular-nums', rule ? 'text-slate-700 dark:text-slate-300' : 'text-muted-foreground opacity-60')}>
                                D{index + 1} {rule ? `${rule.start}–${rule.end}` : 'folga'}
                              </span>
                            ))
                          : WEEKDAYS.map(({ key }) => {
                              const rule = template.weeklyRules?.[key];
                              return (
                                <span key={key} className={cn('rounded border px-1.5 py-0.5 text-[9px] tabular-nums', rule ? 'text-slate-700 dark:text-slate-300' : 'text-muted-foreground opacity-60')}>
                                  {WEEKDAY_SHORT[key]} {rule ? `${rule.start}–${rule.end}` : 'folga'}
                                </span>
                              );
                            })}
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card className="border border-slate-100 bg-white shadow-sm dark:border-slate-800/80 dark:bg-slate-900/50">
                <div className="border-b px-4 py-2.5">
                  <h3 className="text-sm font-semibold text-slate-800 dark:text-white">Atribuir escala aos colaboradores</h3>
                </div>
                <CardContent className="space-y-3 p-4 text-xs">
                  <div>
                    <Label>Escala</Label>
                    <NativeSelect value={assignForm.templateId} onChange={(e) => setAssignForm((f) => ({ ...f, templateId: e.target.value, cycleAnchorDay: '' }))}>
                      <option value="">Selecione a escala</option>
                      {(templatesQuery.data ?? []).filter((t) => t.active).map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </NativeSelect>
                  </div>
                  {selectedTemplate?.kind === 'CYCLE' && (
                    <div className="rounded-md border border-sky-200 bg-sky-50/50 p-3 dark:border-sky-900/70 dark:bg-sky-950/20">
                      <Label>Data âncora do ciclo</Label>
                      <Input
                        type="date"
                        className="mt-1 h-8 w-44 bg-background text-xs"
                        value={assignForm.cycleAnchorDay}
                        onChange={(e) => setAssignForm((f) => ({ ...f, cycleAnchorDay: e.target.value }))}
                      />
                      <p className="mt-1.5 text-[10px] leading-relaxed text-muted-foreground">
                        Informe a data correspondente ao dia 1 do ciclo para este grupo. Todos os colaboradores selecionados iniciarão na mesma posição.
                      </p>
                    </div>
                  )}
                  <div>
                    <Label>Colaboradores ({assignForm.userIds.length} selecionado(s))</Label>
                    <div className="mt-1 max-h-64 space-y-0.5 overflow-y-auto rounded-md border p-2">
                      {(optionsQuery.data?.users ?? []).map((person) => {
                        const checked = assignForm.userIds.includes(person.id);
                        return (
                          <label key={person.id} className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 hover:bg-muted/60">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() =>
                                setAssignForm((f) => ({
                                  ...f,
                                  userIds: checked ? f.userIds.filter((id) => id !== person.id) : [...f.userIds, person.id],
                                }))
                              }
                            />
                            <span className="min-w-0 truncate">{person.name}</span>
                            <span className="ml-auto truncate text-[10px] text-muted-foreground">{person.jobTitle ?? ''}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    className="bg-sky-500 font-semibold text-white hover:bg-sky-600"
                    disabled={!assignForm.templateId || assignForm.userIds.length === 0 || (selectedTemplate?.kind === 'CYCLE' && !assignForm.cycleAnchorDay) || assign.isPending}
                    onClick={() => assign.mutate()}
                  >
                    {assign.isPending ? 'Atribuindo...' : 'Atribuir escala'}
                  </Button>

                  <div className="border-t pt-3">
                    <div className="mb-2 font-semibold text-slate-800 dark:text-slate-200">Vigências ativas</div>
                    {(assignmentsQuery.data ?? []).length === 0 && <div className="text-muted-foreground">Nenhum colaborador com escala atribuída.</div>}
                    <div className="max-h-56 space-y-1 overflow-y-auto">
                      {(assignmentsQuery.data ?? []).map((assignment) => (
                        <div key={assignment.id} className="flex items-center justify-between gap-2 rounded border px-2 py-1.5">
                          <span className="min-w-0 truncate">{assignment.user?.name ?? '—'}</span>
                          <span className="shrink-0 text-right text-[10px] text-muted-foreground">
                            {assignment.template?.name}
                            {(assignment.template?.kind === 'CYCLE' || assignment.cycleAnchorDay) ? ' · ciclo' : ' · semanal'}
                            {assignment.cycleAnchorDay ? ` · âncora ${formatDayKey(assignment.cycleAnchorDay)}` : ''}
                            {' · '}desde {formatDate(assignment.startsAt)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border border-slate-100 bg-white shadow-sm dark:border-slate-800/80 dark:bg-slate-900/50 xl:col-span-2">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
                  <div>
                    <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-white">
                      <MonitorSmartphone className="h-4 w-4 text-sky-500" />Totens autorizados
                    </h3>
                    <p className="mt-0.5 text-[10px] text-muted-foreground">Cadastre os celulares e tablets que poderão operar como terminais compartilhados.</p>
                  </div>
                  <div className="flex w-full items-end gap-2 sm:w-auto">
                    <div className="min-w-0 flex-1 sm:w-64">
                      <Label>Nome do dispositivo</Label>
                      <Input className="h-8 text-xs" value={kioskName} onChange={(e) => setKioskName(e.target.value)} placeholder="Ex.: Totem Portaria Principal" />
                    </div>
                    <Button
                      size="sm"
                      className="h-8 shrink-0 bg-sky-500 text-xs font-semibold text-white hover:bg-sky-600"
                      disabled={!kioskName.trim() || createKiosk.isPending}
                      onClick={() => createKiosk.mutate()}
                    >
                      <Plus className="mr-1 h-3.5 w-3.5" />Cadastrar
                    </Button>
                  </div>
                </div>
                <CardContent className="p-0">
                  {kioskDevicesQuery.isLoading ? (
                    <div className="p-5 text-center text-xs text-muted-foreground">Carregando totens...</div>
                  ) : kioskDevicesQuery.isError ? (
                    <div className="p-5 text-center text-xs text-status-red">Não foi possível carregar os totens cadastrados.</div>
                  ) : (kioskDevicesQuery.data ?? []).length === 0 ? (
                    <div className="p-5 text-center text-xs text-muted-foreground">Nenhum totem cadastrado.</div>
                  ) : (
                    <div className="divide-y divide-slate-100 dark:divide-slate-800/60">
                      {(kioskDevicesQuery.data ?? []).map((device) => (
                        <div key={device.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-xs">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="truncate font-semibold text-slate-800 dark:text-slate-200">{device.name}</span>
                              <Badge variant="outline" className={cn('text-[9px]', device.active ? 'border-status-green/40 text-status-green' : 'text-muted-foreground')}>
                                {device.active ? 'Ativo' : 'Inativo'}
                              </Badge>
                            </div>
                            <div className="mt-0.5 text-[10px] text-muted-foreground">
                              Cadastrado em {formatDate(device.createdAt)} · último contato {device.lastSeenAt ? formatDateTime(device.lastSeenAt) : 'ainda não realizado'}
                            </div>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 text-[10px]"
                            disabled={toggleKiosk.isPending}
                            onClick={() => toggleKiosk.mutate({ id: device.id, active: !device.active })}
                          >
                            {device.active ? 'Desativar' : 'Ativar'}
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Feriados: em feriado a jornada prevista é zero (ausência não é falta). */}
              <Card className="border border-slate-100 bg-white shadow-sm dark:border-slate-800/80 dark:bg-slate-900/50 xl:col-span-2">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
                  <h3 className="text-sm font-semibold text-slate-800 dark:text-white">Feriados</h3>
                  <div className="flex items-center gap-2">
                    <NativeSelect className="h-8 w-24 text-xs" value={holidayYear} onChange={(e) => setHolidayYear(e.target.value)}>
                      {[-1, 0, 1].map((offset) => {
                        const y = String(new Date().getFullYear() + offset);
                        return <option key={y} value={y}>{y}</option>;
                      })}
                    </NativeSelect>
                    <Button size="sm" variant="outline" className="h-8 text-xs" disabled={generateHolidays.isPending} onClick={() => generateHolidays.mutate()}>
                      {generateHolidays.isPending ? 'Gerando...' : `Carregar nacionais de ${holidayYear}`}
                    </Button>
                  </div>
                </div>
                <CardContent className="space-y-3 p-4 text-xs">
                  <div className="flex flex-wrap items-end gap-2">
                    <div>
                      <Label>Data</Label>
                      <Input type="date" className="h-8 w-40 text-xs" value={holidayForm.dayKey} onChange={(e) => setHolidayForm((f) => ({ ...f, dayKey: e.target.value }))} />
                    </div>
                    <div className="min-w-[220px] flex-1">
                      <Label>Nome</Label>
                      <Input className="h-8 text-xs" placeholder="Ex.: Aniversário da cidade" value={holidayForm.name} onChange={(e) => setHolidayForm((f) => ({ ...f, name: e.target.value }))} />
                    </div>
                    <div>
                      <Label>Âmbito</Label>
                      <NativeSelect className="h-8 w-36 text-xs" value={holidayForm.kind} onChange={(e) => setHolidayForm((f) => ({ ...f, kind: e.target.value as HolidayRow['kind'] }))}>
                        {Object.entries(HOLIDAY_KIND_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                      </NativeSelect>
                    </div>
                    <Button size="sm" className="h-8 bg-sky-500 text-xs font-semibold text-white hover:bg-sky-600" disabled={!holidayForm.dayKey || !holidayForm.name.trim() || createHoliday.isPending} onClick={() => createHoliday.mutate()}>
                      <Plus className="mr-1 h-3.5 w-3.5" />Adicionar
                    </Button>
                  </div>
                  {(holidaysQuery.data ?? []).length === 0 ? (
                    <div className="rounded-md border border-dashed p-4 text-center text-muted-foreground">
                      Nenhum feriado cadastrado em {holidayYear}. Sem cadastro, um feriado com escala conta como falta no espelho.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2 xl:grid-cols-3">
                      {(holidaysQuery.data ?? []).map((holiday) => (
                        <div key={holiday.id} className="flex items-center justify-between gap-2 rounded border px-2.5 py-1.5">
                          <div className="min-w-0">
                            <span className="font-semibold tabular-nums">{formatDayKey(holiday.dayKey)}</span>
                            <span className="ml-2 truncate">{holiday.name}</span>
                          </div>
                          <div className="flex shrink-0 items-center gap-1.5">
                            <Badge variant="outline" className="h-4 px-1.5 text-[9px]">{HOLIDAY_KIND_LABEL[holiday.kind]}</Badge>
                            <button
                              type="button"
                              title="Remover feriado"
                              className="text-muted-foreground hover:text-status-red"
                              onClick={() => deleteHoliday.mutate(holiday.id)}
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        )}

        {/* ------------------------------ Fechamento ------------------------------ */}
        {canManage && (
          <TabsContent value="fechamento">
            <Card className="border border-slate-100 bg-white shadow-sm dark:border-slate-800/80 dark:bg-slate-900/50">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
                <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-white">
                  <Lock className="h-4 w-4 text-sky-500" />Fechamento de competência
                </h3>
                <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => { setImportResult(null); setImportDialog(true); }}>
                  <Upload className="mr-1.5 h-3.5 w-3.5" />Importar batidas (CSV)
                </Button>
              </div>
              <CardContent className="p-0">
                <table className="w-full text-xs">
                  <thead className="border-b bg-slate-50/60 text-[10px] uppercase tracking-wider text-muted-foreground dark:bg-slate-900/40">
                    <tr>
                      <th className="px-4 py-2.5 text-left">Competência</th>
                      <th className="px-2 py-2.5 text-left">Situação</th>
                      <th className="px-2 py-2.5 text-left">Fechada por</th>
                      <th className="px-2 py-2.5 text-right">Batidas</th>
                      <th className="px-4 py-2.5 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                    {(periodsQuery.data ?? []).map((period) => (
                      <tr key={period.periodRef}>
                        <td className="px-4 py-2.5 font-semibold tabular-nums">{period.periodRef}</td>
                        <td className="px-2 py-2.5">
                          <Badge variant="outline" className={period.status === 'CLOSED' ? 'border-status-red/40 text-status-red' : 'border-status-green/40 text-status-green'}>
                            {period.status === 'CLOSED' ? 'Fechada' : 'Aberta'}
                          </Badge>
                        </td>
                        <td className="px-2 py-2.5 text-muted-foreground">
                          {period.status === 'CLOSED' ? `${period.closedByUser?.name ?? '—'} em ${formatDate(period.closedAt)}` : '—'}
                        </td>
                        <td className="px-2 py-2.5 text-right tabular-nums">{period.totals?.entries ?? '—'}</td>
                        <td className="px-4 py-2.5 text-right">
                          <Button variant="ghost" size="sm" className="h-7 text-[10px]" title="Baixar relatório da competência (CSV)" onClick={() => downloadPeriodReport(period.periodRef)}>
                            <Download className="mr-1 h-3 w-3" />Relatório
                          </Button>
                          {period.status === 'OPEN' ? (
                            <Button variant="outline" size="sm" className="h-7 text-[10px]" onClick={() => setPreviewRef(period.periodRef)}>
                              <Lock className="mr-1 h-3 w-3" />Revisar e fechar
                            </Button>
                          ) : (
                            <Button variant="ghost" size="sm" className="h-7 text-[10px]" disabled={reopenPeriod.isPending} onClick={() => setReasonDialog({
                              title: `Reabrir competência ${period.periodRef}`,
                              label: 'Justificativa da reabertura',
                              required: true,
                              confirmLabel: 'Reabrir competência',
                              destructive: true,
                              onConfirm: (reason) => reopenPeriod.mutate({ ref: period.periodRef, note: reason }),
                            })}>
                              <LockOpen className="mr-1 h-3 w-3" />Reabrir
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="border-t p-3 text-[10px] text-muted-foreground">
                  Fechar uma competência bloqueia novas batidas e ajustes nos dias do mês. O histórico permanece auditável.
                </div>
              </CardContent>
            </Card>

            {/* Eventos para folha */}
            <Card className="mt-4 border border-slate-100 bg-white shadow-sm dark:border-slate-800/80 dark:bg-slate-900/50">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
                <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-white">
                  <FileDown className="h-4 w-4 text-sky-500" />Eventos para a folha
                </h3>
                <div className="flex flex-wrap items-center gap-2">
                  <Input type="month" className="h-8 w-36 text-xs" value={payrollRef} max={currentMonth} onChange={(e) => setPayrollRef(e.target.value)} />
                  <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => setRubricsOpen(true)}>Rubricas</Button>
                  <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => downloadPayroll(payrollRef, 'CSV')}><Download className="mr-1 h-3 w-3" />CSV</Button>
                  <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => downloadPayroll(payrollRef, 'JSON')}><Download className="mr-1 h-3 w-3" />JSON</Button>
                  <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => downloadPayroll(payrollRef, 'TXT')}><Download className="mr-1 h-3 w-3" />TXT</Button>
                </div>
              </div>
              <CardContent className="overflow-x-auto p-0">
                <table className="w-full min-w-[820px] text-xs">
                  <thead className="border-b bg-slate-50/60 text-[10px] uppercase tracking-wider text-muted-foreground dark:bg-slate-900/40">
                    <tr>
                      <th className="px-4 py-2.5 text-left">Colaborador</th>
                      <th className="px-2 py-2.5 text-right">Normais (h)</th>
                      <th className="px-2 py-2.5 text-right">HE 50% (h)</th>
                      <th className="px-2 py-2.5 text-right">HE 100% (h)</th>
                      <th className="px-2 py-2.5 text-right">Not. (h)</th>
                      <th className="px-2 py-2.5 text-right">Faltas (d)</th>
                      <th className="px-4 py-2.5 text-right">Banco (h)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                    {(payrollEventsQuery.data?.rows ?? []).map((row) => {
                      const q = row.quantities;
                      const bank = (q.BANCO_CREDITO ?? 0) - (q.BANCO_DEBITO ?? 0);
                      return (
                        <tr key={row.user.id}>
                          <td className="px-4 py-2 max-w-[240px] truncate">{row.user.name}</td>
                          <td className="px-2 py-2 text-right tabular-nums">{(q.HORAS_NORMAIS ?? 0).toLocaleString('pt-BR')}</td>
                          <td className="px-2 py-2 text-right tabular-nums">{(q.HE_50 ?? 0).toLocaleString('pt-BR')}</td>
                          <td className="px-2 py-2 text-right tabular-nums">{(q.HE_100 ?? 0).toLocaleString('pt-BR')}</td>
                          <td className="px-2 py-2 text-right tabular-nums">{(q.ADICIONAL_NOTURNO ?? 0).toLocaleString('pt-BR')}</td>
                          <td className="px-2 py-2 text-right tabular-nums">{q.FALTAS ?? 0}</td>
                          <td className={cn('px-4 py-2 text-right font-semibold tabular-nums', bank > 0 ? 'text-status-green' : bank < 0 ? 'text-status-red' : 'text-muted-foreground')}>
                            {bank > 0 ? '+' : ''}{bank.toLocaleString('pt-BR')}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {payrollEventsQuery.isLoading && <div className="p-6 text-center text-xs text-muted-foreground">Calculando eventos...</div>}
                {!payrollEventsQuery.isLoading && (payrollEventsQuery.data?.rows ?? []).length === 0 && (
                  <div className="p-6 text-center text-xs text-muted-foreground">Sem eventos para {payrollRef}.</div>
                )}
                <div className="border-t p-3 text-[10px] text-muted-foreground">
                  As rubricas são derivadas da apuração (fonte única). Faixas de HE, adicional noturno e DSR dependem da convenção coletiva — <b>revise com o jurídico/DP</b> antes de importar na folha. Cada exportação fica registrada para conciliação.
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>

      {/* Dialog: extrato do banco de horas */}
      <Dialog open={bankOpen} onOpenChange={setBankOpen}>
        <DialogContent className="max-w-2xl overflow-y-auto max-h-[88vh]">
          <DialogHeader>
            <DialogTitle>Banco de horas — extrato</DialogTitle>
          </DialogHeader>
          {bankQuery.data && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="rounded-md border p-3">
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Saldo atual</div>
                  <div className={cn('text-lg font-bold tabular-nums', bankQuery.data.balanceMinutes >= 0 ? 'text-status-green' : 'text-status-red')}>
                    {bankQuery.data.balanceMinutes > 0 ? '+' : ''}{minutesLabel(bankQuery.data.balanceMinutes)}
                  </div>
                </div>
                <div className="rounded-md border p-3">
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Vencem em 30 dias</div>
                  <div className="text-lg font-bold tabular-nums text-amber-600">{minutesLabel(bankQuery.data.expiringSoonMinutes)}</div>
                </div>
                <div className="col-span-2 rounded-md border p-3 text-xs text-muted-foreground">
                  Política: validade de <b>{bankQuery.data.policy.validityMonths} meses</b> · crédito vencido{' '}
                  {bankQuery.data.policy.expirationAction === 'PAYOUT' ? 'marcado para pagamento' : 'expira'}.
                  {!bankQuery.data.policy.enabled && ' (Banco de horas desativado nesta empresa.)'}
                </div>
              </div>
              {bankQuery.data.alerts.map((alert) => (
                <div key={alert.type} className="rounded-md border border-status-yellow/40 bg-status-yellow/5 p-2 text-[11px] text-status-yellow">
                  {alert.type === 'MAX_POSITIVE'
                    ? `Saldo positivo ${minutesLabel(alert.overBy)} acima do teto da empresa.`
                    : `Saldo negativo ${minutesLabel(alert.overBy)} abaixo do limite da empresa.`}
                </div>
              ))}
              <div className="rounded-md border">
                <div className="border-b bg-muted/30 px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Lançamentos</div>
                <div className="max-h-72 overflow-y-auto divide-y">
                  {bankQuery.data.entries.length === 0 && <div className="p-4 text-center text-xs text-muted-foreground">Nenhum lançamento no banco de horas ainda. O saldo em aberto vira lançamento ao fechar a competência.</div>}
                  {bankQuery.data.entries.map((entry) => (
                    <div key={entry.id} className="flex items-center justify-between gap-2 px-3 py-2 text-xs">
                      <div className="min-w-0">
                        <div className="font-semibold">{BANK_SOURCE_LABEL[entry.source] ?? entry.source}{entry.periodRef && !entry.periodRef.startsWith('exp:') ? ` · ${entry.periodRef}` : ''}</div>
                        <div className="truncate text-[10px] text-muted-foreground">
                          {formatDate(entry.createdAt)}
                          {entry.expiresAt ? ` · vence ${formatDate(entry.expiresAt)}` : ''}
                          {entry.note ? ` · ${entry.note}` : ''}
                        </div>
                      </div>
                      <div className={cn('shrink-0 font-bold tabular-nums', entry.minutes >= 0 ? 'text-status-green' : 'text-status-red')}>
                        {entry.minutes > 0 ? '+' : ''}{minutesLabel(entry.minutes)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog: mapeamento de rubricas da folha */}
      <Dialog open={rubricsOpen} onOpenChange={setRubricsOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Rubricas da folha</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <div className="rounded-md border bg-muted/30 p-3 text-[11px] text-muted-foreground">
              Vincule cada evento interno ao código correspondente na sua folha de pagamento. O código é usado nas exportações.
            </div>
            {(payrollRubricsQuery.data ?? []).map((rubric) => (
              <div key={rubric.id} className="flex items-center justify-between gap-3 rounded-md border p-2.5 text-xs">
                <div className="min-w-0">
                  <div className="font-semibold">{rubric.description}</div>
                  <div className="text-[10px] text-muted-foreground">{rubric.eventKey} · {rubric.unit === 'DIAS' ? 'dias' : 'horas'}</div>
                </div>
                <Input
                  className="h-8 w-28 text-xs"
                  defaultValue={rubric.payrollCode}
                  onBlur={(e) => {
                    const value = e.target.value.trim();
                    if (value && value !== rubric.payrollCode) setRubric.mutate({ eventKey: rubric.eventKey, payrollCode: value });
                  }}
                />
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRubricsOpen(false)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: assistente de fechamento (checklist) */}
      <Dialog open={Boolean(previewRef)} onOpenChange={(v) => !v && setPreviewRef(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Fechar competência {previewRef}</DialogTitle>
          </DialogHeader>
          {closingPreviewQuery.isLoading && <div className="p-4 text-center text-xs text-muted-foreground">Verificando pendências...</div>}
          {closingPreviewQuery.data && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                {closingPreviewQuery.data.checklist.map((item) => (
                  <div key={item.key} className="flex items-center justify-between gap-2 rounded-md border p-2.5 text-xs">
                    <div className="flex items-center gap-2">
                      {item.ok ? (
                        <CheckCircle2 className="h-4 w-4 shrink-0 text-status-green" />
                      ) : (
                        <AlertTriangle className={cn('h-4 w-4 shrink-0', item.blocking ? 'text-status-red' : 'text-status-yellow')} />
                      )}
                      <span>{item.label}</span>
                      {item.blocking && !item.ok && <Badge variant="outline" className="h-4 border-status-red/40 px-1.5 text-[8px] text-status-red">bloqueia</Badge>}
                    </div>
                    <span className={cn('font-bold tabular-nums', item.ok ? 'text-muted-foreground' : item.blocking ? 'text-status-red' : 'text-status-yellow')}>{item.count}</span>
                  </div>
                ))}
              </div>
              {closingPreviewQuery.data.withoutSchedule.length > 0 && (
                <div className="rounded-md border border-status-yellow/40 bg-status-yellow/5 p-2 text-[11px] text-muted-foreground">
                  Sem escala: {closingPreviewQuery.data.withoutSchedule.map((u) => u.name).join(', ')}.
                </div>
              )}
              {!closingPreviewQuery.data.readyToClose && (
                <div className="rounded-md border border-status-red/40 bg-status-red/5 p-2 text-[11px] text-status-red">
                  Existem solicitações de ajuste em aberto. Trate-as na aba Ajustes antes de fechar (recomendado); o fechamento consolida os saldos atuais.
                </div>
              )}
              <div className="text-[10px] text-muted-foreground">
                Fechar bloqueia batidas e ajustes do mês, gera a versão do consolidado e lança o saldo de cada colaborador no banco de horas (com vencimento pela política).
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setPreviewRef(null)}>Cancelar</Button>
            <Button
              className="bg-sky-600 font-semibold text-white hover:bg-sky-700"
              disabled={closePeriod.isPending || !closingPreviewQuery.data}
              onClick={() => {
                if (previewRef) closePeriod.mutate(previewRef);
              }}
            >
              <Lock className="mr-1.5 h-3.5 w-3.5" />{closePeriod.isPending ? 'Fechando...' : 'Fechar competência'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: solicitar ajuste */}
      <Dialog open={Boolean(adjustDialog)} onOpenChange={(v) => !v && setAdjustDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Solicitar ajuste — {adjustDialog ? formatDayKey(adjustDialog.dayKey) : ''}</DialogTitle>
          </DialogHeader>
          {adjustDialog && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <Label>Tipo de solicitação</Label>
                  <NativeSelect value={adjustDialog.type} onChange={(e) => setAdjustDialog((d) => d && { ...d, type: e.target.value as 'HORARIOS' | 'ABONO_DIA' })}>
                    <option value="HORARIOS">Corrigir horários do dia</option>
                    <option value="ABONO_DIA">Abonar o dia (falta justificada)</option>
                  </NativeSelect>
                </div>
                <div>
                  <Label>Categoria do motivo</Label>
                  <NativeSelect value={adjustDialog.category} onChange={(e) => setAdjustDialog((d) => d && { ...d, category: e.target.value })}>
                    {Object.entries(ADJUSTMENT_CATEGORY_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                  </NativeSelect>
                </div>
              </div>
              {adjustDialog.type === 'HORARIOS' ? (
                <>
                  <div className="rounded-md border bg-muted/30 p-3 text-xs text-muted-foreground">
                    Informe a lista completa de horários do dia (entrada, saída, entrada, saída...). Ao aprovar, os horários corrigidos são lançados separadamente; as marcações originais permanecem preservadas na auditoria.
                  </div>
                  <div className="space-y-2">
                    {adjustDialog.times.map((time, index) => (
                      <div key={index} className="flex items-center gap-2">
                        <Badge variant="outline" className={cn('w-16 justify-center text-[10px]', index % 2 === 0 ? 'border-status-green/40 text-status-green' : 'border-status-red/40 text-status-red')}>
                          {index % 2 === 0 ? 'Entrada' : 'Saída'}
                        </Badge>
                        <Input
                          type="time"
                          className="h-8 w-32 text-xs"
                          value={time}
                          onChange={(e) => setAdjustDialog((d) => d && { ...d, times: d.times.map((t, i) => (i === index ? e.target.value : t)) })}
                        />
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-status-red" onClick={() => setAdjustDialog((d) => d && { ...d, times: d.times.filter((_, i) => i !== index) })}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ))}
                    <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setAdjustDialog((d) => d && { ...d, times: [...d.times, ''] })}>
                      <Plus className="mr-1 h-3 w-3" />Adicionar horário
                    </Button>
                  </div>
                </>
              ) : (
                <div className="rounded-md border border-teal-400/30 bg-teal-500/5 p-3 text-xs text-teal-700 dark:text-teal-300">
                  O abono justifica a falta do dia sem criar batidas: aprovado, o dia deixa de contar como falta e o saldo fica zerado. Nenhuma marcação é criada ou alterada.
                </div>
              )}
              <div>
                <Label>{adjustDialog.type === 'ABONO_DIA' ? 'Motivo do abono' : 'Motivo do ajuste'}</Label>
                <Textarea rows={3} value={adjustDialog.reason} onChange={(e) => setAdjustDialog((d) => d && { ...d, reason: e.target.value })} placeholder={adjustDialog.type === 'ABONO_DIA' ? 'Ex.: consulta médica com atestado entregue ao DP.' : 'Ex.: esqueci de registrar a saída do almoço.'} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setAdjustDialog(null)}>Cancelar</Button>
            <Button
              className="bg-sky-500 font-semibold text-white hover:bg-sky-600"
              disabled={!adjustDialog || !adjustDialog.reason.trim() || (adjustDialog.type === 'HORARIOS' && adjustDialog.times.some((t) => !t)) || requestAdjustment.isPending}
              onClick={() =>
                adjustDialog &&
                requestAdjustment.mutate({
                  dayKey: adjustDialog.dayKey,
                  proposedTimes: adjustDialog.type === 'HORARIOS' ? adjustDialog.times : [],
                  reason: adjustDialog.reason,
                  type: adjustDialog.type,
                  category: adjustDialog.category,
                })
              }
            >
              {requestAdjustment.isPending ? 'Enviando...' : 'Enviar solicitação'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: nova escala */}
      <Dialog open={templateDialog} onOpenChange={setTemplateDialog}>
        <DialogContent className="max-w-2xl overflow-y-auto max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>Nova escala de trabalho</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
              <div className="md:col-span-2">
                <Label>Nome da escala</Label>
                <Input value={templateForm.name} onChange={(e) => setTemplateForm((f) => ({ ...f, name: e.target.value }))} placeholder="Ex.: Administrativo 08h–17h" />
              </div>
              <div>
                <Label>Tipo da escala</Label>
                <NativeSelect
                  value={templateForm.kind}
                  onChange={(e) => setTemplateForm((f) => ({ ...f, kind: e.target.value as ScheduleKind }))}
                >
                  <option value="WEEKLY">Semanal</option>
                  <option value="CYCLE">Ciclo contínuo</option>
                </NativeSelect>
              </div>
              <div>
                <Label>Tolerância (min)</Label>
                <Input type="number" min={0} max={120} value={templateForm.toleranceMinutes} onChange={(e) => setTemplateForm((f) => ({ ...f, toleranceMinutes: e.target.value }))} />
              </div>
            </div>
            <div>
              <Label>Descrição</Label>
              <Input value={templateForm.description} onChange={(e) => setTemplateForm((f) => ({ ...f, description: e.target.value }))} placeholder="Quando usar esta escala" />
            </div>
            {templateForm.kind === 'WEEKLY' ? (
              <div className="space-y-1.5">
                <Label>Jornada semanal</Label>
                {WEEKDAYS.map(({ key, label }) => {
                  const day = templateForm.days[key];
                  return (
                    <ScheduleDayEditor
                      key={key}
                      label={label}
                      day={day}
                      onChange={(next) => setTemplateForm((f) => ({ ...f, days: { ...f.days, [key]: next } }))}
                    />
                  );
                })}
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <Label>Ciclo contínuo</Label>
                    <p className="mt-0.5 text-[10px] text-muted-foreground">A sequência se repete continuamente a partir da data âncora de cada atribuição.</p>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <Button type="button" variant="outline" size="sm" className="h-7 text-[10px]" onClick={() => applyCyclePreset(setTemplateForm, '12X36')}>Preset 12x36</Button>
                    <Button type="button" variant="outline" size="sm" className="h-7 text-[10px]" onClick={() => applyCyclePreset(setTemplateForm, '4X2')}>Preset 4x2</Button>
                    <Button type="button" variant="outline" size="sm" className="h-7 text-[10px]" onClick={() => applyCyclePreset(setTemplateForm, 'CUSTOM')}>Personalizado</Button>
                  </div>
                </div>
                <div className="max-h-[340px] space-y-1.5 overflow-y-auto pr-1">
                  {templateForm.cycleDays.map((day, index) => (
                    <div key={index} className="flex items-center gap-1.5">
                      <div className="min-w-0 flex-1">
                        <ScheduleDayEditor
                          label={`Dia ${index + 1}`}
                          day={day}
                          onChange={(next) => setTemplateForm((f) => ({ ...f, cycleDays: f.cycleDays.map((item, itemIndex) => itemIndex === index ? next : item) }))}
                        />
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 shrink-0 text-status-red"
                        disabled={templateForm.cycleDays.length <= 2}
                        title="Remover posição do ciclo"
                        onClick={() => setTemplateForm((f) => ({ ...f, cycleDays: f.cycleDays.filter((_, itemIndex) => itemIndex !== index) }))}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs"
                  disabled={templateForm.cycleDays.length >= 60}
                  onClick={() => setTemplateForm((f) => ({ ...f, cycleDays: [...f.cycleDays, { enabled: false, start: '08:00', end: '17:00', breakMinutes: '60' }] }))}
                >
                  <Plus className="mr-1 h-3 w-3" />Adicionar dia ao ciclo
                </Button>
                <CyclePreview days={templateForm.cycleDays} />
              </div>
            )}
            <label className="flex items-start gap-2 rounded-md border bg-muted/20 p-3 text-xs">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={templateForm.worksHolidays}
                onChange={(e) => setTemplateForm((f) => ({ ...f, worksHolidays: e.target.checked }))}
              />
              <span>
                <span className="font-semibold">Manter a jornada prevista em feriados</span>
                <span className="mt-0.5 block text-[10px] text-muted-foreground">Use quando a escala, como 12x36, trabalha normalmente em feriados. Caso contrário, o feriado zera a jornada prevista.</span>
              </span>
            </label>
            {!templateValidation.valid && templateForm.name.trim() && (
              <div className="rounded-md border border-status-red/30 bg-status-red/5 p-2 text-xs text-status-red">{templateValidation.message}</div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTemplateDialog(false)}>Cancelar</Button>
            <Button className="bg-sky-500 font-semibold text-white hover:bg-sky-600" disabled={!templateValidation.valid || createTemplate.isPending} onClick={() => createTemplate.mutate()}>
              {createTemplate.isPending ? 'Salvando...' : 'Salvar escala'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: importar batidas CSV */}
      <Dialog open={importDialog} onOpenChange={setImportDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Importar batidas (relógio/REP)</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 text-xs">
            <div className="rounded-md border bg-muted/30 p-3 text-muted-foreground">
              <div className="font-semibold text-foreground">Formato do CSV (uma batida por linha):</div>
              <pre className="mt-1 font-mono text-[10px]">email;data;hora{'\n'}ana@empresa.com;2026-07-08;08:01{'\n'}ana@empresa.com;08/07/2026;12:00</pre>
              Também aceita <span className="font-mono">email;data-hora-ISO</span> e separador vírgula. Duplicadas são ignoradas; competência fechada bloqueia a linha.
            </div>
            <Input
              type="file"
              accept=".csv,.txt,text/csv,text/plain"
              className="text-xs"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                e.target.value = '';
                if (!file) return;
                const content = await file.text();
                importPunches.mutate(content);
              }}
            />
            {importPunches.isPending && <div className="text-muted-foreground">Importando batidas...</div>}
            {importResult && (
              <div className="space-y-1 rounded-md border p-3">
                <div className="font-semibold text-status-green">{importResult.imported} batida(s) importada(s)</div>
                {importResult.duplicates > 0 && <div className="text-muted-foreground">{importResult.duplicates} duplicada(s) ignorada(s)</div>}
                {importResult.errors.length > 0 && (
                  <div className="max-h-32 space-y-0.5 overflow-y-auto text-status-red">
                    {importResult.errors.slice(0, 20).map((error, index) => <div key={index}>{error}</div>)}
                    {importResult.errors.length > 20 && <div>... e mais {importResult.errors.length - 20} erro(s)</div>}
                  </div>
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setImportDialog(false)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(createdKiosk)} onOpenChange={(open) => !open && setCreatedKiosk(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Token do totem — exibição única</DialogTitle>
          </DialogHeader>
          {createdKiosk && (
            <div className="space-y-4 text-xs">
              <div className="rounded-md border border-status-yellow/40 bg-status-yellow/5 p-3 leading-relaxed text-status-yellow">
                Copie este token agora. Por segurança, somente o hash é guardado no servidor e o valor não poderá ser consultado novamente depois que esta janela for fechada.
              </div>
              <div>
                <Label>Dispositivo</Label>
                <div className="mt-1 font-semibold">{createdKiosk.device.name}</div>
              </div>
              <div>
                <Label>Token de ativação</Label>
                <div className="mt-1 flex items-center gap-2">
                  <Input readOnly value={createdKiosk.token} className="font-mono text-xs" onFocus={(event) => event.currentTarget.select()} />
                  <Button
                    variant="outline"
                    size="icon"
                    className="shrink-0"
                    title="Copiar token"
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(createdKiosk.token);
                        toast.success('Token copiado');
                      } catch {
                        toast.error('Não foi possível copiar automaticamente. Selecione o token manualmente.');
                      }
                    }}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <p className="text-muted-foreground">Guarde o token em local seguro para ativar o dispositivo quando a tela pública do totem for disponibilizada.</p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreatedKiosk(null)}>Já guardei o token</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Sheet open={Boolean(explainTarget)} onOpenChange={(open) => !open && setExplainTarget(null)}>
        <SheetContent side="right" size="lg">
          <SheetHeader>
            <SheetTitle>Entenda este cálculo</SheetTitle>
            <SheetDescription>
              Memória explicativa de {explainTarget ? formatDayKey(explainTarget.dayKey) : ''}. Marcações originais e regras aplicadas permanecem auditáveis.
            </SheetDescription>
          </SheetHeader>
          <SheetBody>
            {explainQuery.isLoading && <div className="py-10 text-center text-sm text-muted-foreground">Carregando memória de cálculo...</div>}
            {explainQuery.isError && (
              <div className="rounded-md border border-status-red/40 bg-status-red/5 p-4 text-sm text-status-red">
                {(explainQuery.error as Error)?.message ?? 'Não foi possível carregar a memória de cálculo.'}
              </div>
            )}
            {explainQuery.data && <CalculationExplanationView data={explainQuery.data} />}
          </SheetBody>
        </SheetContent>
      </Sheet>

      <ReasonDialog state={reasonDialog} onClose={() => setReasonDialog(null)} />
    </div>
  );
}

/** Baixa o relatório CSV da competência com o token de acesso (download controlado). */
async function downloadPayroll(ref: string, format: 'CSV' | 'JSON' | 'TXT') {
  try {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3333/api';
    const token = getAccessToken();
    const res = await fetch(`${apiUrl}/personnel/payroll/export/${ref}?format=${format}`, {
      headers: token ? { authorization: `Bearer ${token}` } : undefined,
    });
    if (!res.ok) throw new Error('Falha ao gerar a exportação');
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `folha-${ref}.${format.toLowerCase()}`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success(`Exportação ${format} gerada e registrada`);
  } catch {
    toast.error('Não foi possível exportar os eventos para a folha');
  }
}

async function downloadPeriodReport(ref: string) {
  try {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3333/api';
    const token = getAccessToken();
    const res = await fetch(`${apiUrl}/personnel/time-clock/periods/${ref}/report.csv`, {
      headers: token ? { authorization: `Bearer ${token}` } : undefined,
    });
    if (!res.ok) throw new Error('Falha ao gerar o relatório');
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `ponto-${ref}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  } catch {
    toast.error('Não foi possível baixar o relatório');
  }
}

function ScheduleDayEditor({ label, day, onChange }: { label: string; day: TemplateDayForm; onChange: (day: TemplateDayForm) => void }) {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-md border px-2 py-1.5 text-xs">
      <label className="flex w-28 items-center gap-2">
        <input type="checkbox" checked={day.enabled} onChange={(event) => onChange({ ...day, enabled: event.target.checked })} />
        <span className={cn(!day.enabled && 'text-muted-foreground')}>{label}</span>
      </label>
      {day.enabled ? (
        <>
          <Input type="time" className="h-7 w-28 text-xs" value={day.start} onChange={(event) => onChange({ ...day, start: event.target.value })} />
          <span className="text-muted-foreground">às</span>
          <Input type="time" className="h-7 w-28 text-xs" value={day.end} onChange={(event) => onChange({ ...day, end: event.target.value })} />
          <span className="text-muted-foreground">intervalo</span>
          <Input type="number" min={0} max={1440} className="h-7 w-20 text-xs" value={day.breakMinutes} onChange={(event) => onChange({ ...day, breakMinutes: event.target.value })} />
          <span className="text-muted-foreground">min</span>
        </>
      ) : (
        <span className="text-muted-foreground">Folga</span>
      )}
    </div>
  );
}

function CyclePreview({ days }: { days: TemplateDayForm[] }) {
  const workDays = days.filter((day) => day.enabled).length;
  const plannedMinutes = days.reduce((total, day) => total + plannedMinutesForFormDay(day), 0);
  return (
    <div className="rounded-md border bg-muted/20 p-3 text-xs">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-semibold">Prévia do ciclo</span>
        <span className="text-[10px] text-muted-foreground">{days.length} dias · {workDays} trabalhado(s) · {days.length - workDays} folga(s) · {minutesLabel(plannedMinutes)} previstos</span>
      </div>
      <div className="mt-2 flex flex-wrap gap-1">
        {days.map((day, index) => (
          <span key={index} className={cn('rounded border px-1.5 py-0.5 text-[9px] tabular-nums', day.enabled ? 'border-sky-300 text-sky-700 dark:border-sky-800 dark:text-sky-300' : 'text-muted-foreground')}>
            D{index + 1} {day.enabled ? `${day.start}–${day.end}` : 'folga'}
          </span>
        ))}
      </div>
    </div>
  );
}

function applyCyclePreset(setForm: Dispatch<SetStateAction<TemplateFormState>>, preset: '12X36' | '4X2' | 'CUSTOM') {
  const work12h: TemplateDayForm = { enabled: true, start: '07:00', end: '19:00', breakMinutes: '60' };
  const work4x2: TemplateDayForm = { enabled: true, start: '08:00', end: '18:00', breakMinutes: '60' };
  const off = (base: TemplateDayForm): TemplateDayForm => ({ ...base, enabled: false });
  if (preset === '12X36') {
    setForm((form) => ({ ...form, kind: 'CYCLE', worksHolidays: true, cycleDays: [work12h, off(work12h)] }));
    return;
  }
  if (preset === '4X2') {
    setForm((form) => ({ ...form, kind: 'CYCLE', worksHolidays: true, cycleDays: [
      { ...work4x2 }, { ...work4x2 }, { ...work4x2 }, { ...work4x2 }, off(work4x2), off(work4x2),
    ] }));
    return;
  }
  setForm((form) => ({ ...form, kind: 'CYCLE', worksHolidays: false, cycleDays: [
    { enabled: true, start: '08:00', end: '17:00', breakMinutes: '60' },
    { enabled: false, start: '08:00', end: '17:00', breakMinutes: '60' },
  ] }));
}

function validateTemplateForm(form: TemplateFormState): { valid: boolean; message: string } {
  if (!form.name.trim()) return { valid: false, message: 'Informe o nome da escala.' };
  const tolerance = Number(form.toleranceMinutes);
  if (!Number.isFinite(tolerance) || tolerance < 0 || tolerance > 120) return { valid: false, message: 'A tolerância deve estar entre 0 e 120 minutos.' };
  const days = form.kind === 'CYCLE' ? form.cycleDays : Object.values(form.days);
  if (form.kind === 'CYCLE' && (days.length < 2 || days.length > 60)) return { valid: false, message: 'O ciclo deve possuir entre 2 e 60 dias.' };
  if (!days.some((day) => day.enabled)) return { valid: false, message: 'A escala precisa de ao menos um dia de trabalho.' };
  for (const day of days) {
    if (!day.enabled) continue;
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(day.start) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(day.end)) {
      return { valid: false, message: 'Revise os horários de início e término.' };
    }
    const breakMinutes = Number(day.breakMinutes);
    if (!Number.isFinite(breakMinutes) || breakMinutes < 0 || breakMinutes > 1440) return { valid: false, message: 'Revise os minutos de intervalo.' };
    const gross = grossMinutes(day.start, day.end);
    if (breakMinutes >= gross) return { valid: false, message: 'O intervalo precisa ser menor que a duração da jornada.' };
  }
  return { valid: true, message: '' };
}

function plannedMinutesForFormDay(day: TemplateDayForm): number {
  if (!day.enabled) return 0;
  return Math.max(0, grossMinutes(day.start, day.end) - (Number(day.breakMinutes) || 0));
}

function grossMinutes(start: string, end: string): number {
  const [startHour, startMinute] = start.split(':').map(Number);
  const [endHour, endMinute] = end.split(':').map(Number);
  if (![startHour, startMinute, endHour, endMinute].every(Number.isFinite)) return 0;
  const startTotal = startHour * 60 + startMinute;
  let endTotal = endHour * 60 + endMinute;
  if (endTotal <= startTotal) endTotal += 24 * 60;
  return endTotal - startTotal;
}

function CalculationExplanationView({ data }: { data: CalculationExplanation }) {
  return (
    <div className="space-y-4 text-xs">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <ExplanationMetric label="Previsto" value={minutesLabel(data.plannedMinutes)} />
        <ExplanationMetric label="Trabalhado" value={minutesLabel(data.workedMinutes)} />
        <ExplanationMetric label="Saldo" value={`${data.balanceMinutes > 0 ? '+' : ''}${minutesLabel(data.balanceMinutes)}`} tone={data.balanceMinutes > 0 ? 'positive' : data.balanceMinutes < 0 ? 'negative' : undefined} />
        <ExplanationMetric label="Situação" value={STATUS_LABEL[data.status] ?? data.status} />
      </div>

      <div className="rounded-md border p-3">
        <div className="font-semibold">Regra aplicada</div>
        {data.schedule ? (
          <div className="mt-1.5 space-y-1 text-muted-foreground">
            <div>{data.schedule.name} · {data.schedule.kind === 'CYCLE' ? 'ciclo contínuo' : 'semanal'}{data.schedule.version != null ? ` · versão ${data.schedule.version}` : ''}</div>
            <div>{data.schedule.rule ? `${data.schedule.rule.start}–${data.schedule.rule.end} · intervalo ${data.schedule.rule.breakMinutes ?? 0} min` : 'Folga prevista'} · tolerância ±{data.schedule.toleranceMinutes} min</div>
            {data.schedule.cycleAnchorDay && <div>Âncora do ciclo: {formatDayKey(data.schedule.cycleAnchorDay)}</div>}
            {data.holiday && <div>Feriado: {data.holiday}</div>}
          </div>
        ) : (
          <div className="mt-1.5 text-muted-foreground">Nenhuma escala vigente encontrada para o dia.</div>
        )}
      </div>

      <div className="rounded-md border p-3">
        <div className="font-semibold">Marcações consideradas</div>
        {data.consideredEntries.length === 0 ? (
          <div className="mt-1.5 text-muted-foreground">Nenhuma marcação válida.</div>
        ) : (
          <div className="mt-2 space-y-1.5">
            {data.consideredEntries.map((entry, index) => (
              <div key={entry.id} className="flex flex-wrap items-center justify-between gap-2 rounded border px-2 py-1.5">
                <span>{index + 1}ª marcação · {formatTime(entry.punchedAt)}{entry.nsr ? ` · NSR ${entry.nsr}` : ''}</span>
                {entry.clamped ? (
                  <Badge variant="outline" className="border-sky-400/40 text-[9px] text-sky-600">considerada {formatTime(entry.effective ?? undefined)} pela tolerância</Badge>
                ) : (
                  <Badge variant="outline" className="text-[9px]">horário real</Badge>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {data.cancelledEntries.length > 0 && (
        <div className="rounded-md border border-status-yellow/30 bg-status-yellow/5 p-3">
          <div className="font-semibold">Marcações desconsideradas, mas preservadas</div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {data.cancelledEntries.map((entry) => <Badge key={entry.id} variant="outline" className="text-[9px]">{formatTime(entry.punchedAt)}{entry.nsr ? ` · NSR ${entry.nsr}` : ''}</Badge>)}
          </div>
        </div>
      )}

      {data.pairs.length > 0 && (
        <div className="rounded-md border p-3">
          <div className="font-semibold">Pareamento utilizado</div>
          <div className="mt-2 space-y-1 font-mono text-[10px] text-muted-foreground">{data.pairs.map((pair, index) => <div key={index}>{pair}</div>)}</div>
        </div>
      )}

      <div className="rounded-md border p-3">
        <div className="font-semibold">Etapas do cálculo</div>
        <ol className="mt-2 space-y-2 text-muted-foreground">
          {data.steps.map((step, index) => (
            <li key={index} className="flex gap-2"><span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-sky-500/10 text-[10px] font-bold text-sky-600">{index + 1}</span><span className="leading-5">{step}</span></li>
          ))}
        </ol>
      </div>
      <div className="rounded-md bg-muted/30 p-2 text-[10px] text-muted-foreground">
        Processamento: {data.memory?.calculatedAt || data.processedAt ? formatDateTime(data.memory?.calculatedAt ?? data.processedAt) : 'explicação reproduzida sob demanda com a regra vigente registrada'}
        {data.memory?.algorithmVersion ? ` · motor ${data.memory.algorithmVersion}` : ''}
        {data.memory?.id ? ` · memória ${data.memory.id.slice(0, 8)}` : ''}
      </div>
    </div>
  );
}

function ExplanationMetric({ label, value, tone }: { label: string; value: string; tone?: 'positive' | 'negative' }) {
  return (
    <div className="rounded-md border p-2.5">
      <div className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={cn('mt-1 font-semibold tabular-nums', tone === 'positive' && 'text-status-green', tone === 'negative' && 'text-status-red')}>{value}</div>
    </div>
  );
}

async function buildPunchReceiptPdf(receipt: PunchReceipt) {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')]);
  const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
  const width = doc.internal.pageSize.getWidth();
  const nsr = receipt.entry.nsr ? String(receipt.entry.nsr) : 'não informado';
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.text('Extrato interno de marcação de ponto', width / 2, 42, { align: 'center' });
  doc.setFontSize(9);
  doc.setTextColor(180, 45, 45);
  doc.text('NÃO SUBSTITUI COMPROVANTE REP-P', width / 2, 58, { align: 'center' });
  doc.setTextColor(40);
  autoTable(doc, {
    startY: 78,
    theme: 'grid',
    styles: { fontSize: 9, cellPadding: 5 },
    columnStyles: { 0: { fontStyle: 'bold', cellWidth: 125 } },
    body: [
      ['Empregador', receipt.company.name || '—'],
      ['Inscrição do empregador', receipt.company.registrationMasked || '—'],
      ['Colaborador', receipt.employee.name || '—'],
      ['CPF/registro', receipt.employee.registrationMasked || '—'],
      ['Data e hora da marcação', formatDateTime(receipt.entry.punchedAt, receipt.snapshot.timezone)],
      ['Recebida pelo servidor em', formatDateTime(receipt.entry.recordedAt, receipt.snapshot.timezone)],
      ['Tipo interpretado', receipt.entry.kind === 'OUT' ? 'Saída' : 'Entrada'],
      ['Origem', PUNCH_SOURCE_LABEL[receipt.entry.source] ?? receipt.entry.source ?? '—'],
      ['NSR', nsr],
      ['Identificador da marcação', receipt.entry.id],
    ],
  });
  let y = (doc as any).lastAutoTable.finalY + 18;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text('Checksum do extrato', 40, y);
  y += 11;
  doc.setFont('courier', 'normal');
  doc.setFontSize(7);
  doc.text(doc.splitTextToSize(receipt.snapshot.checksum, width - 80), 40, y);
  y += 24;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(100);
  doc.text(doc.splitTextToSize(`${receipt.legalNotice} Gerado em ${formatDateTime(receipt.generatedAt, receipt.snapshot.timezone)}.`, width - 80), 40, y);
  doc.save(`extrato-interno-ponto-nsr-${nsr.replace(/[^a-zA-Z0-9_-]/g, '-')}.pdf`);
}

function SummaryLine({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className={cn('font-semibold tabular-nums', className)}>{value}</span>
    </div>
  );
}

function minutesLabel(minutes: number): string {
  const abs = Math.abs(Math.round(minutes));
  const hours = Math.floor(abs / 60);
  const rest = abs % 60;
  const sign = minutes < 0 ? '-' : '';
  if (hours === 0) return `${sign}${rest}min`;
  return `${sign}${hours}h${rest ? ` ${String(rest).padStart(2, '0')}min` : ''}`;
}

function formatTime(value: string | undefined): string {
  if (!value) return '--:--';
  return new Date(value).toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' });
}

function formatDayKey(dayKey: string): string {
  const [year, month, day] = dayKey.split('-');
  return `${day}/${month}/${year}`;
}

function formatDateTime(value: string | null | undefined, timeZone = 'America/Sao_Paulo'): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('pt-BR', {
    timeZone,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

/** Último dia do mês YYYY-MM (o backend limita ao dia de hoje). */
function monthEnd(ref: string): string {
  const [year, month] = ref.split('-').map(Number);
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return `${ref}-${String(lastDay).padStart(2, '0')}`;
}

/** Soma meses a uma referência YYYY-MM. */
function addMonths(ref: string, delta: number): string {
  const [year, month] = ref.split('-').map(Number);
  const d = new Date(Date.UTC(year, month - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

/** Geolocalização com timeout curto: sem permissão/sinal, a batida segue sem coordenadas. */
function currentPositionOrNull(): Promise<GeolocationPosition | null> {
  return new Promise((resolve) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      resolve(null);
      return;
    }
    const timer = setTimeout(() => resolve(null), 3000);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        clearTimeout(timer);
        resolve(position);
      },
      () => {
        clearTimeout(timer);
        resolve(null);
      },
      { enableHighAccuracy: false, timeout: 2500, maximumAge: 60_000 },
    );
  });
}
