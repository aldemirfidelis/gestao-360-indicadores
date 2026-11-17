'use client';

import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { CheckCircle2, Clock, Forward, Loader2, PenLine, RotateCcw, Save, Send, ShieldCheck, Undo2, UserRound, XCircle } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/components/auth/auth-provider';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { NativeSelect } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ReasonDialog, type ReasonDialogState } from '@/components/platform/reason-dialog';
import { cn } from '@/lib/utils';
import { SignatureDialog, type SignatureRequest } from './signature-dialog';
import { formatDateTime, isEditable, type DocDetail, type DocOptions, type WorkflowStep } from './types';
import { Field, MultiSelect, errorMessage, invalidateDocuments, userOptions } from './ui';

const DECISION_LABEL: Record<string, string> = {
  PENDING: 'Aguardando',
  APPROVED: 'Aprovado',
  ADJUSTMENTS_REQUESTED: 'Pediu ajustes',
  REJECTED: 'Reprovado',
  CANCELLED: 'Cancelado',
};

const DECISION_CLASS: Record<string, string> = {
  PENDING: 'border-status-yellow/40 text-status-yellow',
  APPROVED: 'border-status-green/40 text-status-green',
  ADJUSTMENTS_REQUESTED: 'border-status-yellow/40 text-status-yellow',
  REJECTED: 'border-status-red/40 text-status-red',
  CANCELLED: 'text-muted-foreground',
};

function StepRow({ step, canDelegate, onDelegate }: { step: WorkflowStep; canDelegate: boolean; onDelegate: (step: WorkflowStep) => void }) {
  const Icon = step.decision === 'APPROVED' ? CheckCircle2 : step.decision === 'REJECTED' ? XCircle : step.decision === 'ADJUSTMENTS_REQUESTED' ? RotateCcw : Clock;
  return (
    <li className={cn('flex flex-col gap-2 rounded-lg border px-3 py-2.5 sm:flex-row sm:items-center', step.active && 'border-primary/40 bg-primary/5')}>
      <div className="flex min-w-0 flex-1 items-start gap-2.5">
        <Icon className={cn('mt-0.5 h-4 w-4 shrink-0', step.decision === 'APPROVED' ? 'text-status-green' : step.decision === 'REJECTED' ? 'text-status-red' : step.decision === 'PENDING' ? 'text-status-yellow' : 'text-muted-foreground')} />
        <div className="min-w-0">
          <p className="text-sm font-medium">
            {step.user?.name ?? 'Pessoa removida'}
            <span className="ml-2 text-xs font-normal text-muted-foreground">{step.role === 'REVIEW' ? 'Revisão' : 'Aprovação'} · etapa {step.order}</span>
          </p>
          <p className="text-xs text-muted-foreground">
            {step.decidedAt ? `Assinou em ${formatDateTime(step.decidedAt)}` : step.dueAt ? `Prazo ${formatDateTime(step.dueAt)}` : 'Sem prazo'}
            {step.overdue && <span className="ml-1 font-medium text-status-red">· atrasada</span>}
            {step.delegatedFromUserId && <span className="ml-1">· recebida por delegação</span>}
          </p>
          {step.comment && <p className="mt-1 whitespace-pre-wrap rounded bg-muted/40 px-2 py-1 text-xs">{step.comment}</p>}
        </div>
      </div>
      <div className="flex items-center gap-2 pl-6 sm:pl-0">
        {step.active && step.decision === 'PENDING' && <Badge variant="outline" className="border-primary/40 text-primary">Na vez</Badge>}
        <Badge variant="outline" className={DECISION_CLASS[step.decision] ?? ''}>{DECISION_LABEL[step.decision] ?? step.decision}</Badge>
        {canDelegate && step.decision === 'PENDING' && (
          <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => onDelegate(step)}>
            <Forward className="mr-1 h-3.5 w-3.5" /> Delegar
          </Button>
        )}
      </div>
    </li>
  );
}

