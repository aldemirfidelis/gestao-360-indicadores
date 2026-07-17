'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ArrowLeft, ExternalLink, FileText, Megaphone, Pause, Play, Star, StopCircle, Users } from 'lucide-react';
import { PageHeader } from '@/components/shell/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { ConfirmDialog } from '@/components/platform/confirm-dialog';
import { LoadingState } from '@/components/platform/loading-state';
import { StatusBadge } from '@/components/platform/status-badge';
import { CandidateSheet, type PipelineStage } from '@/components/recruitment/candidate-sheet';
import { PipelineBoard, type BoardApplication } from '@/components/recruitment/pipeline-board';
import { NextStepCallout } from '@/components/recruitment/journey-stepper';
import { api } from '@/lib/api';
import { useAuth } from '@/components/auth/auth-provider';
import { POSTING_STATUS, QUESTION_TYPE, VISIBILITY, WORK_MODE, labelOf, metaOf } from '@/lib/recruitment/labels';

interface PostingDetail {
  id: string; slug: string; title: string; status: string; visibility: string; pcd: boolean;
  city: string | null; workMode: string | null; contractType: string | null;
  publicDescription: string | null; publicRequirements: string | null; benefitsText: string | null;
  processStepsText: string | null; showSalary: boolean; salaryText: string | null; closesAt: string | null;
  pipelineTemplateId: string | null;
  pipelineTemplate?: { name: string; stages: PipelineStage[] } | null;
}
interface Pipeline { id: string; name: string; isDefault: boolean }
interface ScreeningQuestion { id: string; order: number; type: string; question: string; required: boolean; knockout: boolean }
interface ScoreCriterion { id: string; order: number; name: string; description: string | null; category: string | null; weight: number; scaleMin: number; scaleMax: number; required: boolean }
interface AiSetting { enabled: boolean; sensitiveFiltering: boolean; modelPreference: string | null }
interface QuestionDraft { question: string; type: string; required: boolean; knockout: boolean; desiredAnswer: string; options: string; weight: number }
interface CriterionDraft { name: string; category: string; weight: number; scaleMin: number; scaleMax: number }

const EMPTY_QUESTION: QuestionDraft = { question: '', type: 'TEXT', required: false, knockout: false, desiredAnswer: '', options: '', weight: 0 };
const EMPTY_CRITERION: CriterionDraft = { name: '', category: '', weight: 1, scaleMin: 1, scaleMax: 5 };

