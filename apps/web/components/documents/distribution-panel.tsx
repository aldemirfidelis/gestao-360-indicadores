'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { BookOpenCheck, CheckCircle2, Clock, Loader2, Save, Users } from 'lucide-react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { formatDateTime, isPublishedLike, type DocDetail, type DocOptions } from './types';
import { Field, MultiSelect, errorMessage, groupOptions, invalidateDocuments, nodeOptions, userOptions } from './ui';

export function DistributionPanel({ doc, options }: { doc: DocDetail; options: DocOptions | undefined }) {
  const qc = useQueryClient();
  const dist = doc.distribution;
  const [readRequired, setReadRequired] = useState(dist.readRequired);
  const [readDueDays, setReadDueDays] = useState(String(dist.readDueDays || 7));
  const [userIds, setUserIds] = useState<string[]>([]);
  const [orgNodeIds, setOrgNodeIds] = useState<string[]>([]);
  const [groupIds, setGroupIds] = useState<string[]>([]);

  useEffect(() => {
    setReadRequired(dist.readRequired);
    setReadDueDays(String(dist.readDueDays || 7));
    setUserIds(dist.targets.users.map((item) => item.id));
    setOrgNodeIds(dist.targets.orgNodes.map((item) => item.id));
    setGroupIds(dist.targets.groups.map((item) => item.id));
  }, [dist.readRequired, dist.readDueDays, dist.targets]);

  const save = useMutation({
    mutationFn: () => api(`/documents/${doc.id}/distribution`, { method: 'PUT', json: { readRequired, readDueDays: Number(readDueDays) || 7, userIds, orgNodeIds, groupIds } }),
    onSuccess: () => {
      toast.success(isPublishedLike(doc.status) && readRequired ? 'Distribuição salva e leituras atribuídas.' : 'Distribuição salva.');
      invalidateDocuments(qc);
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const confirm = useMutation({
    mutationFn: () => api(`/documents/${doc.id}/read`, { method: 'POST', json: {} }),
    onSuccess: () => {
      toast.success('Leitura confirmada.');
      invalidateDocuments(qc);
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const canEdit = doc.capabilities.canConfigure;
  const mine = dist.mine;

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
      <div className="space-y-4">
        {mine && mine.status === 'PENDING' && (
          <Card className="border-status-blue/40 bg-status-blue/5">
            <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
              <BookOpenCheck className="h-6 w-6 shrink-0 text-status-blue" />
              <div className="flex-1">
                <p className="text-sm font-semibold">Você precisa ler a {dist.versionLabel ?? 'revisão vigente'}</p>
                <p className="text-xs text-muted-foreground">{mine.dueAt ? `Prazo: ${formatDateTime(mine.dueAt)}` : 'Sem prazo definido.'}</p>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" asChild>
                  <Link href={`/documents/${doc.id}/leitor`}>Abrir modo leitura</Link>
                </Button>
                <Button size="sm" disabled={confirm.isPending} onClick={() => confirm.mutate()}>
                  <CheckCircle2 className="mr-1.5 h-4 w-4" /> Li e entendi
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Adesão à leitura {dist.versionLabel ? `· ${dist.versionLabel}` : ''}</CardTitle>
            <CardDescription>
              {dist.readRequired ? 'Cada pessoa do público confirma a leitura da revisão vigente.' : 'Leitura obrigatória desligada para este documento.'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {dist.total > 0 ? (
              <>
                <div className="flex items-end justify-between gap-3">
                  <div>
                    <p className="text-3xl font-semibold tabular-nums">{dist.adhesion ?? 0}%</p>
                    <p className="text-xs text-muted-foreground">{dist.confirmed} de {dist.total} confirmaram</p>
                  </div>
                  <div className="text-right text-xs text-muted-foreground">
                    <p>{dist.pending} pendente(s)</p>
                    {dist.overdue > 0 && <p className="font-medium text-status-red">{dist.overdue} atrasada(s)</p>}
                  </div>
                </div>
                <Progress value={dist.adhesion ?? 0} />
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground"><Clock className="h-3.5 w-3.5" />Pendentes</p>
                    <ul className="max-h-72 space-y-1 overflow-y-auto">
                      {dist.pendingUsers.length === 0 && <li className="text-xs text-muted-foreground">Ninguém pendente.</li>}
                      {dist.pendingUsers.map((person) => (
                        <li key={person.id} className="flex items-center justify-between gap-2 rounded px-2 py-1 text-sm hover:bg-muted/40">
                          <span className="truncate">{person.name}</span>
                          <span className={person.overdue ? 'text-xs font-medium text-status-red' : 'text-xs text-muted-foreground'}>
                            {person.dueAt ? formatDateTime(person.dueAt) : '—'}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground"><CheckCircle2 className="h-3.5 w-3.5" />Confirmaram</p>
                    <ul className="max-h-72 space-y-1 overflow-y-auto">
                      {dist.confirmedUsers.length === 0 && <li className="text-xs text-muted-foreground">Nenhuma confirmação ainda.</li>}
                      {dist.confirmedUsers.map((person) => (
                        <li key={person.id} className="flex items-center justify-between gap-2 rounded px-2 py-1 text-sm hover:bg-muted/40">
                          <span className="truncate">{person.name}</span>
                          <span className="text-xs text-muted-foreground">{formatDateTime(person.confirmedAt)}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                {isPublishedLike(doc.status)
                  ? 'Nenhuma leitura atribuída para a revisão vigente.'
                  : 'As leituras são atribuídas automaticamente quando o documento for publicado.'}
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="h-fit">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base"><Users className="h-4 w-4" />Público da leitura</CardTitle>
          <CardDescription>Áreas incluem as subáreas. Novas pessoas da área recebem a leitura na próxima sincronização diária.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" className="mt-0.5 h-4 w-4" checked={readRequired} disabled={!canEdit} onChange={(event) => setReadRequired(event.target.checked)} />
            <span>Leitura obrigatória</span>
          </label>
          <Field label="Áreas"><MultiSelect options={nodeOptions(options?.allOrgNodes)} value={orgNodeIds} onChange={setOrgNodeIds} disabled={!canEdit} /></Field>
          <Field label="Pessoas"><MultiSelect options={userOptions(options?.users)} value={userIds} onChange={setUserIds} disabled={!canEdit} /></Field>
          {(options?.groups.length ?? 0) > 0 && (
            <Field label="Grupos"><MultiSelect options={groupOptions(options?.groups)} value={groupIds} onChange={setGroupIds} disabled={!canEdit} /></Field>
          )}
          <Field label="Prazo (dias após publicar ou atribuir)">
            <Input type="number" min={1} max={180} value={readDueDays} disabled={!canEdit} onChange={(event) => setReadDueDays(event.target.value)} />
          </Field>
          {canEdit && (
            <Button size="sm" className="w-full" disabled={save.isPending} onClick={() => save.mutate()}>
              {save.isPending ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Save className="mr-1.5 h-4 w-4" />}
              Salvar distribuição
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
