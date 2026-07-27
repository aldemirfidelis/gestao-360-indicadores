'use client';

import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { CalendarPlus, CheckCircle2, UserPlus, X } from 'lucide-react';
import { PageHeader } from '@/components/shell/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { ConfirmDialog } from '@/components/platform/confirm-dialog';
import { useAuth } from '@/components/auth/auth-provider';
import { api } from '@/lib/api';
import { cn, formatDate } from '@/lib/utils';
import { ClassStatusPill, EmptyState } from '@/components/training/training-bits';
import {
  ATTENDANCE_LABEL,
  hoursLabel,
  type AttendanceStatus,
  type ClassDetail,
  type ClassItem,
  type TrainingItem,
} from '@/lib/training/types';

function TurmasContent() {
  const qc = useQueryClient();
  const searchParams = useSearchParams();
  const { hasPermission } = useAuth();
  const canManage = hasPermission(['training:class:manage', 'training:manage']);
  const canAttendance = hasPermission(['training:attendance', 'training:manage']);
  const canClose = hasPermission(['training:result', 'training:manage']);

  const [status, setStatus] = useState('');
  const [openNew, setOpenNew] = useState(searchParams.get('nova') === '1');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const params = new URLSearchParams();
  if (status) params.set('status', status);

  const classes = useQuery<ClassItem[]>({
    queryKey: ['training-classes', params.toString()],
    queryFn: () => api(`/training/classes?${params.toString()}`),
  });

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ['training-classes'] });
    void qc.invalidateQueries({ queryKey: ['training-class-detail'] });
    void qc.invalidateQueries({ queryKey: ['training-overview'] });
    void qc.invalidateQueries({ queryKey: ['training-assignments'] });
  };

  const items = classes.data ?? [];

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <NativeSelect className="w-56" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">Todas as situações</option>
          <option value="PLANNED">Planejadas</option>
          <option value="OPEN">Abertas</option>
          <option value="IN_PROGRESS">Em andamento</option>
          <option value="DONE">Concluídas</option>
          <option value="CANCELLED">Canceladas</option>
        </NativeSelect>
        {canManage && (
          <Button onClick={() => setOpenNew(true)}>
            <CalendarPlus className="mr-2 h-4 w-4" />
            Nova turma
          </Button>
        )}
      </div>

      {classes.isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : items.length === 0 ? (
        <EmptyState
          title="Nenhuma turma encontrada para os filtros selecionados."
          description="Crie uma turma a partir das pendências: o sistema inclui automaticamente todos os colaboradores que devem o treinamento."
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border bg-card">
          <table className="w-full min-w-[860px] text-sm">
            <thead className="border-b bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5 text-left font-medium">Treinamento</th>
                <th className="px-4 py-2.5 text-left font-medium">Data</th>
                <th className="px-4 py-2.5 text-left font-medium">Instrutor</th>
                <th className="px-4 py-2.5 text-left font-medium">Local</th>
                <th className="px-4 py-2.5 text-right font-medium">Participantes</th>
                <th className="px-4 py-2.5 text-left font-medium">Situação</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {items.map((turma) => (
                <tr
                  key={turma.id}
                  className="cursor-pointer transition-colors hover:bg-muted/40"
                  onClick={() => setSelectedId(turma.id)}
                >
                  <td className="px-4 py-2.5">
                    <div className="font-medium">{turma.training.name}</div>
                    <div className="text-[11px] text-muted-foreground">
                      {turma.training.code} · {hoursLabel(turma.training.workloadMinutes)}
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground">{formatDate(turma.startsAt)}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">{turma.instructor?.name ?? '—'}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">{turma.location ?? turma.meetingUrl ?? '—'}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-muted-foreground">
                    {turma.participantCount}
                    {turma.capacity ? ` / ${turma.capacity}` : ''}
                  </td>
                  <td className="px-4 py-2.5">
                    <ClassStatusPill status={turma.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <NewClassDialog open={openNew} onOpenChange={setOpenNew} onSaved={(id) => { invalidate(); setSelectedId(id); }} />
      <ClassDetailDialog
        classId={selectedId}
        onClose={() => setSelectedId(null)}
        onChanged={invalidate}
        canAttendance={canAttendance}
        canClose={canClose}
        canManage={canManage}
      />
    </>
  );
}

export default function TurmasPage() {
  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Treinamento e Desenvolvimento"
        tone="view"
        title="Turmas e Agenda"
        description="Programe turmas, convoque os pendentes, registre presença e conclua — a conclusão fecha a pendência da matriz."
        breadcrumbs={[{ label: 'Treinamento', href: '/treinamento' }, { label: 'Turmas' }]}
      />
      <Suspense fallback={<Skeleton className="h-64 w-full" />}>
        <TurmasContent />
      </Suspense>
    </div>
  );
}

// ---------------------------------------------------------------- diálogos

function NewClassDialog({
  open,
  onOpenChange,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: (id: string) => void;
}) {
  const [form, setForm] = useState({
    trainingId: '',
    startsAt: '',
    endsAt: '',
    location: '',
    meetingUrl: '',
    capacity: '',
    instructorId: '',
    addPendingParticipants: true,
  });

  const trainings = useQuery<TrainingItem[]>({
    queryKey: ['training-catalog-simple'],
    queryFn: () => api('/training/catalog/trainings?status=ACTIVE'),
    enabled: open,
  });
  const instructors = useQuery<Array<{ id: string; name: string }>>({
    queryKey: ['training-instructors'],
    queryFn: () => api('/training/catalog/instructors'),
    enabled: open,
  });

  const save = useMutation({
    mutationFn: () =>
      api<{ id: string }>('/training/classes', {
        method: 'POST',
        json: {
          ...form,
          capacity: form.capacity || null,
          endsAt: form.endsAt || null,
          instructorId: form.instructorId || null,
          location: form.location || null,
          meetingUrl: form.meetingUrl || null,
        },
      }),
    onSuccess: (turma) => {
      toast.success('Turma criada.');
      onSaved(turma.id);
      onOpenChange(false);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Nova turma</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <FieldRow label="Treinamento">
            <NativeSelect value={form.trainingId} onChange={(e) => setForm({ ...form, trainingId: e.target.value })}>
              <option value="">Selecione...</option>
              {(trainings.data ?? []).map((training) => (
                <option key={training.id} value={training.id}>
                  {training.code} · {training.name}
                </option>
              ))}
            </NativeSelect>
          </FieldRow>
          <div className="grid gap-3 sm:grid-cols-2">
            <FieldRow label="Início">
              <Input type="datetime-local" value={form.startsAt} onChange={(e) => setForm({ ...form, startsAt: e.target.value })} />
            </FieldRow>
            <FieldRow label="Término">
              <Input type="datetime-local" value={form.endsAt} onChange={(e) => setForm({ ...form, endsAt: e.target.value })} />
            </FieldRow>
          </div>
          <FieldRow label="Instrutor">
            <NativeSelect value={form.instructorId} onChange={(e) => setForm({ ...form, instructorId: e.target.value })}>
              <option value="">A definir</option>
              {(instructors.data ?? []).map((instructor) => (
                <option key={instructor.id} value={instructor.id}>{instructor.name}</option>
              ))}
            </NativeSelect>
          </FieldRow>
          <div className="grid gap-3 sm:grid-cols-2">
            <FieldRow label="Local">
              <Input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="Sala, unidade..." />
            </FieldRow>
            <FieldRow label="Capacidade">
              <Input type="number" min={1} value={form.capacity} onChange={(e) => setForm({ ...form, capacity: e.target.value })} />
            </FieldRow>
          </div>
          <FieldRow label="Link (online)">
            <Input value={form.meetingUrl} onChange={(e) => setForm({ ...form, meetingUrl: e.target.value })} />
          </FieldRow>
          <label className="flex cursor-pointer items-start gap-2.5 rounded-md border p-3 text-sm hover:bg-muted/40">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={form.addPendingParticipants}
              onChange={(e) => setForm({ ...form, addPendingParticipants: e.target.checked })}
            />
            <span>
              <span className="block">Incluir todos os colaboradores pendentes deste treinamento</span>
              <span className="block text-[11px] text-muted-foreground">
                Quem excede a capacidade entra em lista de espera.
              </span>
            </span>
          </label>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={() => save.mutate()} disabled={!form.trainingId || !form.startsAt || save.isPending}>
            {save.isPending ? 'Criando...' : 'Criar turma'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ClassDetailDialog({
  classId,
  onClose,
  onChanged,
  canAttendance,
  canClose,
  canManage,
}: {
  classId: string | null;
  onClose: () => void;
  onChanged: () => void;
  canAttendance: boolean;
  canClose: boolean;
  canManage: boolean;
}) {
  const qc = useQueryClient();
  const [confirmClose, setConfirmClose] = useState(false);

  const detail = useQuery<ClassDetail>({
    queryKey: ['training-class-detail', classId],
    queryFn: () => api(`/training/classes/${classId}`),
    enabled: Boolean(classId),
  });

  const setAttendance = useMutation({
    mutationFn: (entries: Array<{ participantId: string; attendance: AttendanceStatus; score?: number | null; absenceReason?: string }>) =>
      api(`/training/classes/${classId}/attendance`, { method: 'POST', json: { entries } }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['training-class-detail', classId] });
      onChanged();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const addPending = useMutation({
    mutationFn: () => api(`/training/classes/${classId}/participants/pending`, { method: 'POST' }),
    onSuccess: (result: any) => {
      toast.success(`${result?.added ?? 0} colaborador(es) incluído(s).`);
      void qc.invalidateQueries({ queryKey: ['training-class-detail', classId] });
      onChanged();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const closeClass = useMutation({
    mutationFn: () => api(`/training/classes/${classId}/close`, { method: 'POST' }),
    onSuccess: (result: any) => {
      toast.success(`Turma concluída: ${result?.approved ?? 0} aprovado(s), ${result?.failed ?? 0} reprovado(s).`);
      setConfirmClose(false);
      onChanged();
      onClose();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const turma = detail.data;

  return (
    <>
      <Dialog open={Boolean(classId)} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="pr-6 text-left">{turma?.training.name ?? 'Turma'}</DialogTitle>
          </DialogHeader>

          {detail.isLoading || !turma ? (
            <Skeleton className="h-64 w-full" />
          ) : (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                <ClassStatusPill status={turma.status} />
                <span>{formatDate(turma.startsAt)}</span>
                {turma.instructor && <span>Instrutor: {turma.instructor.name}</span>}
                {turma.location && <span>{turma.location}</span>}
                <span>{hoursLabel(turma.training.workloadMinutes)}</span>
              </div>

              {turma.requiresAssessment && (
                <p className="rounded-md border border-violet-300/60 bg-violet-500/10 px-3 py-2 text-xs text-violet-800 dark:text-violet-300">
                  Este treinamento exige avaliação
                  {turma.minimumScore !== null && turma.minimumScore !== undefined ? ` (nota mínima ${turma.minimumScore})` : ''}.
                  Informe a nota de cada participante antes de concluir.
                </p>
              )}

              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-semibold">Participantes ({turma.participants.length})</h3>
                {canManage && turma.status !== 'DONE' && turma.status !== 'CANCELLED' && (
                  <Button variant="outline" size="sm" onClick={() => addPending.mutate()} disabled={addPending.isPending}>
                    <UserPlus className="mr-1.5 h-3.5 w-3.5" />
                    Incluir pendentes
                  </Button>
                )}
              </div>

              {turma.participants.length === 0 ? (
                <EmptyState title="Nenhum participante nesta turma." description="Use Incluir pendentes para convocar quem deve o treinamento." />
              ) : (
                <div className="overflow-x-auto rounded-lg border">
                  <table className="w-full min-w-[640px] text-sm">
                    <thead className="border-b bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                      <tr>
                        <th className="px-3 py-2 text-left font-medium">Colaborador</th>
                        <th className="px-3 py-2 text-left font-medium">Presença</th>
                        {turma.requiresAssessment && <th className="px-3 py-2 text-left font-medium">Nota</th>}
                        <th className="px-3 py-2 text-left font-medium">Resultado</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {turma.participants.map((participant) => (
                        <tr key={participant.id}>
                          <td className="px-3 py-2">
                            <div className="font-medium">{participant.name}</div>
                            <div className="text-[11px] text-muted-foreground">
                              {[participant.job, participant.area].filter(Boolean).join(' · ') || '—'}
                              {participant.waitlisted && ' · lista de espera'}
                            </div>
                          </td>
                          <td className="px-3 py-2">
                            {canAttendance && turma.status !== 'DONE' && turma.status !== 'CANCELLED' ? (
                              <NativeSelect
                                className="h-8 w-40 text-xs"
                                value={participant.attendance}
                                onChange={(e) =>
                                  setAttendance.mutate([
                                    {
                                      participantId: participant.id,
                                      attendance: e.target.value as AttendanceStatus,
                                      absenceReason: e.target.value === 'ABSENT' ? 'Não compareceu' : undefined,
                                    },
                                  ])
                                }
                              >
                                {(Object.keys(ATTENDANCE_LABEL) as AttendanceStatus[]).map((key) => (
                                  <option key={key} value={key}>{ATTENDANCE_LABEL[key]}</option>
                                ))}
                              </NativeSelect>
                            ) : (
                              <span className="text-muted-foreground">{ATTENDANCE_LABEL[participant.attendance]}</span>
                            )}
                          </td>
                          {turma.requiresAssessment && (
                            <td className="px-3 py-2">
                              {canAttendance && turma.status !== 'DONE' ? (
                                <Input
                                  type="number"
                                  min={0}
                                  max={100}
                                  className="h-8 w-24"
                                  defaultValue={participant.score ?? ''}
                                  onBlur={(e) =>
                                    e.target.value !== String(participant.score ?? '') &&
                                    setAttendance.mutate([
                                      {
                                        participantId: participant.id,
                                        attendance: participant.attendance,
                                        score: e.target.value === '' ? null : Number(e.target.value),
                                      },
                                    ])
                                  }
                                />
                              ) : (
                                <span className="text-muted-foreground">{participant.score ?? '—'}</span>
                              )}
                            </td>
                          )}
                          <td className="px-3 py-2">
                            <span
                              className={cn(
                                'text-xs',
                                participant.result === 'APPROVED' && 'text-emerald-600 dark:text-emerald-400',
                                participant.result === 'FAILED' && 'text-rose-600 dark:text-rose-400',
                                participant.result === 'PENDING' && 'text-muted-foreground',
                              )}
                            >
                              {participant.result === 'APPROVED'
                                ? 'Aprovado'
                                : participant.result === 'FAILED'
                                  ? 'Reprovado'
                                  : 'Aguardando conclusão'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={onClose}>Fechar</Button>
            {canClose && turma && turma.status !== 'DONE' && turma.status !== 'CANCELLED' && (
              <Button onClick={() => setConfirmClose(true)}>
                <CheckCircle2 className="mr-2 h-4 w-4" />
                Concluir turma
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={confirmClose}
        onOpenChange={setConfirmClose}
        title="Concluir turma"
        description="A conclusão registra o resultado de cada participante, fecha as pendências da matriz e calcula a validade. Não pode ser desfeita."
        confirmLabel="Concluir"
        onConfirm={async () => {
          await closeClass.mutateAsync();
        }}
      />
    </>
  );
}

function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium">{label}</Label>
      {children}
    </div>
  );
}