export default function VacancyDetailPage() {
  const params = useParams<{ id: string }>();
  const postingId = params.id;
  const qc = useQueryClient();
  const { hasPermission } = useAuth();
  const canManage = hasPermission(['recruit:manage']);

  const [tab, setTab] = useState('pipeline');
  const [detailId, setDetailId] = useState<string | null>(null);
  const [form, setForm] = useState<Partial<PostingDetail> | null>(null);
  const [closeConfirm, setCloseConfirm] = useState(false);
  const [questionDraft, setQuestionDraft] = useState<QuestionDraft>({ ...EMPTY_QUESTION });
  const [criterionDraft, setCriterionDraft] = useState<CriterionDraft>({ ...EMPTY_CRITERION });

  const postingQuery = useQuery<PostingDetail>({ queryKey: ['recruit-posting', postingId], queryFn: () => api(`/recruitment/postings/${postingId}`) });
  const stagesQuery = useQuery<PipelineStage[]>({ queryKey: ['recruit-posting-stages', postingId], queryFn: () => api(`/recruitment/postings/${postingId}/stages`) });
  const applicationsQuery = useQuery<BoardApplication[]>({ queryKey: ['recruit-posting-applications', postingId], queryFn: () => api(`/recruitment/postings/${postingId}/applications`) });
  const pipelinesQuery = useQuery<Pipeline[]>({ queryKey: ['recruit-pipelines'], queryFn: () => api('/recruitment/pipelines') });
  const questionsQuery = useQuery<ScreeningQuestion[]>({ queryKey: ['recruit-screening-questions', postingId], queryFn: () => api(`/recruitment/postings/${postingId}/screening-questions`) });
  const scorecardQuery = useQuery<ScoreCriterion[]>({ queryKey: ['recruit-scorecard', postingId], queryFn: () => api(`/recruitment/postings/${postingId}/scorecard`) });
  const aiSettingsQuery = useQuery<AiSetting>({ queryKey: ['recruit-ai-settings'], queryFn: () => api('/recruitment/ai-settings') });

  const posting = postingQuery.data;
  const stages = stagesQuery.data ?? [];
  const applications = applicationsQuery.data ?? [];
  const questions = questionsQuery.data ?? [];
  const scorecard = scorecardQuery.data ?? [];
  const edit = form ?? posting ?? {};

  const invalidatePosting = () => {
    void qc.invalidateQueries({ queryKey: ['recruit-posting', postingId] });
    void qc.invalidateQueries({ queryKey: ['recruit-postings'] });
  };
  const invalidateApplications = () => void qc.invalidateQueries({ queryKey: ['recruit-posting-applications', postingId] });

  const save = useMutation({
    mutationFn: () => api(`/recruitment/postings/${postingId}`, { method: 'POST', json: form }),
    onSuccess: () => { toast.success('Vaga atualizada.'); setForm(null); invalidatePosting(); },
    onError: (error: any) => toast.error(error?.message ?? 'Não foi possível salvar.'),
  });
  const publish = useMutation({
    mutationFn: () => api(`/recruitment/postings/${postingId}/publish`, { method: 'POST' }),
    onSuccess: () => { toast.success('Vaga publicada no portal de carreiras.'); invalidatePosting(); },
    onError: (error: any) => toast.error(error?.message ?? 'Não foi possível publicar.'),
  });
  const setStatus = useMutation({
    mutationFn: (status: string) => api(`/recruitment/postings/${postingId}/status`, { method: 'POST', json: { status } }),
    onSuccess: () => { toast.success('Status da vaga atualizado.'); invalidatePosting(); },
    onError: (error: any) => toast.error(error?.message ?? 'Não foi possível atualizar.'),
  });
  const moveApplication = useMutation({
    mutationFn: ({ id, toStageId }: { id: string; toStageId: string }) => api(`/recruitment/applications/${id}/move`, { method: 'POST', json: { toStageId } }),
    onSuccess: () => { toast.success('Candidato movido.'); invalidateApplications(); },
    onError: (error: any) => toast.error(error?.message ?? 'Não foi possível mover.'),
  });
  const saveQuestion = useMutation({
    mutationFn: () => api(`/recruitment/postings/${postingId}/screening-questions`, { method: 'POST', json: questionPayload(questionDraft) }),
    onSuccess: () => { toast.success('Pergunta adicionada.'); setQuestionDraft({ ...EMPTY_QUESTION }); void qc.invalidateQueries({ queryKey: ['recruit-screening-questions', postingId] }); },
    onError: (error: any) => toast.error(error?.message ?? 'Não foi possível salvar a pergunta.'),
  });
  const deleteQuestion = useMutation({
    mutationFn: (id: string) => api(`/recruitment/screening-questions/${id}/delete`, { method: 'POST' }),
    onSuccess: () => { toast.success('Pergunta removida.'); void qc.invalidateQueries({ queryKey: ['recruit-screening-questions', postingId] }); },
    onError: (error: any) => toast.error(error?.message ?? 'Não foi possível remover.'),
  });
  const saveCriterion = useMutation({
    mutationFn: () => api(`/recruitment/postings/${postingId}/scorecard`, { method: 'POST', json: criterionDraft }),
    onSuccess: () => { toast.success('Critério adicionado.'); setCriterionDraft({ ...EMPTY_CRITERION }); void qc.invalidateQueries({ queryKey: ['recruit-scorecard', postingId] }); },
    onError: (error: any) => toast.error(error?.message ?? 'Não foi possível salvar o critério.'),
  });
  const deleteCriterion = useMutation({
    mutationFn: (id: string) => api(`/recruitment/scorecard/${id}/delete`, { method: 'POST' }),
    onSuccess: () => { toast.success('Critério removido.'); void qc.invalidateQueries({ queryKey: ['recruit-scorecard', postingId] }); },
    onError: (error: any) => toast.error(error?.message ?? 'Não foi possível remover.'),
  });
  const updateAiSettings = useMutation({
    mutationFn: (enabled: boolean) => api('/recruitment/ai-settings', { method: 'POST', json: { enabled, sensitiveFiltering: true } }),
    onSuccess: () => { toast.success('Configuração de IA atualizada.'); void qc.invalidateQueries({ queryKey: ['recruit-ai-settings'] }); },
    onError: (error: any) => toast.error(error?.message ?? 'Não foi possível atualizar a IA.'),
  });

  if (postingQuery.isLoading) return <LoadingState label="Carregando vaga..." />;
  if (!posting) return <div className="py-10 text-center text-sm text-muted-foreground">Vaga não encontrada.</div>;

  const statusMeta = metaOf(POSTING_STATUS, posting.status);
  const activeCount = applications.filter((app) => app.status === 'ACTIVE').length;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link href="/servico-pessoal/recrutamento/vagas" className="flex items-center gap-1 hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Vagas
        </Link>
      </div>

      <PageHeader
        title={posting.title}
        description={[
          labelOf(VISIBILITY, posting.visibility),
          posting.city,
          posting.workMode ? labelOf(WORK_MODE, posting.workMode) : null,
          posting.contractType,
          posting.pipelineTemplate?.name ? `pipeline: ${posting.pipelineTemplate.name}` : null,
        ].filter(Boolean).join(' · ')}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge label={statusMeta.label} tone={statusMeta.tone} />
            {posting.pcd && <Badge variant="outline" className="text-[10px]">Vaga PcD</Badge>}
            {canManage && posting.status === 'DRAFT' && (
              <Button size="sm" onClick={() => publish.mutate()} disabled={publish.isPending}>
                <Megaphone className="mr-1 h-3.5 w-3.5" /> Publicar
              </Button>
            )}
            {canManage && posting.status === 'PUBLISHED' && (
              <Button size="sm" variant="outline" onClick={() => setStatus.mutate('PAUSED')} disabled={setStatus.isPending}>
                <Pause className="mr-1 h-3.5 w-3.5" /> Pausar
              </Button>
            )}
            {canManage && posting.status === 'PAUSED' && (
              <Button size="sm" variant="outline" onClick={() => setStatus.mutate('PUBLISHED')} disabled={setStatus.isPending}>
                <Play className="mr-1 h-3.5 w-3.5" /> Reativar
              </Button>
            )}
            {canManage && ['PUBLISHED', 'PAUSED'].includes(posting.status) && (
              <Button size="sm" variant="ghost" className="text-status-red" onClick={() => setCloseConfirm(true)}>
                <StopCircle className="mr-1 h-3.5 w-3.5" /> Encerrar
              </Button>
            )}
            {posting.status === 'PUBLISHED' && (
              <a href={`/carreiras/vagas/${posting.slug}`} target="_blank" rel="noreferrer">
                <Button size="sm" variant="outline"><ExternalLink className="mr-1 h-3.5 w-3.5" /> Página pública</Button>
              </a>
            )}
          </div>
        }
      />

      <NextStepCallout
        text={nextStepFor(posting.status, activeCount)}
        tone={posting.status === 'DRAFT' ? 'yellow' : 'blue'}
      />

      <Tabs value={tab} onValueChange={setTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="pipeline" className="text-xs font-semibold">
            <Users className="mr-2 h-4 w-4" /> Pipeline de candidatos ({applications.length})
          </TabsTrigger>
          <TabsTrigger value="divulgacao" className="text-xs font-semibold">
            <FileText className="mr-2 h-4 w-4" /> Divulgação
          </TabsTrigger>
          <TabsTrigger value="triagem" className="text-xs font-semibold">
            <Star className="mr-2 h-4 w-4" /> Triagem e scorecard
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pipeline">
          {applicationsQuery.isLoading ? (
            <LoadingState label="Carregando candidatos..." />
          ) : applications.length === 0 ? (
            <Card>
              <CardContent className="py-10 text-center text-sm text-muted-foreground">
                Nenhuma candidatura ainda.
                {posting.status === 'DRAFT' && ' Publique a vaga para começar a receber candidatos.'}
                {posting.status === 'PUBLISHED' && ' A vaga está no ar — compartilhe o link da página pública.'}
              </CardContent>
            </Card>
          ) : (
            <PipelineBoard
              stages={stages}
              applications={applications}
              canManage={canManage}
              onOpen={(id) => setDetailId(id)}
              onMove={(id, toStageId) => moveApplication.mutate({ id, toStageId })}
            />
          )}
          <p className="mt-2 text-[11px] text-muted-foreground">
            Arraste o cartão para mudar o candidato de etapa, ou clique para abrir o painel completo (avaliação, entrevistas, proposta, pré-admissão e admissão).
          </p>
        </TabsContent>

        <TabsContent value="divulgacao">
          <Card>
            <CardContent className="space-y-3 p-4">
              <p className="text-xs text-muted-foreground">
                Este é o texto exibido no portal público de carreiras. A descrição técnica original da requisição fica protegida — salário interno, orçamento e aprovadores nunca aparecem.
              </p>
              <div>
                <Label className="text-xs">Título público</Label>
                <Input value={edit.title ?? ''} disabled={!canManage} onChange={(event) => setForm((f) => ({ ...(f ?? posting), title: event.target.value }))} />
              </div>
              <div>
                <Label className="text-xs">Descrição pública</Label>
                <Textarea rows={4} value={edit.publicDescription ?? ''} disabled={!canManage} onChange={(event) => setForm((f) => ({ ...(f ?? posting), publicDescription: event.target.value }))} />
              </div>
              <div>
                <Label className="text-xs">Requisitos</Label>
                <Textarea rows={3} value={edit.publicRequirements ?? ''} disabled={!canManage} onChange={(event) => setForm((f) => ({ ...(f ?? posting), publicRequirements: event.target.value }))} />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label className="text-xs">Benefícios</Label>
                  <Textarea rows={2} value={edit.benefitsText ?? ''} disabled={!canManage} onChange={(event) => setForm((f) => ({ ...(f ?? posting), benefitsText: event.target.value }))} />
                </div>
                <div>
                  <Label className="text-xs">Etapas do processo (visível ao candidato)</Label>
                  <Textarea rows={2} value={edit.processStepsText ?? ''} disabled={!canManage} onChange={(event) => setForm((f) => ({ ...(f ?? posting), processStepsText: event.target.value }))} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <div>
                  <Label className="text-xs">Cidade</Label>
                  <Input value={edit.city ?? ''} disabled={!canManage} onChange={(event) => setForm((f) => ({ ...(f ?? posting), city: event.target.value }))} />
                </div>
                <div>
                  <Label className="text-xs">Modalidade</Label>
                  <NativeSelect value={edit.workMode ?? ''} disabled={!canManage} onChange={(event) => setForm((f) => ({ ...(f ?? posting), workMode: event.target.value }))}>
                    <option value="">—</option>
                    {Object.entries(WORK_MODE).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                  </NativeSelect>
                </div>
                <div>
                  <Label className="text-xs">Visibilidade</Label>
                  <NativeSelect value={edit.visibility ?? 'PUBLIC'} disabled={!canManage} onChange={(event) => setForm((f) => ({ ...(f ?? posting), visibility: event.target.value }))}>
                    {Object.entries(VISIBILITY).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                  </NativeSelect>
                </div>
                <div>
                  <Label className="text-xs">Pipeline de etapas</Label>
                  <NativeSelect value={edit.pipelineTemplateId ?? ''} disabled={!canManage} onChange={(event) => setForm((f) => ({ ...(f ?? posting), pipelineTemplateId: event.target.value }))}>
                    {(pipelinesQuery.data ?? []).map((pipeline) => <option key={pipeline.id} value={pipeline.id}>{pipeline.name}</option>)}
                  </NativeSelect>
                </div>
                <div>
                  <Label className="text-xs">Encerra em</Label>
                  <Input type="date" value={edit.closesAt ? String(edit.closesAt).slice(0, 10) : ''} disabled={!canManage} onChange={(event) => setForm((f) => ({ ...(f ?? posting), closesAt: event.target.value }))} />
                </div>
                <div className="flex items-end gap-4 pb-2">
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={edit.pcd ?? false} disabled={!canManage} onChange={(event) => setForm((f) => ({ ...(f ?? posting), pcd: event.target.checked }))} /> Vaga PcD
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={edit.showSalary ?? false} disabled={!canManage} onChange={(event) => setForm((f) => ({ ...(f ?? posting), showSalary: event.target.checked }))} /> Exibir faixa salarial
                  </label>
                </div>
                {edit.showSalary && (
                  <div className="col-span-2">
                    <Label className="text-xs">Texto da faixa salarial</Label>
                    <Input placeholder="Ex.: R$ 4.000 a R$ 5.000" value={edit.salaryText ?? ''} disabled={!canManage} onChange={(event) => setForm((f) => ({ ...(f ?? posting), salaryText: event.target.value }))} />
                  </div>
                )}
              </div>
              {canManage && (
                <div className="flex justify-end gap-2 border-t pt-3">
                  <Button variant="ghost" onClick={() => setForm(null)} disabled={!form}>Descartar alterações</Button>
                  <Button onClick={() => save.mutate()} disabled={!form || save.isPending}>Salvar</Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="triagem" className="space-y-4">
          <Card>
            <CardContent className="space-y-3 p-4">
              <div>
                <h3 className="text-sm font-semibold">Perguntas de triagem</h3>
                <p className="text-xs text-muted-foreground">
                  Respondidas pelo candidato no ato da candidatura. Perguntas eliminatórias sinalizam quem não atende — a decisão final é sempre sua.
                </p>
              </div>
              {canManage && (
                <div className="rounded-md border p-3">
                  <div className="grid gap-2 md:grid-cols-[1fr_150px]">
                    <Input placeholder="Pergunta ao candidato" value={questionDraft.question} onChange={(event) => setQuestionDraft((f) => ({ ...f, question: event.target.value }))} />
                    <NativeSelect value={questionDraft.type} onChange={(event) => setQuestionDraft((f) => ({ ...f, type: event.target.value }))}>
                      {Object.entries(QUESTION_TYPE).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                    </NativeSelect>
                  </div>
                  <div className="mt-2 grid gap-2 md:grid-cols-[1fr_1fr_110px_auto]">
                    <Input placeholder="Resposta esperada (opcional)" value={questionDraft.desiredAnswer} onChange={(event) => setQuestionDraft((f) => ({ ...f, desiredAnswer: event.target.value }))} />
                    <Input placeholder="Opções separadas por ; (para escolha)" value={questionDraft.options} onChange={(event) => setQuestionDraft((f) => ({ ...f, options: event.target.value }))} />
                    <div className="flex items-center gap-1">
                      <Label className="text-[10px] text-muted-foreground">Peso</Label>
                      <Input type="number" value={questionDraft.weight} onChange={(event) => setQuestionDraft((f) => ({ ...f, weight: Number(event.target.value) }))} />
                    </div>
                    <Button size="sm" onClick={() => saveQuestion.mutate()} disabled={!questionDraft.question || saveQuestion.isPending}>Adicionar</Button>
                  </div>
                  <div className="mt-2 flex gap-4 text-xs">
                    <label className="flex items-center gap-1">
                      <input type="checkbox" checked={questionDraft.required} onChange={(event) => setQuestionDraft((f) => ({ ...f, required: event.target.checked }))} /> Obrigatória
                    </label>
                    <label className="flex items-center gap-1">
                      <input type="checkbox" checked={questionDraft.knockout} onChange={(event) => setQuestionDraft((f) => ({ ...f, knockout: event.target.checked }))} /> Eliminatória (sinaliza)
                    </label>
                  </div>
                </div>
              )}
              <div className="divide-y rounded-md border">
                {questions.length === 0 && <div className="p-3 text-xs text-muted-foreground">Nenhuma pergunta configurada — a candidatura só pede currículo e mensagem.</div>}
                {questions.map((question) => (
                  <div key={question.id} className="flex items-center gap-2 p-2 text-xs">
                    <div className="min-w-0 flex-1">
                      <span className="font-medium">{question.order}. {question.question}</span>
                      <span className="ml-2 text-[10px] text-muted-foreground">{labelOf(QUESTION_TYPE, question.type)}</span>
                      {question.required && <Badge variant="outline" className="ml-1 text-[8px]">obrigatória</Badge>}
                      {question.knockout && <Badge variant="outline" className="ml-1 text-[8px] text-status-yellow">eliminatória</Badge>}
                    </div>
                    {canManage && <Button variant="ghost" size="sm" onClick={() => deleteQuestion.mutate(question.id)}>Remover</Button>}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-3 p-4">
              <div>
                <h3 className="text-sm font-semibold">Scorecard de avaliação</h3>
                <p className="text-xs text-muted-foreground">
                  Critérios com peso e escala usados por todos os avaliadores — garante comparação justa entre candidatos (avaliação cega até cada um enviar a sua).
                </p>
              </div>
              {canManage && (
                <div className="grid gap-2 rounded-md border p-3 md:grid-cols-[1fr_140px_90px_90px_90px_auto]">
                  <Input placeholder="Critério (ex.: Comunicação)" value={criterionDraft.name} onChange={(event) => setCriterionDraft((f) => ({ ...f, name: event.target.value }))} />
                  <Input placeholder="Categoria" value={criterionDraft.category} onChange={(event) => setCriterionDraft((f) => ({ ...f, category: event.target.value }))} />
                  <div className="flex items-center gap-1">
                    <Label className="text-[10px] text-muted-foreground">Peso</Label>
                    <Input type="number" value={criterionDraft.weight} onChange={(event) => setCriterionDraft((f) => ({ ...f, weight: Number(event.target.value) }))} />
                  </div>
                  <div className="flex items-center gap-1">
                    <Label className="text-[10px] text-muted-foreground">Mín.</Label>
                    <Input type="number" value={criterionDraft.scaleMin} onChange={(event) => setCriterionDraft((f) => ({ ...f, scaleMin: Number(event.target.value) }))} />
                  </div>
                  <div className="flex items-center gap-1">
                    <Label className="text-[10px] text-muted-foreground">Máx.</Label>
                    <Input type="number" value={criterionDraft.scaleMax} onChange={(event) => setCriterionDraft((f) => ({ ...f, scaleMax: Number(event.target.value) }))} />
                  </div>
                  <Button size="sm" onClick={() => saveCriterion.mutate()} disabled={!criterionDraft.name || saveCriterion.isPending}>Adicionar</Button>
                </div>
              )}
              <div className="divide-y rounded-md border">
                {scorecard.length === 0 && <div className="p-3 text-xs text-muted-foreground">Nenhum critério configurado — sem scorecard não há avaliação estruturada no painel do candidato.</div>}
                {scorecard.map((criterion) => (
                  <div key={criterion.id} className="flex items-center gap-2 p-2 text-xs">
                    <div className="min-w-0 flex-1 truncate">
                      <span className="font-medium">{criterion.order}. {criterion.name}</span>
                      <span className="ml-2 text-[10px] text-muted-foreground">
                        {criterion.category ? `${criterion.category} · ` : ''}peso {criterion.weight} · escala {criterion.scaleMin}-{criterion.scaleMax}
                      </span>
                    </div>
                    {canManage && <Button variant="ghost" size="sm" onClick={() => deleteCriterion.mutate(criterion.id)}>Remover</Button>}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="flex flex-wrap items-center gap-3 p-4">
              <div className="mr-auto">
                <h3 className="text-sm font-semibold">Triagem assistida por IA</h3>
                <p className="text-xs text-muted-foreground">
                  Quando ativa, o painel do candidato ganha o botão “Gerar análise”: a IA compara currículo e requisitos com evidências. Ela nunca aprova nem rejeita — a decisão é sempre humana.
                </p>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={aiSettingsQuery.data?.enabled ?? false}
                  disabled={!canManage || updateAiSettings.isPending}
                  onChange={(event) => updateAiSettings.mutate(event.target.checked)}
                />
                IA ativa para a empresa
              </label>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <CandidateSheet
        applicationId={detailId}
        stages={stages}
        scorecard={scorecard}
        onClose={() => setDetailId(null)}
        onChanged={invalidateApplications}
      />

      <ConfirmDialog
        open={closeConfirm}
        onOpenChange={setCloseConfirm}
        title="Encerrar vaga"
        description="A vaga sai do portal de carreiras e deixa de receber candidaturas. Os candidatos em processo continuam acessíveis."
        confirmLabel="Encerrar vaga"
        destructive
        onConfirm={() => setStatus.mutate('CLOSED')}
      />
    </div>
  );
}

function nextStepFor(status: string, activeCount: number): string {
  if (status === 'DRAFT') return 'revise o texto na aba Divulgação, configure triagem/scorecard e clique em Publicar.';
  if (status === 'PUBLISHED' && activeCount === 0) return 'a vaga está no ar — divulgue o link público e aguarde as primeiras candidaturas.';
  if (status === 'PUBLISHED') return 'acompanhe os candidatos no pipeline; clique no cartão para avaliar, entrevistar e avançar até a admissão.';
  if (status === 'PAUSED') return 'vaga pausada — não recebe novas candidaturas até ser reativada.';
  return 'vaga encerrada — consulte o histórico dos candidatos no pipeline.';
}

function questionPayload(draft: QuestionDraft) {
  const desiredRaw = draft.desiredAnswer.trim();
  const options = splitList(draft.options);
  let desiredAnswer: unknown = desiredRaw || undefined;
  if (desiredRaw && draft.type === 'YES_NO') desiredAnswer = ['sim', 's', 'true', '1', 'yes'].includes(desiredRaw.toLowerCase());
  if (desiredRaw && draft.type === 'NUMBER') {
    const parsed = Number(desiredRaw.replace(',', '.'));
    desiredAnswer = Number.isFinite(parsed) ? parsed : desiredRaw;
  }
  if (desiredRaw && draft.type === 'MULTI_CHOICE') desiredAnswer = splitList(desiredRaw);
  return {
    question: draft.question,
    type: draft.type,
    required: draft.required,
    knockout: draft.knockout,
    desiredAnswer,
    options: options.length ? options : undefined,
    weight: Number.isFinite(Number(draft.weight)) ? Number(draft.weight) : 0,
  };
}

function splitList(value: string) {
  return value.split(';').map((item) => item.trim()).filter(Boolean);
}
