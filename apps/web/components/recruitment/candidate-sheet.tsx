'use client';

import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Bot,
  CalendarClock,
  ClipboardList,
  Download,
  FileText,
  HeartPulse,
  MessageSquare,
  Send,
  Star,
  UserCheck,
  UserPlus,
  XCircle,
} from 'lucide-react';
import { Sheet, SheetBody, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { LoadingState } from '@/components/platform/loading-state';
import { ReasonDialog, type ReasonDialogState } from '@/components/platform/reason-dialog';
import { StatusBadge } from '@/components/platform/status-badge';
import { JourneyStepper, NextStepCallout, type JourneyStep } from '@/components/recruitment/journey-stepper';
import { api } from '@/lib/api';
import { useAuth } from '@/components/auth/auth-provider';
import {
  APPLICATION_STATUS,
  ASO_RESULT,
  ASO_STATUS,
  ASSESSMENT_KIND,
  ASSESSMENT_STATUS,
  ADMISSION_STATUS,
  DOC_KIND,
  ESOCIAL_STATUS,
  EVENT_TYPE,
  INTERVIEW_STATUS,
  INTERVIEW_TYPE,
  OFFER_STATUS,
  PRE_ADMISSION_STATUS,
  PRE_DOC_STATUS,
  PROBATION_RECOMMENDATION,
  PROBATION_STATUS,
  RECOMMENDATION,
  formatDateBr,
  formatDateTimeBr,
  formatMoneyCents,
  labelOf,
  metaOf,
} from '@/lib/recruitment/labels';

export interface PipelineStage {
  id: string;
  name: string;
  order: number;
}

interface ScreeningQuestion { id: string; order: number; question: string; required: boolean; knockout: boolean }
interface ScoreCriterion { id: string; order: number; name: string; category: string | null; weight: number; scaleMin: number; scaleMax: number }
interface Offer {
  id: string; status: string; revision: number; salaryAmountCents: number; currency: string;
  salaryMinCents: number | null; salaryMaxCents: number | null; approvalRequired: boolean; withinSalaryBand: boolean;
  startDate: string | null; expiresAt: string | null; justification: string | null;
}
interface PreAdmissionDocument {
  id: string; kind: string; title: string; required: boolean; status: string; reviewNote: string | null;
  candidateDocument?: { fileName: string; sizeBytes: number } | null;
}
interface OccupationalExamRequest {
  id: string; status: string; examType: string; dueAt: string | null; requestedAt: string; operationalNotes: string | null;
  appointment?: { id: string; status: string; scheduledAt: string; location: string | null; providerName: string | null } | null;
  asoRecord?: { id: string; result: string; examDate: string; validUntil: string | null } | null;
}
interface PreAdmission {
  id: string; status: string; admissionTargetDate: string | null; documents: PreAdmissionDocument[];
  occupationalExamRequests?: OccupationalExamRequest[];
}
interface ProbationReview { id: string; cycleDay: number; dueAt: string; status: string; recommendation: string | null; notes: string | null }
interface Admission {
  id: string; status: string; employeeId: string | null; positionId: string | null; onboardingProcessId: string | null;
  esocialStatus: string; admissionDate: string; probationReviews?: ProbationReview[];
  employee?: { id: string; name: string; registrationId: string | null } | null;
}
export interface ApplicationDetail {
  id: string; status: string; appliedAt: string; currentStageId: string | null; coverLetter: string | null; score: number | null;
  candidate: { id: string; name: string; email: string; phone: string | null; city: string | null; headline: string | null };
  posting: { id: string; title: string; slug: string };
  stage: { id: string; name: string; order: number } | null;
  documents: Array<{ id: string; kind: string; fileName: string; mimeType: string; sizeBytes: number; scanStatus: string; createdAt: string }>;
  events: Array<{ id: string; type: string; note: string | null; actorType: string; createdAt: string }>;
  screeningAnswers?: Array<{ id: string; answer: unknown; passed: boolean | null; question: ScreeningQuestion }>;
  evaluations?: Array<{ id: string; status: string; recommendation: string | null; summary: string | null; createdAt: string; ratings: Array<{ score: number; criterion: ScoreCriterion }> }>;
  interviews?: Array<{ id: string; type: string; status: string; startsAt: string; endsAt: string | null; location: string | null; meetingUrl: string | null }>;
  assessments?: Array<{ id: string; kind: string; title: string; status: string; score: number | null; dueAt: string | null; resultNotes?: string | null }>;
  aiAnalyses?: Array<{
    id: string; provider: string; model: string | null; promptVersion: string; summary: string; confidence: number | null; createdAt: string;
    criteria?: unknown; evidence?: unknown; missingRequirements?: unknown; risks?: unknown; humanReviewRequired: boolean;
  }>;
  offers?: Offer[];
  preAdmissions?: PreAdmission[];
  admission?: Admission | null;
}

interface StoredContent { fileName: string; mimeType: string; contentBase64: string }

const EMPTY_INTERVIEW = { type: 'RH', startsAt: '', endsAt: '', location: '', meetingUrl: '', notifyCandidate: true };
const EMPTY_ASSESSMENT = { title: '', kind: 'TECHNICAL_TEST', dueAt: '', instructions: '' };
const EMPTY_ASO_SCHEDULE = { scheduledAt: '', location: '', providerName: '', instructions: '' };
const EMPTY_ASO_RESULT = { result: 'APTO', examDate: '', validUntil: '', physicianName: '', clinicalNotes: '' };
const EMPTY_OFFER = { salaryAmount: '', startDate: '', expiresAt: '', justification: '' };
const EMPTY_ADMISSION = { cpf: '', admissionDate: '', registrationId: '', birthDate: '', sex: '', raceColor: '', pisPasep: '', notes: '' };

export function CandidateSheet({
  applicationId,
  stages,
  scorecard,
  onClose,
  onChanged,
}: {
  applicationId: string | null;
  stages: PipelineStage[];
  scorecard: ScoreCriterion[];
  onClose: () => void;
  onChanged?: () => void;
}) {
  const qc = useQueryClient();
  const { hasPermission } = useAuth();
  const canManage = hasPermission(['recruit:manage']);
  const canAdmit = hasPermission(['recruit:admit', 'recruit:manage']);
  const canPrehire = hasPermission(['recruit:prehire', 'recruit:manage']);
  const canHealth = hasPermission(['saude:occupational']);

  const [reasonDialog, setReasonDialog] = useState<ReasonDialogState | null>(null);
  const [interviewDialog, setInterviewDialog] = useState(false);
  const [interviewForm, setInterviewForm] = useState({ ...EMPTY_INTERVIEW });
  const [assessmentDialog, setAssessmentDialog] = useState(false);
  const [assessmentForm, setAssessmentForm] = useState({ ...EMPTY_ASSESSMENT });
  const [asoScheduleId, setAsoScheduleId] = useState<string | null>(null);
  const [asoScheduleForm, setAsoScheduleForm] = useState({ ...EMPTY_ASO_SCHEDULE });
  const [asoResultId, setAsoResultId] = useState<string | null>(null);
  const [asoResultForm, setAsoResultForm] = useState({ ...EMPTY_ASO_RESULT });
  const [probationId, setProbationId] = useState<string | null>(null);
  const [probationForm, setProbationForm] = useState({ recommendation: 'CONTINUAR', notes: '' });
  const [ratingDraft, setRatingDraft] = useState<Record<string, number>>({});
  const [evaluationSummary, setEvaluationSummary] = useState('');
  const [recommendation, setRecommendation] = useState('YES');
  const [offerDraft, setOfferDraft] = useState({ ...EMPTY_OFFER });
  const [admissionDraft, setAdmissionDraft] = useState({ ...EMPTY_ADMISSION });

  // Limpa rascunhos ao trocar de candidato — evita vazar avaliação de um p/ outro.
  useEffect(() => {
    setRatingDraft({});
    setEvaluationSummary('');
    setOfferDraft({ ...EMPTY_OFFER });
    setAdmissionDraft({ ...EMPTY_ADMISSION });
  }, [applicationId]);

  const detailQuery = useQuery<ApplicationDetail>({
    queryKey: ['recruit-application', applicationId],
    queryFn: () => api(`/recruitment/applications/${applicationId}`),
    enabled: Boolean(applicationId),
  });
  const detail = detailQuery.data;

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ['recruit-application', applicationId] });
    onChanged?.();
  };

  const call = (path: string, json?: unknown) => api(path, { method: 'POST', json: json ?? {} });
  const mutate = (successMessage: string) => ({
    onSuccess: () => {
      toast.success(successMessage);
      refresh();
    },
    onError: (error: any) => toast.error(error?.message ?? 'Não foi possível concluir a ação.'),
  });

  const moveApplication = useMutation({ mutationFn: (toStageId: string) => call(`/recruitment/applications/${applicationId}/move`, { toStageId }), ...mutate('Candidato movido de etapa.') });
  const rejectApplication = useMutation({ mutationFn: (reason: string) => call(`/recruitment/applications/${applicationId}/reject`, { reason }), ...mutate('Candidatura rejeitada.') });
  const addNote = useMutation({ mutationFn: (note: string) => call(`/recruitment/applications/${applicationId}/notes`, { note }), ...mutate('Nota registrada.') });
  const submitEvaluation = useMutation({
    mutationFn: () =>
      call(`/recruitment/applications/${applicationId}/evaluations`, {
        recommendation,
        summary: evaluationSummary,
        ratings: scorecard.map((criterion) => ({ criterionId: criterion.id, score: ratingDraft[criterion.id] ?? criterion.scaleMin })),
      }),
    onSuccess: () => {
      toast.success('Avaliação enviada.');
      setEvaluationSummary('');
      setRatingDraft({});
      refresh();
    },
    onError: (error: any) => toast.error(error?.message ?? 'Não foi possível enviar a avaliação.'),
  });
  const scheduleInterview = useMutation({
    mutationFn: () =>
      call(`/recruitment/applications/${applicationId}/interviews`, {
        type: interviewForm.type,
        startsAt: interviewForm.startsAt,
        endsAt: interviewForm.endsAt || undefined,
        location: interviewForm.location || undefined,
        meetingUrl: interviewForm.meetingUrl || undefined,
        participants: [],
        notifyCandidate: interviewForm.notifyCandidate,
      }),
    onSuccess: () => {
      toast.success('Entrevista agendada. O candidato será avisado por e-mail.');
      setInterviewDialog(false);
      setInterviewForm({ ...EMPTY_INTERVIEW });
      refresh();
    },
    onError: (error: any) => toast.error(error?.message ?? 'Não foi possível agendar.'),
  });
  const saveAssessment = useMutation({
    mutationFn: () =>
      call(`/recruitment/applications/${applicationId}/assessments`, {
        title: assessmentForm.title,
        kind: assessmentForm.kind,
        dueAt: assessmentForm.dueAt || undefined,
        instructions: assessmentForm.instructions || undefined,
      }),
    onSuccess: () => {
      toast.success('Teste atribuído.');
      setAssessmentDialog(false);
      setAssessmentForm({ ...EMPTY_ASSESSMENT });
      refresh();
    },
    onError: (error: any) => toast.error(error?.message ?? 'Não foi possível atribuir o teste.'),
  });
  const runAi = useMutation({ mutationFn: () => call(`/recruitment/applications/${applicationId}/ai-triage`), ...mutate('Triagem assistida gerada.') });
  const saveOffer = useMutation({
    mutationFn: () =>
      call(`/recruitment/applications/${applicationId}/offers`, {
        salaryAmount: offerDraft.salaryAmount,
        startDate: offerDraft.startDate || undefined,
        expiresAt: offerDraft.expiresAt || undefined,
        justification: offerDraft.justification || undefined,
      }),
    onSuccess: () => {
      toast.success('Proposta preparada.');
      setOfferDraft({ ...EMPTY_OFFER });
      refresh();
    },
    onError: (error: any) => toast.error(error?.message ?? 'Não foi possível preparar a proposta.'),
  });
  const approveOffer = useMutation({ mutationFn: (id: string) => call(`/recruitment/offers/${id}/approve`), ...mutate('Proposta aprovada.') });
  const sendOffer = useMutation({ mutationFn: (id: string) => call(`/recruitment/offers/${id}/send`), ...mutate('Proposta enviada ao candidato.') });
  const cancelOffer = useMutation({ mutationFn: ({ id, reason }: { id: string; reason?: string }) => call(`/recruitment/offers/${id}/cancel`, { reason }), ...mutate('Proposta cancelada.') });
  const startPreAdmission = useMutation({ mutationFn: (offerId?: string) => call(`/recruitment/applications/${applicationId}/pre-admissions`, { offerId }), ...mutate('Pré-admissão iniciada. Solicite os documentos ao candidato.') });
  const addPreAdmissionDocument = useMutation({ mutationFn: ({ preAdmissionId, title }: { preAdmissionId: string; title: string }) => call(`/recruitment/pre-admissions/${preAdmissionId}/documents`, { title, kind: 'OTHER' }), ...mutate('Documento solicitado ao candidato.') });
  const reviewPreAdmissionDocument = useMutation({ mutationFn: ({ id, status, note }: { id: string; status: string; note?: string }) => call(`/recruitment/pre-admission-documents/${id}/review`, { status, note }), ...mutate('Documento revisado.') });
  const requestAso = useMutation({ mutationFn: (preAdmissionId: string) => call(`/recruitment/applications/${applicationId}/occupational-exams`, { preAdmissionId }), ...mutate('ASO admissional solicitado.') });
  const scheduleAso = useMutation({
    mutationFn: () =>
      call(`/recruitment/occupational-exams/${asoScheduleId}/schedule`, {
        scheduledAt: asoScheduleForm.scheduledAt,
        location: asoScheduleForm.location || undefined,
        providerName: asoScheduleForm.providerName || undefined,
        instructions: asoScheduleForm.instructions || undefined,
      }),
    onSuccess: () => {
      toast.success('ASO agendado.');
      setAsoScheduleId(null);
      setAsoScheduleForm({ ...EMPTY_ASO_SCHEDULE });
      refresh();
    },
    onError: (error: any) => toast.error(error?.message ?? 'Não foi possível agendar o ASO.'),
  });
  const recordAsoResult = useMutation({
    mutationFn: () =>
      call(`/recruitment/occupational-exams/${asoResultId}/result`, {
        result: asoResultForm.result,
        examDate: asoResultForm.examDate,
        validUntil: asoResultForm.validUntil || undefined,
        physicianName: asoResultForm.physicianName || undefined,
        clinicalNotes: asoResultForm.clinicalNotes || undefined,
      }),
    onSuccess: () => {
      toast.success('Resultado do ASO registrado.');
      setAsoResultId(null);
      setAsoResultForm({ ...EMPTY_ASO_RESULT });
      refresh();
    },
    onError: (error: any) => toast.error(error?.message ?? 'Não foi possível registrar o resultado.'),
  });
  const cancelAso = useMutation({ mutationFn: ({ id, reason }: { id: string; reason?: string }) => call(`/recruitment/occupational-exams/${id}/cancel`, { reason }), ...mutate('ASO cancelado.') });
  const authorizeAdmission = useMutation({
    mutationFn: () =>
      call(`/recruitment/applications/${applicationId}/admission/authorize`, {
        cpf: admissionDraft.cpf || undefined,
        admissionDate: admissionDraft.admissionDate || undefined,
        registrationId: admissionDraft.registrationId || undefined,
        birthDate: admissionDraft.birthDate || undefined,
        sex: admissionDraft.sex || undefined,
        raceColor: admissionDraft.raceColor || undefined,
        pisPasep: admissionDraft.pisPasep || undefined,
        notes: admissionDraft.notes || undefined,
      }),
    onSuccess: () => {
      toast.success('Admissão autorizada. Colaborador criado no Serviço Pessoal.');
      setAdmissionDraft({ ...EMPTY_ADMISSION });
      refresh();
    },
    onError: (error: any) => toast.error(error?.message ?? 'Não foi possível autorizar a admissão.'),
  });
  const completeProbation = useMutation({
    mutationFn: () => call(`/recruitment/probation-reviews/${probationId}/complete`, { recommendation: probationForm.recommendation, notes: probationForm.notes || undefined }),
    onSuccess: () => {
      toast.success('Avaliação de experiência concluída.');
      setProbationId(null);
      setProbationForm({ recommendation: 'CONTINUAR', notes: '' });
      refresh();
    },
    onError: (error: any) => toast.error(error?.message ?? 'Não foi possível concluir a avaliação.'),
  });
  const downloadDocument = useMutation({
    mutationFn: (id: string) => api<StoredContent>(`/recruitment/application-documents/${id}`),
    onSuccess: (doc) => downloadBase64(doc),
    onError: (error: any) => toast.error(error?.message ?? 'Não foi possível baixar o documento.'),
  });

  const acceptedOffer = detail?.offers?.find((offer) => offer.status === 'ACCEPTED') ?? null;
  const clearedPre = detail?.preAdmissions?.find((pre) => ['ASO_CLEARED', 'COMPLETED'].includes(pre.status) && hasClearedAso(pre)) ?? null;
  const canAuthorize = Boolean(detail && canAdmit && !detail.admission && acceptedOffer && clearedPre && detail.status === 'ACTIVE');
  const journey = useMemo(() => (detail ? buildJourney(detail) : null), [detail]);

  return (
    <>
      <Sheet open={Boolean(applicationId)} onOpenChange={(open) => !open && onClose()}>
        <SheetContent size="xl">
          {detailQuery.isLoading && (
            <SheetBody>
              <LoadingState label="Carregando candidato..." />
            </SheetBody>
          )}
          {detail && (
            <>
              <SheetHeader className="pr-12">
                <div className="flex flex-wrap items-center gap-2">
                  <SheetTitle>{detail.candidate.name}</SheetTitle>
                  <StatusBadge {...badge(APPLICATION_STATUS, detail.status)} />
                  {typeof detail.score === 'number' && <Badge variant="outline" className="text-[10px]">triagem {detail.score} pts</Badge>}
                </div>
                <div className="text-xs text-muted-foreground">
                  {[detail.candidate.email, detail.candidate.phone, detail.candidate.city, detail.candidate.headline].filter(Boolean).join(' · ')}
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    Etapa:
                    <NativeSelect
                      className="h-8 w-52 text-xs"
                      value={detail.currentStageId ?? ''}
                      disabled={!canManage || detail.status !== 'ACTIVE' || stages.length === 0}
                      onChange={(event) => event.target.value && moveApplication.mutate(event.target.value)}
                    >
                      <option value="">Sem etapa</option>
                      {stages.map((stage) => (
                        <option key={stage.id} value={stage.id}>{stage.order}. {stage.name}</option>
                      ))}
                    </NativeSelect>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={!canManage}
                    onClick={() =>
                      setReasonDialog({
                        title: 'Nota interna sobre o candidato',
                        label: 'Nota',
                        confirmLabel: 'Registrar',
                        onConfirm: (note) => addNote.mutate(note),
                      })
                    }
                  >
                    <MessageSquare className="mr-1 h-3.5 w-3.5" /> Nota
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-status-red"
                    disabled={!canManage || detail.status !== 'ACTIVE'}
                    onClick={() =>
                      setReasonDialog({
                        title: `Rejeitar ${detail.candidate.name}`,
                        description: 'O candidato sai do processo desta vaga. O motivo fica na linha do tempo.',
                        label: 'Motivo da rejeição',
                        confirmLabel: 'Rejeitar',
                        destructive: true,
                        onConfirm: (reason) => rejectApplication.mutate(reason),
                      })
                    }
                  >
                    <XCircle className="mr-1 h-3.5 w-3.5" /> Rejeitar
                  </Button>
                </div>
              </SheetHeader>
              <SheetBody className="space-y-5">
                {journey && (
                  <div className="space-y-2">
                    <JourneyStepper steps={journey.steps} />
                    {journey.next && <NextStepCallout text={journey.next} tone={journey.tone} />}
                  </div>
                )}

                {detail.coverLetter && (
                  <Section icon={MessageSquare} title="Mensagem do candidato">
                    <p className="whitespace-pre-wrap rounded-md bg-muted/40 p-3 text-xs">{detail.coverLetter}</p>
                  </Section>
                )}

                <Section icon={ClipboardList} title="Triagem (respostas da candidatura)">
                  {(detail.screeningAnswers ?? []).length === 0 ? (
                    <p className="text-xs text-muted-foreground">Esta vaga não tinha perguntas de triagem quando o candidato se aplicou.</p>
                  ) : (
                    <div className="divide-y rounded-md border">
                      {(detail.screeningAnswers ?? []).map((answer) => (
                        <div key={answer.id} className="p-2.5 text-xs">
                          <div className="flex items-start justify-between gap-2">
                            <div className="font-medium">{answer.question.question}</div>
                            {answer.passed === true && <StatusBadge tone="green" label="Atende" />}
                            {answer.passed === false && <StatusBadge tone="yellow" label="Não atende" />}
                          </div>
                          <div className="mt-1 text-muted-foreground">{formatAnswer(answer.answer)}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </Section>

                <Section icon={Star} title="Sua avaliação (scorecard)">
                  {scorecard.length === 0 ? (
                    <p className="rounded-md bg-muted/40 p-3 text-xs text-muted-foreground">
                      Configure o scorecard na aba “Triagem e scorecard” da vaga para avaliar candidatos com critérios comparáveis.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {scorecard.map((criterion) => (
                        <label key={criterion.id} className="grid grid-cols-[1fr_80px] items-center gap-2 text-xs">
                          <span className="min-w-0">
                            <span className="block truncate font-medium">{criterion.name}</span>
                            <span className="text-[10px] text-muted-foreground">peso {criterion.weight} · escala {criterion.scaleMin} a {criterion.scaleMax}</span>
                          </span>
                          <Input
                            type="number"
                            min={criterion.scaleMin}
                            max={criterion.scaleMax}
                            value={ratingDraft[criterion.id] ?? criterion.scaleMin}
                            disabled={!canManage}
                            onChange={(event) => setRatingDraft((current) => ({ ...current, [criterion.id]: Number(event.target.value) }))}
                            className="h-8 text-xs"
                          />
                        </label>
                      ))}
                      <div className="grid gap-2 sm:grid-cols-[1fr_160px]">
                        <Textarea rows={2} placeholder="Resumo da sua avaliação" value={evaluationSummary} onChange={(event) => setEvaluationSummary(event.target.value)} disabled={!canManage} />
                        <div className="space-y-2">
                          <NativeSelect value={recommendation} onChange={(event) => setRecommendation(event.target.value)} className="h-9 text-xs" disabled={!canManage}>
                            {Object.entries(RECOMMENDATION).map(([value, label]) => (
                              <option key={value} value={value}>{label}</option>
                            ))}
                          </NativeSelect>
                          <Button size="sm" className="w-full" onClick={() => submitEvaluation.mutate()} disabled={!canManage || submitEvaluation.isPending}>
                            Enviar avaliação
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}
                  <div className="mt-3 space-y-2">
                    {(detail.evaluations ?? []).length === 0 && (
                      <p className="text-xs text-muted-foreground">Avaliação cega: as notas dos demais avaliadores só aparecem depois que você enviar a sua.</p>
                    )}
                    {(detail.evaluations ?? []).map((evaluation) => (
                      <div key={evaluation.id} className="rounded-md bg-muted/40 p-2 text-xs">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-medium">{labelOf(RECOMMENDATION, evaluation.recommendation)}</span>
                          <span className="text-muted-foreground">{averageScore(evaluation.ratings)}</span>
                        </div>
                        {evaluation.summary && <div className="mt-1 text-muted-foreground">{evaluation.summary}</div>}
                      </div>
                    ))}
                  </div>
                </Section>

                <Section
                  icon={CalendarClock}
                  title="Entrevistas e testes"
                  actions={
                    <div className="flex gap-1">
                      <Button size="sm" variant="outline" disabled={!canManage} onClick={() => setInterviewDialog(true)}>Agendar entrevista</Button>
                      <Button size="sm" variant="outline" disabled={!canManage} onClick={() => setAssessmentDialog(true)}>Atribuir teste</Button>
                    </div>
                  }
                >
                  <div className="space-y-2">
                    {(detail.interviews ?? []).map((interview) => (
                      <div key={interview.id} className="flex flex-wrap items-center gap-2 rounded-md bg-muted/40 p-2 text-xs">
                        <span className="font-medium">{labelOf(INTERVIEW_TYPE, interview.type)}</span>
                        <StatusBadge {...badge(INTERVIEW_STATUS, interview.status)} />
                        <span className="text-muted-foreground">
                          {formatDateTimeBr(interview.startsAt)}
                          {interview.location ? ` · ${interview.location}` : ''}
                          {interview.meetingUrl ? ` · ${interview.meetingUrl}` : ''}
                        </span>
                      </div>
                    ))}
                    {(detail.assessments ?? []).map((assessment) => (
                      <div key={assessment.id} className="flex flex-wrap items-center gap-2 rounded-md bg-muted/40 p-2 text-xs">
                        <span className="font-medium">{assessment.title}</span>
                        <Badge variant="outline" className="text-[9px]">{labelOf(ASSESSMENT_KIND, assessment.kind)}</Badge>
                        <StatusBadge {...badge(ASSESSMENT_STATUS, assessment.status)} />
                        <span className="text-muted-foreground">
                          {typeof assessment.score === 'number' ? `nota ${assessment.score}` : ''}
                          {assessment.dueAt ? ` · prazo ${formatDateBr(assessment.dueAt)}` : ''}
                        </span>
                      </div>
                    ))}
                    {(detail.interviews ?? []).length === 0 && (detail.assessments ?? []).length === 0 && (
                      <p className="text-xs text-muted-foreground">Nenhuma entrevista ou teste ainda.</p>
                    )}
                  </div>
                </Section>

                <Section
                  icon={Bot}
                  title="Triagem assistida por IA"
                  actions={
                    <Button size="sm" variant="outline" disabled={!canManage || runAi.isPending} onClick={() => runAi.mutate()}>
                      Gerar análise
                    </Button>
                  }
                >
                  <div className="space-y-2">
                    {(detail.aiAnalyses ?? []).length === 0 && (
                      <p className="text-xs text-muted-foreground">
                        Sem análise gerada. A IA compara o currículo com os requisitos e aponta evidências e lacunas — ela nunca aprova nem rejeita ninguém.
                      </p>
                    )}
                    {(detail.aiAnalyses ?? []).map((analysis) => (
                      <div key={analysis.id} className="rounded-md bg-muted/40 p-2 text-xs">
                        <div className="flex flex-wrap items-center gap-1">
                          <Badge variant="outline" className="text-[8px]">{analysis.provider}{analysis.model ? `/${analysis.model}` : ''}</Badge>
                          {analysis.humanReviewRequired && <Badge variant="outline" className="text-[8px] text-status-yellow">requer revisão humana</Badge>}
                          {typeof analysis.confidence === 'number' && (
                            <span className="ml-auto text-[10px] text-muted-foreground">confiança {Math.round(analysis.confidence * 100)}%</span>
                          )}
                        </div>
                        <div className="mt-2 whitespace-pre-wrap">{analysis.summary}</div>
                        <AiList label="Evidências" value={analysis.evidence} />
                        <AiList label="Lacunas frente aos requisitos" value={analysis.missingRequirements} />
                        <AiList label="Pontos de atenção" value={analysis.risks} />
                      </div>
                    ))}
                  </div>
                </Section>

                <Section icon={Send} title="Proposta">
                  {canManage && (
                    <div className="rounded-md border p-3">
                      <div className="grid gap-2 sm:grid-cols-2">
                        <div>
                          <Label className="text-xs">Salário mensal (R$)</Label>
                          <Input placeholder="Ex.: 4500,00" value={offerDraft.salaryAmount} onChange={(event) => setOfferDraft((f) => ({ ...f, salaryAmount: event.target.value }))} />
                        </div>
                        <div>
                          <Label className="text-xs">Previsão de início</Label>
                          <Input type="date" value={offerDraft.startDate} onChange={(event) => setOfferDraft((f) => ({ ...f, startDate: event.target.value }))} />
                        </div>
                        <div>
                          <Label className="text-xs">Validade da proposta</Label>
                          <Input type="date" value={offerDraft.expiresAt} onChange={(event) => setOfferDraft((f) => ({ ...f, expiresAt: event.target.value }))} />
                        </div>
                        <div>
                          <Label className="text-xs">Justificativa (se fora da faixa)</Label>
                          <Input value={offerDraft.justification} onChange={(event) => setOfferDraft((f) => ({ ...f, justification: event.target.value }))} />
                        </div>
                      </div>
                      <Button className="mt-2" size="sm" onClick={() => saveOffer.mutate()} disabled={!offerDraft.salaryAmount || saveOffer.isPending}>
                        Preparar proposta
                      </Button>
                      <p className="mt-1 text-[10px] text-muted-foreground">
                        A faixa salarial vem da requisição. Proposta fora da faixa exige aprovação de quem tem a permissão “aprovar proposta”.
                      </p>
                    </div>
                  )}
                  <div className="mt-3 space-y-2">
                    {(detail.offers ?? []).length === 0 && <p className="text-xs text-muted-foreground">Nenhuma proposta preparada.</p>}
                    {(detail.offers ?? []).map((offer) => (
                      <div key={offer.id} className="rounded-md bg-muted/40 p-2 text-xs">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium">Revisão {offer.revision} · {formatMoneyCents(offer.salaryAmountCents, offer.currency)}</span>
                          <StatusBadge {...badge(OFFER_STATUS, offer.status)} />
                          {offer.approvalRequired && <Badge variant="outline" className="text-[8px] text-status-yellow">fora da faixa</Badge>}
                        </div>
                        <div className="mt-1 text-muted-foreground">
                          Faixa da requisição: {formatMoneyCents(offer.salaryMinCents, offer.currency)} a {formatMoneyCents(offer.salaryMaxCents, offer.currency)}
                          {offer.startDate ? ` · início ${formatDateBr(offer.startDate)}` : ''}
                          {offer.expiresAt ? ` · validade ${formatDateBr(offer.expiresAt)}` : ''}
                        </div>
                        {offer.justification && <div className="mt-1 text-muted-foreground">{offer.justification}</div>}
                        <div className="mt-2 flex flex-wrap gap-1">
                          {['DRAFT', 'PENDING_APPROVAL'].includes(offer.status) && (
                            <Button size="sm" variant="outline" disabled={!canManage || approveOffer.isPending} onClick={() => approveOffer.mutate(offer.id)}>Aprovar</Button>
                          )}
                          {['DRAFT', 'APPROVED'].includes(offer.status) && (
                            <Button size="sm" variant="outline" disabled={!canManage || sendOffer.isPending} onClick={() => sendOffer.mutate(offer.id)}>Enviar ao candidato</Button>
                          )}
                          {offer.status === 'ACCEPTED' && !clearedPre && (detail.preAdmissions ?? []).length === 0 && (
                            <Button size="sm" disabled={!canManage || startPreAdmission.isPending} onClick={() => startPreAdmission.mutate(offer.id)}>Iniciar pré-admissão</Button>
                          )}
                          {!['ACCEPTED', 'DECLINED', 'CANCELLED', 'EXPIRED'].includes(offer.status) && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-status-red"
                              disabled={!canManage || cancelOffer.isPending}
                              onClick={() =>
                                setReasonDialog({
                                  title: 'Cancelar proposta',
                                  label: 'Motivo',
                                  required: false,
                                  confirmLabel: 'Cancelar proposta',
                                  destructive: true,
                                  onConfirm: (reason) => cancelOffer.mutate({ id: offer.id, reason: reason || undefined }),
                                })
                              }
                            >
                              Cancelar
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </Section>

                <Section
                  icon={FileText}
                  title="Pré-admissão e documentos"
                  actions={
                    (detail.preAdmissions ?? []).length === 0 ? (
                      <Button size="sm" variant="outline" disabled={!canManage || startPreAdmission.isPending} onClick={() => startPreAdmission.mutate(undefined)}>
                        Iniciar
                      </Button>
                    ) : undefined
                  }
                >
                  <div className="space-y-2">
                    {(detail.preAdmissions ?? []).length === 0 && (
                      <p className="text-xs text-muted-foreground">
                        Após a proposta aceita, inicie a pré-admissão: o candidato envia RG, CPF, comprovantes e dados bancários pelo portal dele.
                      </p>
                    )}
                    {(detail.preAdmissions ?? []).map((pre) => (
                      <div key={pre.id} className="rounded-md border p-2.5 text-xs">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <StatusBadge {...badge(PRE_ADMISSION_STATUS, pre.status)} />
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={!canManage || addPreAdmissionDocument.isPending}
                            onClick={() =>
                              setReasonDialog({
                                title: 'Solicitar documento adicional',
                                label: 'Nome do documento',
                                placeholder: 'Ex.: Certificado de reservista',
                                confirmLabel: 'Solicitar',
                                onConfirm: (title) => addPreAdmissionDocument.mutate({ preAdmissionId: pre.id, title }),
                              })
                            }
                          >
                            Solicitar documento
                          </Button>
                        </div>
                        <div className="mt-2 divide-y rounded-md border bg-background">
                          {pre.documents.map((doc) => (
                            <div key={doc.id} className="p-2">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="font-medium">{doc.title}</span>
                                <StatusBadge {...badge(PRE_DOC_STATUS, doc.status)} />
                                {doc.required && <Badge variant="outline" className="text-[8px]">obrigatório</Badge>}
                              </div>
                              {doc.candidateDocument && (
                                <div className="mt-1 text-muted-foreground">{doc.candidateDocument.fileName} · {formatBytes(doc.candidateDocument.sizeBytes)}</div>
                              )}
                              {doc.reviewNote && <div className="mt-1 text-muted-foreground">{doc.reviewNote}</div>}
                              {['SUBMITTED', 'REJECTED'].includes(doc.status) && canPrehire && (
                                <div className="mt-2 flex gap-1">
                                  <Button size="sm" variant="outline" disabled={reviewPreAdmissionDocument.isPending} onClick={() => reviewPreAdmissionDocument.mutate({ id: doc.id, status: 'APPROVED' })}>
                                    Aprovar
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    disabled={reviewPreAdmissionDocument.isPending}
                                    onClick={() =>
                                      setReasonDialog({
                                        title: `Rejeitar documento: ${doc.title}`,
                                        description: 'O candidato verá o motivo e poderá reenviar.',
                                        label: 'O que precisa ser corrigido',
                                        confirmLabel: 'Rejeitar documento',
                                        destructive: true,
                                        onConfirm: (note) => reviewPreAdmissionDocument.mutate({ id: doc.id, status: 'REJECTED', note }),
                                      })
                                    }
                                  >
                                    Rejeitar
                                  </Button>
                                  <Button size="sm" variant="ghost" disabled={reviewPreAdmissionDocument.isPending} onClick={() => reviewPreAdmissionDocument.mutate({ id: doc.id, status: 'WAIVED' })}>
                                    Dispensar
                                  </Button>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>

                        <div className="mt-3 rounded-md border bg-background p-2">
                          <div className="mb-2 flex flex-wrap items-center gap-2">
                            <div className="mr-auto flex items-center gap-1 text-[10px] font-semibold uppercase text-muted-foreground">
                              <HeartPulse className="h-3.5 w-3.5" /> ASO admissional
                            </div>
                            {['READY_FOR_ASO', 'ASO_BLOCKED'].includes(pre.status) &&
                              !(pre.occupationalExamRequests ?? []).some((aso) => ['REQUESTED', 'SCHEDULED'].includes(aso.status)) && (
                                <Button size="sm" variant="outline" disabled={!canManage || requestAso.isPending} onClick={() => requestAso.mutate(pre.id)}>
                                  Solicitar ASO
                                </Button>
                              )}
                          </div>
                          {(pre.occupationalExamRequests ?? []).length === 0 && (
                            <p className="text-[11px] text-muted-foreground">
                              {pre.status === 'READY_FOR_ASO'
                                ? 'Documentos aprovados — o ASO já pode ser solicitado.'
                                : 'O ASO é liberado depois que os documentos obrigatórios forem aprovados.'}
                            </p>
                          )}
                          <div className="space-y-2">
                            {(pre.occupationalExamRequests ?? []).map((aso) => (
                              <div key={aso.id} className="rounded-md bg-muted/40 p-2">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="font-medium">Exame admissional</span>
                                  <StatusBadge {...badge(ASO_STATUS, aso.status)} />
                                  {aso.asoRecord?.result && <StatusBadge {...badge(ASO_RESULT, aso.asoRecord.result)} />}
                                </div>
                                <div className="mt-1 text-muted-foreground">
                                  Solicitado em {formatDateBr(aso.requestedAt)}
                                  {aso.dueAt ? ` · prazo ${formatDateBr(aso.dueAt)}` : ''}
                                </div>
                                {aso.appointment && (
                                  <div className="mt-1 text-muted-foreground">
                                    Agendado: {formatDateTimeBr(aso.appointment.scheduledAt)}
                                    {aso.appointment.location ? ` · ${aso.appointment.location}` : ''}
                                    {aso.appointment.providerName ? ` · ${aso.appointment.providerName}` : ''}
                                  </div>
                                )}
                                {aso.asoRecord && (
                                  <div className="mt-1 text-muted-foreground">
                                    Exame em {formatDateBr(aso.asoRecord.examDate)}
                                    {aso.asoRecord.validUntil ? ` · validade ${formatDateBr(aso.asoRecord.validUntil)}` : ''}
                                  </div>
                                )}
                                {['REQUESTED', 'SCHEDULED'].includes(aso.status) && (
                                  <div className="mt-2 flex flex-wrap gap-1">
                                    {canHealth && (
                                      <>
                                        <Button size="sm" variant="outline" onClick={() => { setAsoScheduleId(aso.id); setAsoScheduleForm({ ...EMPTY_ASO_SCHEDULE, location: aso.appointment?.location ?? '', providerName: aso.appointment?.providerName ?? '' }); }}>
                                          Agendar
                                        </Button>
                                        <Button size="sm" variant="outline" onClick={() => { setAsoResultId(aso.id); setAsoResultForm({ ...EMPTY_ASO_RESULT, examDate: new Date().toISOString().slice(0, 10) }); }}>
                                          Registrar resultado
                                        </Button>
                                      </>
                                    )}
                                    {!canHealth && <span className="text-[10px] text-muted-foreground">Agendamento e resultado são registrados pela Saúde Ocupacional (dados clínicos não aparecem aqui).</span>}
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="text-status-red"
                                      disabled={(!canManage && !canHealth) || cancelAso.isPending}
                                      onClick={() =>
                                        setReasonDialog({
                                          title: 'Cancelar ASO',
                                          label: 'Motivo',
                                          required: false,
                                          confirmLabel: 'Cancelar ASO',
                                          destructive: true,
                                          onConfirm: (reason) => cancelAso.mutate({ id: aso.id, reason: reason || undefined }),
                                        })
                                      }
                                    >
                                      Cancelar
                                    </Button>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </Section>

                <Section icon={UserCheck} title="Admissão">
                  {detail.admission ? (
                    <div className="space-y-3 text-xs">
                      <div className="flex flex-wrap items-center gap-2">
                        <StatusBadge {...badge(ADMISSION_STATUS, detail.admission.status)} />
                        <span className="text-muted-foreground">eSocial:</span>
                        <StatusBadge {...badge(ESOCIAL_STATUS, detail.admission.esocialStatus)} />
                        <span className="ml-auto text-muted-foreground">Início em {formatDateBr(detail.admission.admissionDate)}</span>
                      </div>
                      <p className="rounded-md bg-status-green/5 p-2 text-[11px] text-muted-foreground">
                        Colaborador criado no Serviço Pessoal{detail.admission.employee?.name ? ` (${detail.admission.employee.name}${detail.admission.employee.registrationId ? `, matrícula ${detail.admission.employee.registrationId}` : ''})` : ''}.
                        O checklist de integração aparece em Serviço Pessoal → Admissão e Desligamento.
                      </p>
                      <div>
                        <div className="mb-1 text-[10px] font-semibold uppercase text-muted-foreground">Avaliações do período de experiência</div>
                        <div className="space-y-2">
                          {(detail.admission.probationReviews ?? []).length === 0 && <p className="text-muted-foreground">Sem avaliações programadas.</p>}
                          {(detail.admission.probationReviews ?? []).map((review) => (
                            <div key={review.id} className="flex flex-wrap items-center gap-2 rounded-md bg-muted/40 p-2">
                              <div className="mr-auto">
                                <div className="font-medium">Avaliação D+{review.cycleDay}</div>
                                <div className="text-muted-foreground">
                                  Prazo {formatDateBr(review.dueAt)}
                                  {review.recommendation ? ` · ${labelOf(PROBATION_RECOMMENDATION, review.recommendation)}` : ''}
                                </div>
                              </div>
                              <StatusBadge {...badge(PROBATION_STATUS, review.status)} />
                              {review.status === 'PENDING' && (
                                <Button size="sm" variant="outline" disabled={!canAdmit} onClick={() => { setProbationId(review.id); setProbationForm({ recommendation: 'CONTINUAR', notes: review.notes ?? '' }); }}>
                                  Concluir
                                </Button>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <ReadinessChecklist detail={detail} acceptedOffer={Boolean(acceptedOffer)} asoCleared={Boolean(clearedPre)} />
                      <div className="grid gap-2 sm:grid-cols-2">
                        <FieldInput label="CPF" value={admissionDraft.cpf} onChange={(v) => setAdmissionDraft((f) => ({ ...f, cpf: v }))} disabled={!canAdmit} placeholder="000.000.000-00" />
                        <FieldInput label="Matrícula (opcional)" value={admissionDraft.registrationId} onChange={(v) => setAdmissionDraft((f) => ({ ...f, registrationId: v }))} disabled={!canAdmit} />
                        <FieldInput label="Data de admissão" type="date" value={admissionDraft.admissionDate} onChange={(v) => setAdmissionDraft((f) => ({ ...f, admissionDate: v }))} disabled={!canAdmit} />
                        <FieldInput label="Data de nascimento" type="date" value={admissionDraft.birthDate} onChange={(v) => setAdmissionDraft((f) => ({ ...f, birthDate: v }))} disabled={!canAdmit} />
                        <div>
                          <Label className="text-xs">Sexo (eSocial)</Label>
                          <NativeSelect value={admissionDraft.sex} onChange={(event) => setAdmissionDraft((f) => ({ ...f, sex: event.target.value }))} disabled={!canAdmit}>
                            <option value="">Não informado</option>
                            <option value="M">Masculino</option>
                            <option value="F">Feminino</option>
                          </NativeSelect>
                        </div>
                        <div>
                          <Label className="text-xs">Raça/cor (eSocial)</Label>
                          <NativeSelect value={admissionDraft.raceColor} onChange={(event) => setAdmissionDraft((f) => ({ ...f, raceColor: event.target.value }))} disabled={!canAdmit}>
                            <option value="">Não informada</option>
                            <option value="1">Branca</option>
                            <option value="2">Preta</option>
                            <option value="3">Parda</option>
                            <option value="4">Amarela</option>
                            <option value="5">Indígena</option>
                          </NativeSelect>
                        </div>
                        <FieldInput label="PIS/PASEP (opcional)" value={admissionDraft.pisPasep} onChange={(v) => setAdmissionDraft((f) => ({ ...f, pisPasep: v }))} disabled={!canAdmit} />
                        <FieldInput label="Observações (opcional)" value={admissionDraft.notes} onChange={(v) => setAdmissionDraft((f) => ({ ...f, notes: v }))} disabled={!canAdmit} />
                      </div>
                      <Button size="sm" disabled={!canAuthorize || authorizeAdmission.isPending} onClick={() => authorizeAdmission.mutate()}>
                        <UserPlus className="mr-1 h-3.5 w-3.5" /> Autorizar admissão
                      </Button>
                      <p className="text-[10px] text-muted-foreground">
                        Ao autorizar: o colaborador é criado no Serviço Pessoal (base única), a posição é ocupada, o evento S-2200 do eSocial é gerado e o
                        checklist de integração começa, com avaliações de experiência em D+45 e D+90.
                      </p>
                    </div>
                  )}
                </Section>

                <Section icon={Download} title="Documentos do candidato">
                  <div className="divide-y rounded-md border">
                    {detail.documents.length === 0 && <p className="p-3 text-xs text-muted-foreground">Nenhum documento anexado.</p>}
                    {detail.documents.map((doc) => (
                      <div key={doc.id} className="flex items-center gap-2 p-2">
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-xs font-medium">{doc.fileName}</div>
                          <div className="text-[10px] text-muted-foreground">{labelOf(DOC_KIND, doc.kind)} · {formatBytes(doc.sizeBytes)}</div>
                        </div>
                        <Button variant="ghost" size="sm" onClick={() => downloadDocument.mutate(doc.id)}>
                          <Download className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </Section>

                <Section icon={ClipboardList} title="Linha do tempo">
                  <div className="space-y-1.5">
                    {detail.events.map((event) => (
                      <div key={event.id} className="rounded-md bg-muted/40 p-2 text-xs">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-medium">{labelOf(EVENT_TYPE, event.type)}</span>
                          <span className="text-[10px] text-muted-foreground">{formatDateTimeBr(event.createdAt)}</span>
                        </div>
                        {event.note && <div className="mt-0.5 text-muted-foreground">{event.note}</div>}
                      </div>
                    ))}
                  </div>
                </Section>
              </SheetBody>
            </>
          )}
        </SheetContent>
      </Sheet>

      <ReasonDialog state={reasonDialog} onClose={() => setReasonDialog(null)} />

      {/* Agendar entrevista */}
      <Dialog open={interviewDialog} onOpenChange={setInterviewDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Agendar entrevista</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Tipo</Label>
              <NativeSelect value={interviewForm.type} onChange={(event) => setInterviewForm((f) => ({ ...f, type: event.target.value }))}>
                {Object.entries(INTERVIEW_TYPE).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </NativeSelect>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">Início</Label>
                <Input type="datetime-local" value={interviewForm.startsAt} onChange={(event) => setInterviewForm((f) => ({ ...f, startsAt: event.target.value }))} />
              </div>
              <div>
                <Label className="text-xs">Fim (opcional)</Label>
                <Input type="datetime-local" value={interviewForm.endsAt} onChange={(event) => setInterviewForm((f) => ({ ...f, endsAt: event.target.value }))} />
              </div>
            </div>
            <div>
              <Label className="text-xs">Local (opcional)</Label>
              <Input placeholder="Ex.: Sala de reuniões 2 ou endereço" value={interviewForm.location} onChange={(event) => setInterviewForm((f) => ({ ...f, location: event.target.value }))} />
            </div>
            <div>
              <Label className="text-xs">Link da chamada (opcional)</Label>
              <Input placeholder="https://meet..." value={interviewForm.meetingUrl} onChange={(event) => setInterviewForm((f) => ({ ...f, meetingUrl: event.target.value }))} />
            </div>
            <label className="flex items-center gap-2 text-xs">
              <input type="checkbox" checked={interviewForm.notifyCandidate} onChange={(event) => setInterviewForm((f) => ({ ...f, notifyCandidate: event.target.checked }))} />
              Avisar o candidato por e-mail
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setInterviewDialog(false)}>Cancelar</Button>
            <Button onClick={() => scheduleInterview.mutate()} disabled={!interviewForm.startsAt || scheduleInterview.isPending}>Agendar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Atribuir teste */}
      <Dialog open={assessmentDialog} onOpenChange={setAssessmentDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Atribuir teste ou case</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Título</Label>
              <Input placeholder="Ex.: Case de logística" value={assessmentForm.title} onChange={(event) => setAssessmentForm((f) => ({ ...f, title: event.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">Tipo</Label>
                <NativeSelect value={assessmentForm.kind} onChange={(event) => setAssessmentForm((f) => ({ ...f, kind: event.target.value }))}>
                  {Object.entries(ASSESSMENT_KIND).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </NativeSelect>
              </div>
              <div>
                <Label className="text-xs">Prazo (opcional)</Label>
                <Input type="date" value={assessmentForm.dueAt} onChange={(event) => setAssessmentForm((f) => ({ ...f, dueAt: event.target.value }))} />
              </div>
            </div>
            <div>
              <Label className="text-xs">Instruções (opcional)</Label>
              <Textarea rows={3} value={assessmentForm.instructions} onChange={(event) => setAssessmentForm((f) => ({ ...f, instructions: event.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssessmentDialog(false)}>Cancelar</Button>
            <Button onClick={() => saveAssessment.mutate()} disabled={!assessmentForm.title || saveAssessment.isPending}>Atribuir</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Agendar ASO */}
      <Dialog open={Boolean(asoScheduleId)} onOpenChange={(open) => !open && setAsoScheduleId(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Agendar ASO admissional</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Data e hora</Label>
              <Input type="datetime-local" value={asoScheduleForm.scheduledAt} onChange={(event) => setAsoScheduleForm((f) => ({ ...f, scheduledAt: event.target.value }))} />
            </div>
            <div>
              <Label className="text-xs">Clínica / local</Label>
              <Input value={asoScheduleForm.location} onChange={(event) => setAsoScheduleForm((f) => ({ ...f, location: event.target.value }))} />
            </div>
            <div>
              <Label className="text-xs">Prestador (opcional)</Label>
              <Input value={asoScheduleForm.providerName} onChange={(event) => setAsoScheduleForm((f) => ({ ...f, providerName: event.target.value }))} />
            </div>
            <div>
              <Label className="text-xs">Instruções ao candidato (opcional)</Label>
              <Textarea rows={2} placeholder="Ex.: levar documento com foto; jejum não é necessário" value={asoScheduleForm.instructions} onChange={(event) => setAsoScheduleForm((f) => ({ ...f, instructions: event.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAsoScheduleId(null)}>Cancelar</Button>
            <Button onClick={() => scheduleAso.mutate()} disabled={!asoScheduleForm.scheduledAt || scheduleAso.isPending}>Agendar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Registrar resultado do ASO */}
      <Dialog open={Boolean(asoResultId)} onOpenChange={(open) => !open && setAsoResultId(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Registrar resultado do ASO</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Resultado</Label>
              <NativeSelect value={asoResultForm.result} onChange={(event) => setAsoResultForm((f) => ({ ...f, result: event.target.value }))}>
                {Object.entries(ASO_RESULT).map(([value, meta]) => <option key={value} value={value}>{meta.label}</option>)}
              </NativeSelect>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">Data do exame</Label>
                <Input type="date" value={asoResultForm.examDate} onChange={(event) => setAsoResultForm((f) => ({ ...f, examDate: event.target.value }))} />
              </div>
              <div>
                <Label className="text-xs">Validade (opcional)</Label>
                <Input type="date" value={asoResultForm.validUntil} onChange={(event) => setAsoResultForm((f) => ({ ...f, validUntil: event.target.value }))} />
              </div>
            </div>
            <div>
              <Label className="text-xs">Médico responsável (opcional)</Label>
              <Input value={asoResultForm.physicianName} onChange={(event) => setAsoResultForm((f) => ({ ...f, physicianName: event.target.value }))} />
            </div>
            <div>
              <Label className="text-xs">Notas clínicas (restritas à Saúde Ocupacional)</Label>
              <Textarea rows={2} value={asoResultForm.clinicalNotes} onChange={(event) => setAsoResultForm((f) => ({ ...f, clinicalNotes: event.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAsoResultId(null)}>Cancelar</Button>
            <Button onClick={() => recordAsoResult.mutate()} disabled={!asoResultForm.examDate || recordAsoResult.isPending}>Registrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Concluir avaliação de experiência */}
      <Dialog open={Boolean(probationId)} onOpenChange={(open) => !open && setProbationId(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Concluir avaliação de experiência</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Recomendação</Label>
              <NativeSelect value={probationForm.recommendation} onChange={(event) => setProbationForm((f) => ({ ...f, recommendation: event.target.value }))}>
                {Object.entries(PROBATION_RECOMMENDATION).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </NativeSelect>
            </div>
            <div>
              <Label className="text-xs">Notas da avaliação (opcional)</Label>
              <Textarea rows={3} value={probationForm.notes} onChange={(event) => setProbationForm((f) => ({ ...f, notes: event.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setProbationId(null)}>Cancelar</Button>
            <Button onClick={() => completeProbation.mutate()} disabled={completeProbation.isPending}>Concluir</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function Section({ icon: Icon, title, actions, children }: { icon: typeof FileText; title: string; actions?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-md border p-3">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <h3 className="mr-auto flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          <Icon className="h-3.5 w-3.5" /> {title}
        </h3>
        {actions}
      </div>
      {children}
    </section>
  );
}

function FieldInput({ label, value, onChange, disabled, type = 'text', placeholder }: { label: string; value: string; onChange: (value: string) => void; disabled?: boolean; type?: string; placeholder?: string }) {
  return (
    <div>
      <Label className="text-xs">{label}</Label>
      <Input type={type} value={value} placeholder={placeholder} disabled={disabled} onChange={(event) => onChange(event.target.value)} />
    </div>
  );
}

function ReadinessChecklist({ detail, acceptedOffer, asoCleared }: { detail: ApplicationDetail; acceptedOffer: boolean; asoCleared: boolean }) {
  const items = [
    { label: 'Proposta aceita pelo candidato', ok: acceptedOffer },
    { label: 'Documentos de pré-admissão e ASO apto', ok: asoCleared },
    { label: 'Candidatura ativa (não rejeitada/desistente)', ok: detail.status === 'ACTIVE' },
  ];
  return (
    <div className="rounded-md bg-muted/40 p-2.5">
      <div className="mb-1 text-[10px] font-semibold uppercase text-muted-foreground">Pré-requisitos para autorizar</div>
      <ul className="space-y-1 text-xs">
        {items.map((item) => (
          <li key={item.label} className="flex items-center gap-2">
            <span className={item.ok ? 'text-status-green' : 'text-muted-foreground'}>{item.ok ? '✓' : '○'}</span>
            <span className={item.ok ? '' : 'text-muted-foreground'}>{item.label}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function buildJourney(detail: ApplicationDetail): { steps: JourneyStep[]; next: string | null; tone: 'blue' | 'green' | 'yellow' | 'red' } {
  const offers = detail.offers ?? [];
  const pres = detail.preAdmissions ?? [];
  const acceptedOffer = offers.some((offer) => offer.status === 'ACCEPTED');
  const anyPre = pres.length > 0;
  const docsOk = pres.some((pre) => ['READY_FOR_ASO', 'IN_ASO', 'ASO_CLEARED', 'COMPLETED'].includes(pre.status));
  const asoBlocked = pres.some((pre) => pre.status === 'ASO_BLOCKED');
  const asoCleared = pres.some((pre) => hasClearedAso(pre));
  const admitted = Boolean(detail.admission);
  const evaluated = (detail.evaluations ?? []).length > 0 || (detail.interviews ?? []).length > 0 || (detail.assessments ?? []).length > 0;
  const inactive = detail.status !== 'ACTIVE' && !admitted;

  const state = (done: boolean, current: boolean, blocked = false): JourneyStep['state'] =>
    done ? 'done' : blocked ? 'blocked' : current ? 'current' : 'todo';

  const steps: JourneyStep[] = [
    { key: 'apply', label: 'Candidatura', state: 'done' },
    { key: 'select', label: 'Avaliação e entrevistas', state: state(acceptedOffer || offers.length > 0 || admitted, !inactive && !offers.length) },
    { key: 'offer', label: 'Proposta', state: state(acceptedOffer || admitted, !inactive && offers.length > 0 && !acceptedOffer) },
    { key: 'prehire', label: 'Pré-admissão', state: state(docsOk || admitted, !inactive && acceptedOffer && anyPre && !docsOk) },
    { key: 'aso', label: 'ASO', state: state(asoCleared || admitted, !inactive && docsOk && !asoCleared, asoBlocked) },
    { key: 'admission', label: 'Admissão', state: state(admitted, !inactive && asoCleared && acceptedOffer) },
  ];

  let next: string | null;
  let tone: 'blue' | 'green' | 'yellow' | 'red' = 'blue';
  if (admitted) {
    next = 'processo concluído — acompanhe o onboarding e as avaliações de experiência abaixo.';
    tone = 'green';
  } else if (detail.status === 'REJECTED') {
    next = 'candidatura rejeitada — sem ações pendentes.';
    tone = 'red';
  } else if (detail.status === 'WITHDRAWN') {
    next = 'o candidato desistiu do processo — sem ações pendentes.';
    tone = 'yellow';
  } else if (asoCleared && acceptedOffer) {
    next = 'preencha os dados do eSocial e autorize a admissão (seção Admissão).';
  } else if (asoBlocked) {
    next = 'ASO com pendência — avalie com a Saúde Ocupacional antes de seguir.';
    tone = 'red';
  } else if (docsOk && anyPre) {
    next = 'solicite/acompanhe o ASO admissional (seção Pré-admissão).';
  } else if (anyPre) {
    next = 'revise os documentos que o candidato enviar na pré-admissão.';
  } else if (acceptedOffer) {
    next = 'proposta aceita — inicie a pré-admissão para pedir os documentos.';
  } else if (offers.some((offer) => offer.status === 'SENT')) {
    next = 'aguardando resposta do candidato à proposta enviada.';
    tone = 'yellow';
  } else if (offers.some((offer) => ['DRAFT', 'PENDING_APPROVAL', 'APPROVED'].includes(offer.status))) {
    next = 'aprove e envie a proposta preparada (seção Proposta).';
  } else if (evaluated) {
    next = 'com as avaliações feitas, decida: preparar proposta ou rejeitar.';
  } else {
    next = 'avalie com o scorecard, agende entrevista ou mova o candidato de etapa.';
  }
  return { steps, next, tone };
}

function badge(map: Record<string, { label: string; tone: 'green' | 'yellow' | 'red' | 'gray' | 'blue' | 'purple' }>, value: string | null | undefined) {
  const meta = metaOf(map, value);
  return { label: meta.label, tone: meta.tone };
}

function hasClearedAso(pre: PreAdmission) {
  return (pre.occupationalExamRequests ?? []).some((aso) => aso.status === 'COMPLETED' && ['APTO', 'APTO_COM_RESTRICAO'].includes(aso.asoRecord?.result ?? ''));
}

function downloadBase64(doc: StoredContent) {
  const bytes = Uint8Array.from(atob(doc.contentBase64), (char) => char.charCodeAt(0));
  const url = URL.createObjectURL(new Blob([bytes], { type: doc.mimeType }));
  const link = document.createElement('a');
  link.href = url;
  link.download = doc.fileName;
  link.click();
  URL.revokeObjectURL(url);
}

function formatBytes(value: number) {
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / 1024 / 1024).toFixed(1)} MB`;
}

function formatAnswer(answer: unknown): string {
  if (answer === undefined || answer === null || answer === '') return '—';
  if (typeof answer === 'boolean') return answer ? 'Sim' : 'Não';
  if (Array.isArray(answer)) return answer.map(formatAnswer).join(', ');
  if (typeof answer === 'object') return JSON.stringify(answer);
  return String(answer);
}

function averageScore(ratings: Array<{ score: number; criterion: ScoreCriterion }>) {
  if (!ratings.length) return 'sem notas';
  const totalWeight = ratings.reduce((sum, rating) => sum + (rating.criterion?.weight ?? 1), 0);
  const score = ratings.reduce((sum, rating) => sum + rating.score * (rating.criterion?.weight ?? 1), 0) / Math.max(totalWeight, 1);
  return `média ponderada ${score.toFixed(1)}`;
}

function AiList({ label, value }: { label: string; value: unknown }) {
  const items = toItems(value);
  if (!items.length) return null;
  return (
    <div className="mt-2">
      <div className="text-[10px] font-semibold uppercase text-muted-foreground">{label}</div>
      <ul className="mt-1 list-disc space-y-1 pl-4 text-[11px] text-muted-foreground">
        {items.slice(0, 4).map((item, index) => <li key={`${label}-${index}`}>{item}</li>)}
      </ul>
    </div>
  );
}

function toItems(value: unknown): string[] {
  if (!value) return [];
  if (Array.isArray(value)) return value.map((item) => formatAnswer(item)).filter((item) => item !== '—');
  if (typeof value === 'object') return Object.entries(value).map(([key, item]) => `${key}: ${formatAnswer(item)}`);
  return [formatAnswer(value)];
}