export function WorkflowPanel({ doc, options }: { doc: DocDetail; options: DocOptions | undefined }) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const flow = doc.workflow;
  const caps = doc.capabilities;
  const author = doc.ownerUserId ?? doc.createdById;
  const [reviewerIds, setReviewerIds] = useState<string[]>([]);
  const [approverIds, setApproverIds] = useState<string[]>([]);
  const [mode, setMode] = useState<'SEQUENTIAL' | 'PARALLEL'>('SEQUENTIAL');
  const [reviewDays, setReviewDays] = useState('5');
  const [approvalDays, setApprovalDays] = useState('5');
  const [signature, setSignature] = useState<SignatureRequest | null>(null);
  const [reason, setReason] = useState<ReasonDialogState | null>(null);
  const [submitOpen, setSubmitOpen] = useState(false);
  const [changeSummary, setChangeSummary] = useState('');
  const [delegateStep, setDelegateStep] = useState<WorkflowStep | null>(null);
  const [delegateTo, setDelegateTo] = useState('');
  const [delegateReason, setDelegateReason] = useState('');

  useEffect(() => {
    setReviewerIds(flow.reviewers.map((person) => person.id));
    setApproverIds(flow.approvers.map((person) => person.id));
    setMode(flow.mode);
    setReviewDays(String(flow.reviewDays));
    setApprovalDays(String(flow.approvalDays));
  }, [flow.reviewers, flow.approvers, flow.mode, flow.reviewDays, flow.approvalDays]);

  const dirty = useMemo(
    () =>
      reviewerIds.join() !== flow.reviewers.map((person) => person.id).join() ||
      approverIds.join() !== flow.approvers.map((person) => person.id).join() ||
      mode !== flow.mode ||
      Number(reviewDays) !== flow.reviewDays ||
      Number(approvalDays) !== flow.approvalDays,
    [reviewerIds, approverIds, mode, reviewDays, approvalDays, flow],
  );
  const conflicts = useMemo(() => {
    const messages: string[] = [];
    if (author && (reviewerIds.includes(author) || approverIds.includes(author))) messages.push('Quem elabora o documento não pode revisá-lo nem aprová-lo.');
    if (reviewerIds.some((id) => approverIds.includes(id))) messages.push('A mesma pessoa não pode ser revisora e aprovadora.');
    return messages;
  }, [author, reviewerIds, approverIds]);

  const refresh = () => invalidateDocuments(qc);
  const saveParticipants = useMutation({
    mutationFn: () =>
      api<DocDetail>(`/documents/${doc.id}/workflow/participants`, {
        method: 'PUT',
        json: { reviewerIds, approverIds, mode, reviewDays: Number(reviewDays) || 5, approvalDays: Number(approvalDays) || 5 },
      }),
    onSuccess: () => {
      toast.success('Participantes salvos.');
      refresh();
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const submit = useMutation({
    mutationFn: async () => {
      if (dirty) await saveParticipants.mutateAsync();
      return api<DocDetail>(`/documents/${doc.id}/workflow/submit`, { method: 'POST', json: { changeSummary: changeSummary.trim() || undefined } });
    },
    onSuccess: (result) => {
      toast.success(result.status === 'WAITING_REVIEW' ? 'Enviado para revisão.' : 'Enviado para aprovação.');
      setSubmitOpen(false);
      setChangeSummary('');
      refresh();
    },
    onError: (error) => toast.error(errorMessage(error, 'Não foi possível enviar o documento.')),
  });

  const cancelFlow = useMutation({
    mutationFn: (text: string) => api(`/documents/${doc.id}/workflow/cancel`, { method: 'POST', json: { reason: text } }),
    onSuccess: () => {
      toast.success('Documento retirado do fluxo e devolvido para elaboração.');
      refresh();
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const delegate = useMutation({
    mutationFn: () => api(`/documents/${doc.id}/workflow/delegate`, { method: 'POST', json: { stepId: delegateStep?.id, toUserId: delegateTo, reason: delegateReason.trim() } }),
    onSuccess: () => {
      toast.success('Etapa delegada.');
      setDelegateStep(null);
      setDelegateTo('');
      setDelegateReason('');
      refresh();
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const unschedule = useMutation({
    mutationFn: (comment: string) => api(`/documents/${doc.id}/unschedule`, { method: 'POST', json: { comment } }),
    onSuccess: () => {
      toast.success('Agendamento cancelado. O documento voltou para Aprovado.');
      refresh();
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const decide = (decision: 'APPROVE' | 'ADJUST' | 'REJECT') => {
    const approval = flow.myRole === 'APPROVAL';
    setSignature({
      title: decision === 'APPROVE' ? (approval ? 'Aprovar documento' : 'Concluir revisão') : decision === 'ADJUST' ? 'Pedir ajustes' : 'Reprovar documento',
      description:
        decision === 'APPROVE'
          ? `Você confirma que conferiu ${flow.versionLabel ?? 'esta revisão'} de "${doc.title}".`
          : 'O documento volta para quem elaborou, com o seu comentário.',
      confirmLabel: decision === 'APPROVE' ? (approval ? 'Assinar e aprovar' : 'Assinar revisão') : decision === 'ADJUST' ? 'Assinar e devolver' : 'Assinar reprovação',
      destructive: decision === 'REJECT',
      commentRequired: decision !== 'APPROVE',
      commentLabel: decision === 'APPROVE' ? 'Comentário' : 'O que precisa mudar',
      allowPublishNow: decision === 'APPROVE' && approval,
      onConfirm: async ({ password, comment, publishNow }) => {
        const result = await api<DocDetail & { decision?: { signature: string } }>(`/documents/${doc.id}/workflow/decide`, {
          method: 'POST',
          json: { decision, password, comment, publishNow },
        });
        toast.success(`Assinatura registrada${result.decision?.signature ? ` · código ${result.decision.signature}` : ''}.`);
        refresh();
      },
    });
  };

  const publish = () =>
    setSignature({
      title: 'Publicar documento',
      description: 'O sistema gera o PDF oficial com o registro das assinaturas, torna esta revisão vigente, substitui a anterior e distribui a leitura obrigatória.',
      confirmLabel: 'Assinar e publicar',
      allowSchedule: true,
      onConfirm: async ({ password, comment, publishAt }) => {
        await api(`/documents/${doc.id}/publish`, { method: 'POST', json: { password, comment, publishAt } });
        toast.success(publishAt ? 'Publicação agendada.' : 'Documento publicado.');
        refresh();
      },
    });

  const editableParticipants = caps.canConfigure && (isEditable(doc.status) || !flow.inFlow);
  const manager = caps.isManager;
  const lastAdjustment = doc.approvals.find((approval) => approval.decision === 'ADJUSTMENTS_REQUESTED' || approval.decision === 'REJECTED');

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
      <div className="space-y-4">
        {flow.myStepId && (
          <Card className="border-primary/40 bg-primary/5">
            <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
              <PenLine className="h-6 w-6 shrink-0 text-primary" />
              <div className="flex-1">
                <p className="text-sm font-semibold">{flow.myRole === 'REVIEW' ? 'Sua revisão é necessária' : 'Sua aprovação é necessária'}</p>
                <p className="text-xs text-muted-foreground">Leia o conteúdo na aba Conteúdo ou no modo leitura antes de assinar.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" onClick={() => decide('APPROVE')}>
                  <ShieldCheck className="mr-1.5 h-4 w-4" />
                  {flow.myRole === 'REVIEW' ? 'Concluir revisão' : 'Aprovar'}
                </Button>
                <Button size="sm" variant="outline" onClick={() => decide('ADJUST')}>
                  <RotateCcw className="mr-1.5 h-4 w-4" /> Pedir ajustes
                </Button>
                {flow.myRole === 'APPROVAL' && (
                  <Button size="sm" variant="outline" className="text-status-red" onClick={() => decide('REJECT')}>
                    <XCircle className="mr-1.5 h-4 w-4" /> Reprovar
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {(doc.status === 'ADJUSTMENTS_REQUESTED' || doc.status === 'REJECTED') && lastAdjustment && (
          <Card className="border-status-yellow/40 bg-status-yellow/5">
            <CardContent className="p-4">
              <p className="text-sm font-semibold">{doc.status === 'REJECTED' ? 'Documento reprovado' : 'Ajustes solicitados'} por {lastAdjustment.user?.name ?? 'participante'}</p>
              {lastAdjustment.comment && <p className="mt-1 whitespace-pre-wrap text-sm">{lastAdjustment.comment}</p>}
              <p className="mt-2 text-xs text-muted-foreground">Ajuste o conteúdo e envie novamente para análise.</p>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Etapas da {flow.versionLabel ?? 'revisão atual'}</CardTitle>
            <CardDescription>
              {flow.mode === 'PARALLEL' ? 'Todos assinam ao mesmo tempo.' : 'Cada pessoa assina na sua vez, na ordem definida.'}
              {flow.contentHash && <span className="ml-1">Conteúdo congelado · hash {flow.contentHash.slice(0, 12).toUpperCase()}.</span>}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {flow.steps.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {isEditable(doc.status) ? 'O documento ainda não foi enviado. Defina os participantes ao lado e envie quando o conteúdo estiver pronto.' : 'Sem etapas registradas para esta revisão.'}
              </p>
            ) : (
              <ol className="space-y-2">
                {flow.steps.map((step) => (
                  <StepRow
                    key={step.id}
                    step={step}
                    canDelegate={manager || step.user?.id === user?.id}
                    onDelegate={(target) => {
                      setDelegateStep(target);
                      setDelegateTo('');
                      setDelegateReason('');
                    }}
                  />
                ))}
              </ol>
            )}
            {flow.changeSummary && (
              <div className="rounded-md border bg-muted/20 px-3 py-2">
                <p className="text-xs font-medium text-muted-foreground">O que mudou nesta revisão</p>
                <p className="whitespace-pre-wrap text-sm">{flow.changeSummary}</p>
              </div>
            )}
            <div className="flex flex-wrap gap-2 pt-1">
              {caps.canSubmit && (
                <Button size="sm" onClick={() => setSubmitOpen(true)} disabled={conflicts.length > 0 || approverIds.length === 0}>
                  <Send className="mr-1.5 h-4 w-4" /> Enviar para {reviewerIds.length ? 'revisão' : 'aprovação'}
                </Button>
              )}
              {caps.canPublish && doc.status === 'APPROVED' && (
                <Button size="sm" onClick={publish}>
                  <ShieldCheck className="mr-1.5 h-4 w-4" /> Publicar
                </Button>
              )}
              {doc.status === 'SCHEDULED_PUBLICATION' && caps.canPublish && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setReason({ title: 'Cancelar agendamento', label: 'Motivo', required: false, confirmLabel: 'Cancelar agendamento', onConfirm: (text) => unschedule.mutate(text) })}
                >
                  <Undo2 className="mr-1.5 h-4 w-4" /> Cancelar agendamento
                </Button>
              )}
              {flow.inFlow && (caps.canConfigure || manager) && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    setReason({
                      title: 'Retirar do fluxo',
                      description: 'As etapas pendentes são canceladas e o documento volta para elaboração.',
                      label: 'Motivo',
                      confirmLabel: 'Retirar do fluxo',
                      destructive: true,
                      onConfirm: (text) => cancelFlow.mutate(text),
                    })
                  }
                >
                  <Undo2 className="mr-1.5 h-4 w-4" /> Retirar do fluxo
                </Button>
              )}
            </div>
            {caps.canSubmit && approverIds.length === 0 && <p className="text-xs text-status-yellow">Defina pelo menos um aprovador para poder enviar.</p>}
          </CardContent>
        </Card>
      </div>

      <Card className="h-fit">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base"><UserRound className="h-4 w-4" />Participantes</CardTitle>
          <CardDescription>Quem elabora não revisa nem aprova o próprio documento.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Field label="Revisores (opcional)">
            <MultiSelect options={userOptions(options?.users, [author, ...approverIds])} value={reviewerIds} onChange={setReviewerIds} disabled={!editableParticipants} />
          </Field>
          <Field label="Aprovadores">
            <MultiSelect options={userOptions(options?.users, [author, ...reviewerIds])} value={approverIds} onChange={setApproverIds} disabled={!editableParticipants} />
          </Field>
          <Field label="Ordem">
            <NativeSelect value={mode} disabled={!editableParticipants} onChange={(event) => setMode(event.target.value as typeof mode)}>
              <option value="SEQUENTIAL">Em sequência</option>
              <option value="PARALLEL">Ao mesmo tempo</option>
            </NativeSelect>
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Dias p/ revisar"><Input type="number" min={1} max={60} value={reviewDays} disabled={!editableParticipants} onChange={(event) => setReviewDays(event.target.value)} /></Field>
            <Field label="Dias p/ aprovar"><Input type="number" min={1} max={60} value={approvalDays} disabled={!editableParticipants} onChange={(event) => setApprovalDays(event.target.value)} /></Field>
          </div>
          {conflicts.map((message) => (
            <p key={message} className="rounded-md bg-status-red/5 px-2 py-1 text-xs text-status-red">{message}</p>
          ))}
          {editableParticipants && (
            <Button size="sm" variant="outline" className="w-full" disabled={!dirty || conflicts.length > 0 || saveParticipants.isPending} onClick={() => saveParticipants.mutate()}>
              {saveParticipants.isPending ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Save className="mr-1.5 h-4 w-4" />}
              Salvar participantes
            </Button>
          )}
          {!editableParticipants && flow.inFlow && <p className="text-xs text-muted-foreground">Para mudar os participantes, retire o documento do fluxo.</p>}
        </CardContent>
      </Card>

      <Dialog open={submitOpen} onOpenChange={(open) => !submit.isPending && setSubmitOpen(open)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Enviar para {reviewerIds.length ? 'revisão' : 'aprovação'}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            O conteúdo atual é congelado para análise. {reviewerIds.length ? `${reviewerIds.length} revisor(es)` : 'Os aprovadores'} recebem a tarefa no Meu Dia.
          </p>
          <Field label={doc.version > 1 || doc.versions.length > 1 ? 'O que mudou nesta revisão (obrigatório)' : 'Resumo (opcional)'}>
            <Textarea rows={4} value={changeSummary} onChange={(event) => setChangeSummary(event.target.value)} placeholder="Ex.: Inclusão da etapa de inspeção visual e atualização dos responsáveis." />
          </Field>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSubmitOpen(false)} disabled={submit.isPending}>Cancelar</Button>
            <Button onClick={() => submit.mutate()} disabled={submit.isPending}>
              {submit.isPending ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Send className="mr-1.5 h-4 w-4" />}
              Enviar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(delegateStep)} onOpenChange={(open) => !open && setDelegateStep(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Delegar etapa de {delegateStep?.user?.name ?? ''}</DialogTitle>
          </DialogHeader>
          <Field label="Quem vai assumir">
            <NativeSelect value={delegateTo} onChange={(event) => setDelegateTo(event.target.value)}>
              <option value="">Escolha a pessoa</option>
              {(options?.users ?? [])
                .filter((person) => person.id !== author && person.id !== delegateStep?.user?.id)
                .map((person) => (
                  <option key={person.id} value={person.id}>{person.name}</option>
                ))}
            </NativeSelect>
          </Field>
          <Field label="Motivo">
            <Textarea rows={3} value={delegateReason} onChange={(event) => setDelegateReason(event.target.value)} placeholder="Ex.: férias, afastamento." />
          </Field>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDelegateStep(null)}>Cancelar</Button>
            <Button disabled={!delegateTo || !delegateReason.trim() || delegate.isPending} onClick={() => delegate.mutate()}>
              <Forward className="mr-1.5 h-4 w-4" /> Delegar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <SignatureDialog request={signature} onClose={() => setSignature(null)} />
      <ReasonDialog state={reason} onClose={() => setReason(null)} />
    </div>
  );
}
