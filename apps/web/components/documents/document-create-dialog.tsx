'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ArrowLeft, ArrowRight, FilePlus2, FileText, FileType2, Loader2, Sparkles, Upload, Workflow } from 'lucide-react';
import { markdownToDoc, type DocNode } from '@g360/shared';
import { api } from '@/lib/api';
import { useAuth } from '@/components/auth/auth-provider';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { uploadDocumentFile } from './files';
import { StructuredViewer } from './structured-editor';
import { CONFIDENTIALITY_HINT, CONFIDENTIALITY_LABEL, type Confidentiality, type ContentFormat, type DocDetail, type DocOptions } from './types';
import { Field, MultiSelect, errorMessage, groupOptions, invalidateDocuments, nodeOptions, useDocOptions, userOptions } from './ui';

type Source = 'TEMPLATE' | 'AI' | 'BLANK';

interface Draft {
  typeConfigId: string;
  format: Exclude<ContentFormat, 'TEXT'>;
  source: Source;
  templateId: string;
  processId: string;
  title: string;
  description: string;
  orgNodeId: string;
  ownerUserId: string;
  confidentiality: Confidentiality;
  validUntil: string;
  reviewIntervalMonths: string;
  indicatorId: string;
  code: string;
  reviewerIds: string[];
  approverIds: string[];
  workflowMode: 'SEQUENTIAL' | 'PARALLEL';
  readRequired: boolean;
  readDueDays: string;
  readUserIds: string[];
  readOrgNodeIds: string[];
  readGroupIds: string[];
  accessUserIds: string[];
  accessOrgNodeIds: string[];
  accessGroupIds: string[];
}

const STEPS = ['Tipo e formato', 'Conteúdo inicial', 'Dados do documento', 'Fluxo e leitura'] as const;

const FORMATS: Array<{ value: Draft['format']; title: string; description: string; icon: typeof FileText }> = [
  { value: 'STRUCTURED', title: 'Editor visual', description: 'Escreva direto no sistema, com títulos, tabelas e fotos. Gera o PDF oficial automaticamente. Recomendado.', icon: FileText },
  { value: 'DOCX', title: 'Arquivo Word', description: 'Para quem precisa do layout do Word. Edita no navegador (Collabora) ou no Word instalado.', icon: FileType2 },
  { value: 'FILE', title: 'PDF pronto', description: 'Documento já finalizado em PDF (externo ou legado). Só passa pelo fluxo de aprovação.', icon: Upload },
];

function initialDraft(options: DocOptions | undefined, userId: string | undefined): Draft {
  const firstType = options?.typeConfigs.find((type) => type.active) ?? options?.typeConfigs[0];
  const me = options?.users.find((user) => user.id === userId);
  return {
    typeConfigId: firstType?.id ?? '',
    format: 'STRUCTURED',
    source: 'TEMPLATE',
    templateId: '',
    processId: '',
    title: '',
    description: '',
    orgNodeId: me?.defaultNodeId ?? '',
    ownerUserId: userId ?? '',
    confidentiality: 'INTERNAL',
    validUntil: '',
    reviewIntervalMonths: '',
    indicatorId: '',
    code: '',
    reviewerIds: [],
    approverIds: [],
    workflowMode: firstType?.approvalFlow?.mode ?? 'SEQUENTIAL',
    readRequired: false,
    readDueDays: '7',
    readUserIds: [],
    readOrgNodeIds: [],
    readGroupIds: [],
    accessUserIds: [],
    accessOrgNodeIds: [],
    accessGroupIds: [],
  };
}

