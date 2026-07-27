'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { CalendarDays, CheckCircle2, Download, FileText, GraduationCap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { api } from '@/lib/api';
import { formatDate } from '@/lib/utils';
import { CertificateStatusPill, EmptyState, MetricCard, StatusPill } from '@/components/training/training-bits';
import {
  ATTENDANCE_LABEL,
  MODALITY_LABEL,
  hoursLabel,
  percentLabel,
  type AssignmentStatus,
  type AttendanceStatus,
  type CertificateStatus,
  type TrainingModality,
} from '@/lib/training/types';

interface MyTrainings {
  linked: boolean;
  compliance: number | null;
  workloadHours: number;
  counters?: { pending: number; expired: number; dueSoon: number; scheduled: number };
  items: Array<{
    id: string;
    training: {
      id: string; code: string; name: string; description?: string | null;
      modality: TrainingModality; workloadMinutes: number; allowsOnline: boolean;
      document?: { id: string; code: string | null; title: string; version: number } | null;
    };
    status: AssignmentStatus;
    mandatory: boolean;
    dueAt?: string | null;
    completedAt?: string | null;
    validUntil?: string | null;
    score?: number | null;
    class?: { id: string; startsAt: string; location?: string | null; meetingUrl?: string | null } | null;
  }>;
  classes: Array<{
    participantId: string;
    attendance: AttendanceStatus;
    waitlisted: boolean;
    class: {
      id: string; startsAt: string; endsAt?: string | null; location?: string | null; meetingUrl?: string | null;
      training: { id: string; code: string; name: string };
      instructor?: { name: string } | null;
    };
  }>;
  certificates: Array<{
    id: string;
    training?: { id: string; code: string; name: string } | null;
    status: CertificateStatus;
    number?: string | null;
    institution?: string | null;
    issuedAt?: string | null;
    validUntil?: string | null;
    fileUrl?: string | null;
    fileName?: string | null;
  }>;
}

/**
 * Meus Treinamentos — o colaborador consulta e confirma participação.
 * Nenhuma ação aqui altera resultado, presença, nota ou validade.
 */
