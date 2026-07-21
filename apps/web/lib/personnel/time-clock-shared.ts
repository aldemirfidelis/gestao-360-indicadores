/**
 * Tipos, rótulos e helpers do Controle de Ponto compartilhados entre a visão
 * administrativa (Serviço Pessoal → Controle de Ponto) e a visão pessoal do
 * colaborador (Minha Vida Funcional → Meu Ponto). Mantém uma única fonte de
 * verdade para formatação de minutos/datas, geração do extrato interno e o
 * mapeamento de status/ocorrências.
 */

export type DayStatus =
  | 'DAY_OFF' | 'IN_PROGRESS' | 'OK' | 'INCOMPLETE' | 'ABSENT' | 'OVERTIME'
  | 'UNDERTIME' | 'VACATION' | 'LEAVE' | 'JUSTIFIED' | 'HOLIDAY';

export interface PunchEntry {
  id: string;
  punchedAt: string;
  kind: 'IN' | 'OUT';
  source: string;
  note: string | null;
  hasLocation: boolean;
  nsr: string | null;
}

export interface OccurrenceDetection {
  type: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  minutes?: number;
}

export interface OccurrenceRow {
  id: string;
  dayKey: string;
  type: string;
  severity: OccurrenceDetection['severity'];
  minutes: number | null;
  status: 'OPEN' | 'JUSTIFIED' | 'DISMISSED' | 'RESOLVED';
  justification: string | null;
  user?: { id: string; name: string; email: string } | null;
}

export interface MirrorDay {
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

export interface MirrorTotals {
  plannedMinutes: number;
  workedMinutes: number;
  balanceMinutes: number;
  okDays: number;
  inconsistentDays: number;
  absentDays: number;
}

export interface MirrorResponse {
  from: string;
  to: string;
  today: string;
  days: MirrorDay[];
  totals: MirrorTotals;
}

export interface SummaryResponse {
  today: MirrorDay & { nextKind: 'IN' | 'OUT'; expectedStartAt: string | null; expectedEndAt: string | null };
  month: MirrorTotals;
  bank: { totalMinutes: number; closedMinutes: number; liveMinutes: number };
  pendingAdjustments: number;
  myPendingAdjustments: number;
  period: { ref: string; status: string };
}

export interface AdjustmentRequest {
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

export interface BankStatement {
  balanceMinutes: number;
  policy: { enabled: boolean; validityMonths: number; maxPositiveMinutes: number | null; maxNegativeMinutes: number | null; expirationAction: string };
  expiringSoonMinutes: number;
  alerts: Array<{ type: 'MAX_POSITIVE' | 'MAX_NEGATIVE'; overBy: number }>;
  entries: Array<{ id: string; kind: string; source: string; minutes: number; periodRef: string | null; expiresAt: string | null; note: string | null; createdAt: string }>;
}

export interface PunchReceipt {
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

export const STATUS_LABEL: Record<DayStatus, string> = {
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

export const STATUS_CLASS: Record<DayStatus, string> = {
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

export const OCCURRENCE_TYPE_LABEL: Record<string, string> = {
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

export const OCCURRENCE_STATUS_LABEL: Record<OccurrenceRow['status'], string> = {
  OPEN: 'Em aberto',
  JUSTIFIED: 'Justificada',
  DISMISSED: 'Dispensada',
  RESOLVED: 'Resolvida',
};

export const ADJUSTMENT_STATUS_LABEL: Record<string, string> = {
  REQUESTED: 'Aguardando aprovação',
  APPROVED: 'Aprovado',
  REJECTED: 'Rejeitado',
  CANCELLED: 'Cancelado',
};

export const ADJUSTMENT_CATEGORY_LABEL: Record<string, string> = {
  ESQUECIMENTO: 'Esquecimento de marcação',
  ATESTADO: 'Atestado/consulta',
  TRABALHO_EXTERNO: 'Trabalho externo',
  TREINAMENTO: 'Treinamento',
  VIAGEM: 'Viagem a serviço',
  OUTRO: 'Outro motivo',
};

export const PUNCH_SOURCE_LABEL: Record<string, string> = {
  WEB: 'Navegador/PWA',
  FACIAL: 'Reconhecimento facial individual',
  FACIAL_KIOSK: 'Totem facial',
  MANUAL: 'Ajuste manual auditado',
  IMPORT: 'Importação',
  API: 'Integração por API',
};

export const BANK_SOURCE_LABEL: Record<string, string> = {
  CLOSING: 'Fechamento de competência',
  EXPIRATION: 'Vencimento',
  MANUAL: 'Lançamento manual',
};

export const WEEKDAY_SHORT: Record<string, string> = {
  mon: 'Seg', tue: 'Ter', wed: 'Qua', thu: 'Qui', fri: 'Sex', sat: 'Sáb', sun: 'Dom',
};

export function minutesLabel(minutes: number): string {
  const abs = Math.abs(Math.round(minutes));
  const hours = Math.floor(abs / 60);
  const rest = abs % 60;
  const sign = minutes < 0 ? '-' : '';
  if (hours === 0) return `${sign}${rest}min`;
  return `${sign}${hours}h${rest ? ` ${String(rest).padStart(2, '0')}min` : ''}`;
}

export function formatTime(value: string | undefined): string {
  if (!value) return '--:--';
  return new Date(value).toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' });
}

export function formatDayKey(dayKey: string): string {
  const [year, month, day] = dayKey.split('-');
  return `${day}/${month}/${year}`;
}

export function formatDateTime(value: string | null | undefined, timeZone = 'America/Sao_Paulo'): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('pt-BR', {
    timeZone, day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
}

/** Último dia do mês YYYY-MM (o backend limita ao dia de hoje). */
export function monthEnd(ref: string): string {
  const [year, month] = ref.split('-').map(Number);
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return `${ref}-${String(lastDay).padStart(2, '0')}`;
}

/** Soma meses a uma referência YYYY-MM. */
export function addMonths(ref: string, delta: number): string {
  const [year, month] = ref.split('-').map(Number);
  const d = new Date(Date.UTC(year, month - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

/** Geolocalização com timeout curto: sem permissão/sinal, a batida segue sem coordenadas. */
export function currentPositionOrNull(): Promise<GeolocationPosition | null> {
  return new Promise((resolve) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      resolve(null);
      return;
    }
    const timer = setTimeout(() => resolve(null), 3000);
    navigator.geolocation.getCurrentPosition(
      (position) => { clearTimeout(timer); resolve(position); },
      () => { clearTimeout(timer); resolve(null); },
      { enableHighAccuracy: false, timeout: 2500, maximumAge: 60_000 },
    );
  });
}

/** Extrato interno (PDF) de uma marcação — não substitui o comprovante REP-P. */
export async function buildPunchReceiptPdf(receipt: PunchReceipt): Promise<void> {
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