export function DocumentCreateDialog({ open, onOpenChange, presetProcessId }: { open: boolean; onOpenChange: (open: boolean) => void; presetProcessId?: string | null }) {
  const router = useRouter();
  const qc = useQueryClient();
  const { user } = useAuth();
  const optionsQuery = useDocOptions(open);
  const options = optionsQuery.data;
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<Draft>(() => initialDraft(undefined, user?.id));
  const [aiDraft, setAiDraft] = useState<{ doc: DocNode; usedAi: boolean; processName: string } | null>(null);
  const [pdfFile, setPdfFile] = useState<File | null>(null);

  // Reinicia o assistente só ao abrir (uma atualização das opções em segundo
  // plano não pode apagar o que a pessoa já preencheu).
  const initialized = useRef(false);
  useEffect(() => {
    if (!open) {
      initialized.current = false;
      return;
    }
    if (!options || initialized.current) return;
    initialized.current = true;
    setStep(0);
    setAiDraft(null);
    setPdfFile(null);
    setDraft({ ...initialDraft(options, user?.id), ...(presetProcessId ? { source: 'AI' as Source, processId: presetProcessId } : {}) });
  }, [open, options, user?.id, presetProcessId]);

  const patch = (next: Partial<Draft>) => setDraft((current) => ({ ...current, ...next }));
  const type = options?.typeConfigs.find((item) => item.id === draft.typeConfigId) ?? null;
  const sigla = type?.sigla?.toUpperCase() ?? '';
  const templates = useMemo(
    () => (options?.templates ?? []).filter((template) => template.active && (!template.typeConfigId || template.typeConfigId === draft.typeConfigId)),
    [options?.templates, draft.typeConfigId],
  );
  const aiKind = sigla === 'IT' ? 'IT' : 'POP';
  const author = draft.ownerUserId || user?.id || '';

  const generate = useMutation({
    mutationFn: () => api<{ markdown: string; usedAi: boolean; process: { id: string; name: string; code: string | null } }>('/documents/ai/draft-from-process', { method: 'POST', json: { processId: draft.processId, sigla: aiKind } }),
    onSuccess: (result) => {
      setAiDraft({ doc: markdownToDoc(result.markdown), usedAi: result.usedAi, processName: result.process.name });
      if (!draft.title.trim()) patch({ title: `${aiKind === 'IT' ? 'Instrução de trabalho' : 'Procedimento operacional'} — ${result.process.name}` });
      toast.success(result.usedAi ? 'Rascunho gerado e revisado pela IA.' : 'Rascunho montado a partir do mapeamento do processo.');
    },
    onError: (error) => toast.error(errorMessage(error, 'Não foi possível gerar o rascunho.')),
  });

  const create = useMutation({
    mutationFn: async () => {
      const restricted = draft.confidentiality !== 'INTERNAL';
      // Rascunho da IA: nasce no editor visual; se a pessoa escolheu Word, o
      // sistema converte em seguida para um .docx real com o mesmo conteúdo.
      const fromAi = Boolean(draft.source === 'AI' && aiDraft && draft.format !== 'FILE');
      const payload: Record<string, unknown> = {
        title: draft.title.trim(),
        description: draft.description.trim() || null,
        typeConfigId: draft.typeConfigId || null,
        type: type?.category,
        contentFormat: fromAi ? 'STRUCTURED' : draft.format,
        templateId: draft.source === 'TEMPLATE' && draft.templateId ? draft.templateId : null,
        contentJson: fromAi && aiDraft ? aiDraft.doc : undefined,
        content: draft.source === 'BLANK' && draft.format !== 'STRUCTURED' ? draft.title.trim() : undefined,
        orgNodeId: draft.orgNodeId || null,
        ownerUserId: draft.ownerUserId || null,
        confidentiality: draft.confidentiality,
        validUntil: draft.validUntil || null,
        reviewIntervalMonths: draft.reviewIntervalMonths ? Number(draft.reviewIntervalMonths) : null,
        indicatorId: draft.indicatorId || null,
        code: draft.code.trim() || null,
        reviewerIds: draft.reviewerIds,
        approverIds: draft.approverIds,
        workflowMode: draft.workflowMode,
        distribution: {
          readRequired: draft.readRequired,
          readDueDays: Number(draft.readDueDays) || 7,
          userIds: draft.readUserIds,
          orgNodeIds: draft.readOrgNodeIds,
          groupIds: draft.readGroupIds,
        },
        access: restricted ? { userIds: draft.accessUserIds, orgNodeIds: draft.accessOrgNodeIds, groupIds: draft.accessGroupIds } : null,
      };
      if (draft.source === 'BLANK' && draft.format === 'STRUCTURED') {
        payload.contentJson = { type: 'doc', content: [{ type: 'paragraph' }] };
      }
      const created = await api<DocDetail>('/documents', { method: 'POST', json: payload });
      if (fromAi && draft.format === 'DOCX') {
        try {
          await api(`/documents/${created.id}/content/format`, { method: 'POST', json: { format: 'DOCX' } });
        } catch (error) {
          toast.error(`Documento criado no editor visual; a conversão para Word falhou: ${errorMessage(error)}`);
        }
      }
      if (draft.format === 'FILE' && pdfFile) {
        try {
          await uploadDocumentFile(`/documents/${created.id}/files/upload`, pdfFile, { purpose: 'MAIN_PDF' });
        } catch (error) {
          toast.error(`Documento criado, mas o PDF não foi enviado: ${errorMessage(error)}`);
        }
      }
      return created;
    },
    onSuccess: (created) => {
      toast.success(`Documento ${created.code ?? ''} criado.`);
      invalidateDocuments(qc);
      onOpenChange(false);
      router.push(`/documents/${created.id}?tab=conteudo`);
    },
    onError: (error) => toast.error(errorMessage(error, 'Não foi possível criar o documento.')),
  });

  const conflicts = useMemo(() => {
    const messages: string[] = [];
    if (author && (draft.reviewerIds.includes(author) || draft.approverIds.includes(author))) messages.push('Quem elabora (responsável) não pode revisar nem aprovar o próprio documento.');
    if (draft.reviewerIds.some((id) => draft.approverIds.includes(id))) messages.push('A mesma pessoa não pode ser revisora e aprovadora.');
    return messages;
  }, [author, draft.reviewerIds, draft.approverIds]);

  const canNext = (() => {
    if (step === 0) return Boolean(draft.typeConfigId);
    if (step === 1) return draft.source !== 'AI' || Boolean(aiDraft);
    if (step === 2) return draft.title.trim().length >= 3;
    return conflicts.length === 0;
  })();

  if (!open) return null;

  return (
    <Dialog open={open} onOpenChange={(next) => !create.isPending && onOpenChange(next)}>
      <DialogContent className="flex max-h-[92vh] w-[96vw] max-w-3xl flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="border-b px-5 py-4">
          <DialogTitle className="flex items-center gap-2">
            <FilePlus2 className="h-5 w-5 text-primary" />
            Novo documento
          </DialogTitle>
          <DialogDescription>
            Passo {step + 1} de {STEPS.length} · {STEPS[step]}
          </DialogDescription>
          <div className="mt-2 flex gap-1">
            {STEPS.map((label, index) => (
              <span key={label} className={cn('h-1 flex-1 rounded-full', index <= step ? 'bg-primary' : 'bg-muted')} />
            ))}
          </div>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {!options ? (
            <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Carregando opções…
            </div>
          ) : step === 0 ? (
            <div className="space-y-5">
              <div>
                <p className="mb-2 text-sm font-medium">Tipo de documento</p>
                <div className="grid gap-2 sm:grid-cols-3">
                  {options.typeConfigs.filter((item) => item.active).map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => patch({ typeConfigId: item.id, templateId: '', workflowMode: item.approvalFlow?.mode ?? draft.workflowMode })}
                      className={cn(
                        'rounded-lg border px-3 py-2.5 text-left transition-colors hover:border-primary/40',
                        draft.typeConfigId === item.id && 'border-primary bg-primary/5 ring-1 ring-primary/30',
                      )}
                    >
                      <span className="block text-xs font-semibold text-primary">{item.sigla}</span>
                      <span className="block text-sm font-medium">{item.name}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p className="mb-2 text-sm font-medium">Como o conteúdo será feito</p>
                <div className="grid gap-2 sm:grid-cols-3">
                  {FORMATS.map((format) => (
                    <button
                      key={format.value}
                      type="button"
                      onClick={() => patch({ format: format.value, source: format.value === 'FILE' ? 'BLANK' : draft.source })}
                      className={cn(
                        'flex flex-col gap-1 rounded-lg border px-3 py-3 text-left transition-colors hover:border-primary/40',
                        draft.format === format.value && 'border-primary bg-primary/5 ring-1 ring-primary/30',
                      )}
                    >
                      <format.icon className="h-5 w-5 text-primary" />
                      <span className="text-sm font-semibold">{format.title}</span>
                      <span className="text-xs text-muted-foreground">{format.description}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : step === 1 ? (
            draft.format === 'FILE' ? (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">Selecione o PDF agora ou envie depois, na aba Conteúdo do documento.</p>
                <Input type="file" accept="application/pdf,.pdf" onChange={(event) => setPdfFile(event.target.files?.[0] ?? null)} />
                {pdfFile && <p className="text-xs text-muted-foreground">Arquivo: {pdfFile.name}</p>}
              </div>
            ) : (
              <div className="space-y-4">
                <div className="grid gap-2 sm:grid-cols-3">
                  {([
                    { value: 'TEMPLATE', title: 'A partir de um modelo', description: templates.length ? `${templates.length} modelo(s) para este tipo.` : 'Usa a estrutura padrão do tipo.', icon: FileText },
                    { value: 'AI', title: 'Rascunho do processo', description: 'Monta o POP/IT com SIPOC, atividades e RACI do processo mapeado.', icon: Sparkles },
                    { value: 'BLANK', title: 'Em branco', description: 'Começa sem conteúdo.', icon: FilePlus2 },
                  ] as const).map((source) => (
                    <button
                      key={source.value}
                      type="button"
                      onClick={() => patch({ source: source.value })}
                      className={cn(
                        'flex flex-col gap-1 rounded-lg border px-3 py-3 text-left transition-colors hover:border-primary/40',
                        draft.source === source.value && 'border-primary bg-primary/5 ring-1 ring-primary/30',
                      )}
                    >
                      <source.icon className="h-5 w-5 text-primary" />
                      <span className="text-sm font-semibold">{source.title}</span>
                      <span className="text-xs text-muted-foreground">{source.description}</span>
                    </button>
                  ))}
                </div>

                {draft.source === 'TEMPLATE' && (
                  <Field label="Modelo" hint="Sem escolha, o sistema usa o modelo padrão do tipo (se houver).">
                    <NativeSelect value={draft.templateId} onChange={(event) => patch({ templateId: event.target.value })}>
                      <option value="">Modelo padrão do tipo</option>
                      {templates.map((template) => (
                        <option key={template.id} value={template.id}>
                          {template.name}
                          {template.isDefault ? ' (padrão)' : ''}
                        </option>
                      ))}
                    </NativeSelect>
                  </Field>
                )}

                {draft.source === 'AI' && (
                  <div className="space-y-3">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                      <Field label="Processo mapeado" className="flex-1">
                        <NativeSelect value={draft.processId} onChange={(event) => { patch({ processId: event.target.value }); setAiDraft(null); }}>
                          <option value="">Escolha o processo</option>
                          {options.processes.map((process) => (
                            <option key={process.id} value={process.id}>
                              {process.code ? `${process.code} · ` : ''}
                              {process.name}
                            </option>
                          ))}
                        </NativeSelect>
                      </Field>
                      <Button type="button" disabled={!draft.processId || generate.isPending} onClick={() => generate.mutate()}>
                        {generate.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                        Gerar rascunho {aiKind}
                      </Button>
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      O rascunho usa só o que está mapeado no processo. Onde faltar informação aparecem marcadores como [definir] para você completar.
                      Documentos confidenciais nunca são enviados para a IA.
                    </p>
                    {aiDraft && (
                      <div className="rounded-lg border">
                        <div className="flex items-center justify-between border-b bg-muted/30 px-3 py-2 text-xs">
                          <span className="font-medium">Prévia do rascunho · {aiDraft.processName}</span>
                          <span className="text-muted-foreground">{aiDraft.usedAi ? 'Redação revisada pela IA' : 'Montado do mapeamento'}</span>
                        </div>
                        <div className="max-h-80 overflow-y-auto px-4 py-2">
                          <StructuredViewer value={aiDraft.doc} />
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          ) : step === 2 ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Título" required className="sm:col-span-2">
                <Input value={draft.title} onChange={(event) => patch({ title: event.target.value })} placeholder="Ex.: Recebimento de matéria-prima" autoFocus />
              </Field>
              <Field label="Objetivo / resumo" className="sm:col-span-2">
                <Textarea rows={2} value={draft.description} onChange={(event) => patch({ description: event.target.value })} placeholder="Para que serve este documento (aparece na busca)." />
              </Field>
              <Field label="Área">
                <NativeSelect value={draft.orgNodeId} onChange={(event) => patch({ orgNodeId: event.target.value })}>
                  <option value="">Empresa toda</option>
                  {options.orgNodes.map((node) => (
                    <option key={node.id} value={node.id}>{node.name}</option>
                  ))}
                </NativeSelect>
              </Field>
              <Field label="Responsável (elabora)" hint="Quem elabora não pode revisar nem aprovar.">
                <NativeSelect
                  value={draft.ownerUserId}
                  onChange={(event) => patch({ ownerUserId: event.target.value, reviewerIds: draft.reviewerIds.filter((id) => id !== event.target.value), approverIds: draft.approverIds.filter((id) => id !== event.target.value) })}
                >
                  {options.users.map((person) => (
                    <option key={person.id} value={person.id}>{person.name}</option>
                  ))}
                </NativeSelect>
              </Field>
              <Field label="Classificação" hint={CONFIDENTIALITY_HINT[draft.confidentiality]}>
                <NativeSelect value={draft.confidentiality} onChange={(event) => patch({ confidentiality: event.target.value as Confidentiality })}>
                  {(Object.keys(CONFIDENTIALITY_LABEL) as Confidentiality[]).map((level) => (
                    <option key={level} value={level}>{CONFIDENTIALITY_LABEL[level]}</option>
                  ))}
                </NativeSelect>
              </Field>
              <Field label="Validade" hint={type?.defaultValidityDays ? `Sem data, vale ${type.defaultValidityDays} dias após a publicação.` : 'Opcional.'}>
                <Input type="date" value={draft.validUntil} onChange={(event) => patch({ validUntil: event.target.value })} />
              </Field>
              <Field label="Revisão periódica (meses)">
                <Input type="number" min={1} max={120} value={draft.reviewIntervalMonths} onChange={(event) => patch({ reviewIntervalMonths: event.target.value })} placeholder="Ex.: 12" />
              </Field>
              <Field label="Indicador relacionado">
                <NativeSelect value={draft.indicatorId} onChange={(event) => patch({ indicatorId: event.target.value })}>
                  <option value="">Nenhum</option>
                  {options.indicators.map((indicator) => (
                    <option key={indicator.id} value={indicator.id}>{indicator.code ? `${indicator.code} · ` : ''}{indicator.name}</option>
                  ))}
                </NativeSelect>
              </Field>
              <Field label="Código" hint={`Em branco, o sistema numera (${type?.codePattern ?? 'automático'}).`}>
                <Input value={draft.code} onChange={(event) => patch({ code: event.target.value })} placeholder="Automático" />
              </Field>
              {draft.confidentiality !== 'INTERNAL' && (
                <div className="space-y-3 rounded-lg border border-status-yellow/40 bg-status-yellow/5 p-3 sm:col-span-2">
                  <p className="text-sm font-medium">Quem pode ver este documento</p>
                  <p className="text-xs text-muted-foreground">Além do responsável, dos participantes do fluxo e dos gestores do GED.</p>
                  <Field label="Pessoas"><MultiSelect options={userOptions(options.users)} value={draft.accessUserIds} onChange={(accessUserIds) => patch({ accessUserIds })} /></Field>
                  <Field label="Áreas"><MultiSelect options={nodeOptions(options.allOrgNodes)} value={draft.accessOrgNodeIds} onChange={(accessOrgNodeIds) => patch({ accessOrgNodeIds })} /></Field>
                  {options.groups.length > 0 && (
                    <Field label="Grupos"><MultiSelect options={groupOptions(options.groups)} value={draft.accessGroupIds} onChange={(accessGroupIds) => patch({ accessGroupIds })} /></Field>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-5">
              <div className="space-y-3 rounded-lg border p-3">
                <p className="flex items-center gap-2 text-sm font-medium"><Workflow className="h-4 w-4 text-primary" />Revisão e aprovação</p>
                <Field label="Revisores" hint="Conferem o conteúdo e podem pedir ajustes. Opcional.">
                  <MultiSelect options={userOptions(options.users, [author, ...draft.approverIds])} value={draft.reviewerIds} onChange={(reviewerIds) => patch({ reviewerIds })} />
                </Field>
                <Field label="Aprovadores" hint="Aprovam ou reprovam. Pelo menos um é exigido ao enviar o documento.">
                  <MultiSelect options={userOptions(options.users, [author, ...draft.reviewerIds])} value={draft.approverIds} onChange={(approverIds) => patch({ approverIds })} />
                </Field>
                <Field label="Ordem das assinaturas">
                  <NativeSelect value={draft.workflowMode} onChange={(event) => patch({ workflowMode: event.target.value as Draft['workflowMode'] })}>
                    <option value="SEQUENTIAL">Em sequência (um depois do outro, na ordem acima)</option>
                    <option value="PARALLEL">Ao mesmo tempo (todos recebem juntos)</option>
                  </NativeSelect>
                </Field>
                {conflicts.map((message) => (
                  <p key={message} className="rounded-md bg-status-red/5 px-2 py-1 text-xs text-status-red">{message}</p>
                ))}
              </div>

              <div className="space-y-3 rounded-lg border p-3">
                <label className="flex items-start gap-2 text-sm font-medium">
                  <input type="checkbox" className="mt-0.5 h-4 w-4" checked={draft.readRequired} onChange={(event) => patch({ readRequired: event.target.checked })} />
                  <span>
                    Leitura obrigatória ao publicar
                    <span className="block text-xs font-normal text-muted-foreground">Cada pessoa recebe a tarefa no Meu Dia e confirma que leu a revisão vigente.</span>
                  </span>
                </label>
                {draft.readRequired && (
                  <>
                    <Field label="Áreas (inclui as subáreas)"><MultiSelect options={nodeOptions(options.allOrgNodes)} value={draft.readOrgNodeIds} onChange={(readOrgNodeIds) => patch({ readOrgNodeIds })} /></Field>
                    <Field label="Pessoas"><MultiSelect options={userOptions(options.users)} value={draft.readUserIds} onChange={(readUserIds) => patch({ readUserIds })} /></Field>
                    {options.groups.length > 0 && (
                      <Field label="Grupos"><MultiSelect options={groupOptions(options.groups)} value={draft.readGroupIds} onChange={(readGroupIds) => patch({ readGroupIds })} /></Field>
                    )}
                    <Field label="Prazo para ler (dias após a publicação)" className="max-w-xs">
                      <Input type="number" min={1} max={180} value={draft.readDueDays} onChange={(event) => patch({ readDueDays: event.target.value })} />
                    </Field>
                  </>
                )}
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="flex-row items-center justify-between gap-2 border-t px-5 py-3 sm:justify-between">
          <Button type="button" variant="ghost" disabled={step === 0 || create.isPending} onClick={() => setStep((current) => Math.max(0, current - 1))}>
            <ArrowLeft className="mr-1.5 h-4 w-4" /> Voltar
          </Button>
          {step < STEPS.length - 1 ? (
            <Button type="button" disabled={!canNext || !options} onClick={() => setStep((current) => current + 1)}>
              Continuar <ArrowRight className="ml-1.5 h-4 w-4" />
            </Button>
          ) : (
            <Button type="button" disabled={!canNext || create.isPending || draft.title.trim().length < 3} onClick={() => create.mutate()}>
              {create.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FilePlus2 className="mr-2 h-4 w-4" />}
              Criar documento
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