export function MeusTreinamentosPanel() {
  const qc = useQueryClient();
  const data = useQuery<MyTrainings>({
    queryKey: ['my-trainings'],
    queryFn: () => api('/training/me'),
  });

  const confirm = useMutation({
    mutationFn: (participantId: string) => api(`/training/me/classes/${participantId}/confirm`, { method: 'POST' }),
    onSuccess: () => {
      toast.success('Participação confirmada.');
      void qc.invalidateQueries({ queryKey: ['my-trainings'] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  if (data.isLoading) return <Skeleton className="h-64 w-full" />;

  const info = data.data;
  if (!info?.linked) {
    return (
      <EmptyState
        title="Seu login ainda não está vinculado a um cadastro de colaborador."
        description="A matriz de treinamento é montada sobre o cadastro do Serviço Pessoal. Procure o RH para vincular seu acesso."
      />
    );
  }

  const pending = info.items.filter((item) =>
    ['PENDING', 'NOT_STARTED', 'EXPIRED', 'DUE_SOON', 'FAILED', 'ABSENT', 'SCHEDULED', 'CONFIRMED'].includes(item.status),
  );
  const done = info.items.filter((item) => ['VALID', 'AWAITING_EFFECTIVENESS', 'WAIVED'].includes(item.status));

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Minha conformidade" value={percentLabel(info.compliance)} hint="Treinamentos em dia sobre os exigidos" />
        <MetricCard label="Pendentes" value={info.counters?.pending ?? 0} tone={info.counters?.pending ? 'amber' : undefined} />
        <MetricCard label="Vencidos" value={info.counters?.expired ?? 0} tone={info.counters?.expired ? 'red' : undefined} />
        <MetricCard label="Carga horária" value={`${info.workloadHours}h`} hint="Acumulada em treinamentos concluídos" />
      </div>

      {info.classes.length > 0 && (
        <section className="space-y-2">
          <h3 className="text-sm font-semibold">Turmas agendadas</h3>
          <div className="space-y-2">
            {info.classes.map((entry) => (
              <Card key={entry.participantId}>
                <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
                  <div className="min-w-0">
                    <p className="font-medium">{entry.class.training.name}</p>
                    <p className="text-xs text-muted-foreground">
                      <CalendarDays className="mr-1 inline h-3.5 w-3.5" />
                      {formatDate(entry.class.startsAt)}
                      {entry.class.location ? ` · ${entry.class.location}` : ''}
                      {entry.class.instructor ? ` · ${entry.class.instructor.name}` : ''}
                      {entry.waitlisted ? ' · lista de espera' : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">{ATTENDANCE_LABEL[entry.attendance]}</span>
                    {entry.class.meetingUrl && (
                      <Button asChild size="sm" variant="outline">
                        <a href={entry.class.meetingUrl} target="_blank" rel="noreferrer">Acessar</a>
                      </Button>
                    )}
                    {entry.attendance === 'INVITED' && (
                      <Button size="sm" onClick={() => confirm.mutate(entry.participantId)} disabled={confirm.isPending}>
                        Confirmar presença
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      )}

      <section className="space-y-2">
        <h3 className="text-sm font-semibold">A realizar</h3>
        {pending.length === 0 ? (
          <EmptyState title="Você está em dia com seus treinamentos obrigatórios." />
        ) : (
          <div className="space-y-2">
            {pending.map((item) => (
              <Card key={item.id}>
                <CardContent className="flex flex-wrap items-start justify-between gap-3 p-4">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium">{item.training.name}</p>
                      <StatusPill status={item.status} />
                      {!item.mandatory && <span className="text-[11px] text-muted-foreground">recomendado</span>}
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {MODALITY_LABEL[item.training.modality]} · {hoursLabel(item.training.workloadMinutes)}
                      {item.dueAt ? ` · prazo ${formatDate(item.dueAt)}` : ''}
                      {item.validUntil ? ` · venceu em ${formatDate(item.validUntil)}` : ''}
                    </p>
                    {item.training.description && (
                      <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{item.training.description}</p>
                    )}
                  </div>
                  {item.training.document && (
                    <Button asChild size="sm" variant="outline">
                      <a href={`/documents?doc=${item.training.document.id}`}>
                        <FileText className="mr-1.5 h-3.5 w-3.5" />
                        Ver documento
                      </a>
                    </Button>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-2">
        <h3 className="text-sm font-semibold">Histórico</h3>
        {done.length === 0 ? (
          <EmptyState title="Nenhum treinamento concluído ainda." />
        ) : (
          <div className="overflow-x-auto rounded-lg border bg-card">
            <table className="w-full min-w-[600px] text-sm">
              <thead className="border-b bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-2.5 text-left font-medium">Treinamento</th>
                  <th className="px-4 py-2.5 text-left font-medium">Realizado</th>
                  <th className="px-4 py-2.5 text-left font-medium">Validade</th>
                  <th className="px-4 py-2.5 text-left font-medium">Situação</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {done.map((item) => (
                  <tr key={item.id}>
                    <td className="px-4 py-2.5">
                      <div className="font-medium">{item.training.name}</div>
                      <div className="text-[11px] text-muted-foreground">{hoursLabel(item.training.workloadMinutes)}</div>
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground">
                      {item.completedAt ? formatDate(item.completedAt) : '—'}
                      {item.score !== null && item.score !== undefined && <div className="text-[11px]">Nota {item.score}</div>}
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground">
                      {item.validUntil ? formatDate(item.validUntil) : 'Sem vencimento'}
                    </td>
                    <td className="px-4 py-2.5">
                      <StatusPill status={item.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {info.certificates.length > 0 && (
        <section className="space-y-2">
          <h3 className="text-sm font-semibold">Meus certificados</h3>
          <div className="divide-y rounded-lg border bg-card">
            {info.certificates.map((certificate) => (
              <div key={certificate.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm">
                <div className="min-w-0">
                  <p className="font-medium">{certificate.training?.name ?? 'Certificado'}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {certificate.institution ?? '—'}
                    {certificate.issuedAt ? ` · ${formatDate(certificate.issuedAt)}` : ''}
                    {certificate.validUntil ? ` · válido até ${formatDate(certificate.validUntil)}` : ''}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <CertificateStatusPill status={certificate.status} />
                  {certificate.fileUrl && (
                    <Button asChild size="sm" variant="outline">
                      <a href={certificate.fileUrl} download={certificate.fileName ?? undefined}>
                        <Download className="mr-1.5 h-3.5 w-3.5" />
                        Baixar
                      </a>
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {info.items.length === 0 && (
        <div className="rounded-lg border border-dashed bg-card/50 px-4 py-12 text-center">
          <GraduationCap className="mx-auto h-8 w-8 text-muted-foreground/50" />
          <p className="mt-3 text-sm">Nenhum treinamento exigido para o seu cargo no momento.</p>
        </div>
      )}
    </div>
  );
}
