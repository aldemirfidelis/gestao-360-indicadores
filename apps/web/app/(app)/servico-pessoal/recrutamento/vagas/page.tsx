'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ArrowLeft, Bot, CalendarClock, Download, ExternalLink, FileText, HeartPulse, MessageSquare, Pause, Send, Star, UserCheck, Users, XCircle } from 'lucide-react';
import Link from 'next/link';
import { PageHeader } from '@/components/shell/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { api } from '@/lib/api';
import { useAuth } from '@/components/auth/auth-provider';
import { cn } from '@/lib/utils';

interface Posting {
  id: string; slug: string; title: string; status: string; visibility: string; pcd: boolean;
  city: string | null; workMode: string | null; contractType: string | null;
  publicDescription: string | null; publicRequirements: string | null; benefitsText: string | null;
  processStepsText: string | null; showSalary: boolean; salaryText: string | null; closesAt: string | null;
  pipelineTemplateId: string | null; pipelineTemplate?: { name: string } | null;
  _count?: { applications: number };
}
interface Pipeline { id: string; name: string; isDefault: boolean }
interface PipelineStage { id: string; name: string; order: number }
interface CandidateApplication {
  id: string;
  status: string;
  appliedAt: string;
  currentStageId: string | null;
  coverLetter: string | null;
  score: number | null;
  candidate: { id: string; name: string; email: string; phone: string | null; city: string | null; headline: string | null };
  stage: { id: string; name: string; order: number } | null;
  _count?: { documents: number };
}
interface ApplicationDetail extends CandidateApplication {
  posting: { id: string; title: string; slug: string; pipelineTemplateId: string | null };
  documents: Array<{ id: string; kind: string; fileName: string; mimeType: string; sizeBytes: number; scanStatus: string; createdAt: string }>;
  events: Array<{ id: string; type: string; note: string | null; actorType: string; createdAt: string; fromStageId: string | null; toStageId: string | null }>;
  screeningAnswers?: Array<{ id: string; answer: unknown; passed: boolean | null; question: ScreeningQuestion }>;
  evaluations?: Array<{ id: string; evaluatorId: string; status: string; recommendation: string | null; summary: string | null; createdAt: string; ratings: Array<{ score: number; criterion: ScoreCriterion }> }>;
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
interface ScreeningQuestion { id: string; order: number; type: string; question: string; required: boolean; knockout: boolean; desiredAnswer: unknown; options: unknown; weight: number }
interface ScoreCriterion { id: string; order: number; name: string; description: string | null; category: string | null; weight: number; scaleMin: number; scaleMax: number; required: boolean }
interface AiSetting { enabled: boolean; sensitiveFiltering: boolean; modelPreference: string | null }
interface QuestionDraft { question: string; type: string; required: boolean; knockout: boolean; desiredAnswer: string; options: string; weight: number }
interface CriterionDraft { name: string; category: string; weight: number; scaleMin: number; scaleMax: number }
interface Offer {
  id: string; status: string; revision: number; salaryAmountCents: number; currency: string; salaryMinCents: number | null; salaryMaxCents: number | null;
  approvalRequired: boolean; withinSalaryBand: boolean; startDate: string | null; expiresAt: string | null; sentAt: string | null; acceptedAt: string | null; declinedAt: string | null; justification: string | null;
}
interface PreAdmissionDocument {
  id: string; kind: string; title: string; required: boolean; status: string; reviewNote: string | null; candidateDocumentId: string | null;
  candidateDocument?: { fileName: string; sizeBytes: number } | null;
}
interface OccupationalAppointment {
  id: string; status: string; scheduledAt: string; location: string | null; providerName: string | null; instructions: string | null;
}
interface AsoRecord {
  id: string; result: string; examDate: string; validUntil: string | null; reportedAt: string | null;
}
interface OccupationalExamRequest {
  id: string; status: string; examType: string; dueAt: string | null; requestedAt: string; operationalNotes: string | null;
  appointment?: OccupationalAppointment | null; asoRecord?: AsoRecord | null;
}
interface PreAdmission {
  id: string; status: string; admissionTargetDate: string | null; offerId: string | null; documents: PreAdmissionDocument[];
  occupationalExamRequests?: OccupationalExamRequest[];
}
interface ProbationReview {
  id: string; cycleDay: number; dueAt: string; status: string; recommendation: string | null; notes: string | null; completedAt: string | null;
}
interface Admission {
  id: string; status: string; employeeId: string | null; positionId: string | null; onboardingProcessId: string | null; esocialStatus: string; esocialEventId: string | null; admissionDate: string;
  probationReviews?: ProbationReview[];
}
interface AdmissionDraft {
  cpf: string; admissionDate: string; registrationId: string; birthDate: string; sex: string; raceColor: string; pisPasep: string; notes: string;
}

const STATUS_TONE: Record<string, string> = {
  DRAFT: 'bg-slate-100 text-slate-700', PUBLISHED: 'bg-emerald-100 text-emerald-800', PAUSED: 'bg-amber-100 text-amber-800', CLOSED: 'bg-slate-100 text-slate-500',
};

export default function VacanciesPage() {
  const qc = useQueryClient();
  const { hasPermission } = useAuth();
  const canManage = hasPermission(['recruit:manage']);
  const canAdmit = hasPermission(['recruit:admit', 'recruit:manage']);
  const canHealth = hasPermission(['saude:occupational']);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<Partial<Posting>>({});
  const [applicationsPosting, setApplicationsPosting] = useState<Posting | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [questionDraft, setQuestionDraft] = useState<QuestionDraft>({ question: '', type: 'TEXT', required: false, knockout: false, desiredAnswer: '', options: '', weight: 0 });
  const [criterionDraft, setCriterionDraft] = useState<CriterionDraft>({ name: '', category: '', weight: 1, scaleMin: 1, scaleMax: 5 });
  const [ratingDraft, setRatingDraft] = useState<Record<string, number>>({});
  const [evaluationSummary, setEvaluationSummary] = useState('');
  const [recommendation, setRecommendation] = useState('YES');
  const [offerDraft, setOfferDraft] = useState({ salaryAmount: '', startDate: '', expiresAt: '', justification: '' });
  const [admissionDraft, setAdmissionDraft] = useState<AdmissionDraft>({ cpf: '', admissionDate: '', registrationId: '', birthDate: '', sex: '', raceColor: '', pisPasep: '', notes: '' });

  const listQuery = useQuery<Posting[]>({ queryKey: ['recruit-postings'], queryFn: () => api('/recruitment/postings') });
  const pipelinesQuery = useQuery<Pipeline[]>({ queryKey: ['recruit-pipelines'], queryFn: () => api('/recruitment/pipelines') });
  const applicationsQuery = useQuery<CandidateApplication[]>({
    queryKey: ['recruit-posting-applications', applicationsPosting?.id],
    queryFn: () => api(`/recruitment/postings/${applicationsPosting?.id}/applications`),
    enabled: Boolean(applicationsPosting?.id),
  });
  const stagesQuery = useQuery<PipelineStage[]>({
    queryKey: ['recruit-posting-stages', applicationsPosting?.id],
    queryFn: () => api(`/recruitment/postings/${applicationsPosting?.id}/stages`),
    enabled: Boolean(applicationsPosting?.id),
  });
  const detailQuery = useQuery<ApplicationDetail>({
    queryKey: ['recruit-application', detailId],
    queryFn: () => api(`/recruitment/applications/${detailId}`),
    enabled: Boolean(detailId),
  });
  const editQuestionsQuery = useQuery<ScreeningQuestion[]>({
    queryKey: ['recruit-screening-questions', editId],
    queryFn: () => api(`/recruitment/postings/${editId}/screening-questions`),
    enabled: Boolean(editId),
  });
  const editScorecardQuery = useQuery<ScoreCriterion[]>({
    queryKey: ['recruit-scorecard', editId],
    queryFn: () => api(`/recruitment/postings/${editId}/scorecard`),
    enabled: Boolean(editId),
  });
  const appScorecardQuery = useQuery<ScoreCriterion[]>({
    queryKey: ['recruit-scorecard', applicationsPosting?.id],
    queryFn: () => api(`/recruitment/postings/${applicationsPosting?.id}/scorecard`),
    enabled: Boolean(applicationsPosting?.id),
  });
  const aiSettingsQuery = useQuery<AiSetting>({
    queryKey: ['recruit-ai-settings'],
    queryFn: () => api('/recruitment/ai-settings'),
  });

  const invalidate = () => void qc.invalidateQueries({ queryKey: ['recruit-postings'] });
  const invalidateApplications = () => {
    void qc.invalidateQueries({ queryKey: ['recruit-posting-applications', applicationsPosting?.id] });
    if (detailId) void qc.invalidateQueries({ queryKey: ['recruit-application', detailId] });
  };
  const invalidateF4Config = () => {
    void qc.invalidateQueries({ queryKey: ['recruit-screening-questions', editId] });
    void qc.invalidateQueries({ queryKey: ['recruit-scorecard', editId] });
    void qc.invalidateQueries({ queryKey: ['recruit-scorecard', applicationsPosting?.id] });
  };

  const save = useMutation({
    mutationFn: () => api(`/recruitment/postings/${editId}`, { method: 'POST', json: form }),
    onSuccess: () => { toast.success('Vaga atualizada.'); setEditId(null); invalidate(); },
    onError: (e: any) => toast.error(e.message || 'Erro.'),
  });
  const publish = useMutation({
    mutationFn: (id: string) => api(`/recruitment/postings/${id}/publish`, { method: 'POST' }),
    onSuccess: () => { toast.success('Vaga publicada.'); invalidate(); },
    onError: (e: any) => toast.error(e.message || 'Erro ao publicar.'),
  });
  const setStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => api(`/recruitment/postings/${id}/status`, { method: 'POST', json: { status } }),
    onSuccess: () => { toast.success('Status atualizado.'); invalidate(); },
    onError: (e: any) => toast.error(e.message || 'Erro.'),
  });
  const moveApplication = useMutation({
    mutationFn: ({ id, toStageId }: { id: string; toStageId: string }) => api(`/recruitment/applications/${id}/move`, { method: 'POST', json: { toStageId } }),
    onSuccess: () => { toast.success('Candidato movido.'); invalidateApplications(); },
    onError: (e: any) => toast.error(e.message || 'Erro ao mover.'),
  });
  const rejectApplication = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => api(`/recruitment/applications/${id}/reject`, { method: 'POST', json: { reason } }),
    onSuccess: () => { toast.success('Candidatura rejeitada.'); invalidateApplications(); },
    onError: (e: any) => toast.error(e.message || 'Erro ao rejeitar.'),
  });
  const addNote = useMutation({
    mutationFn: ({ id, note }: { id: string; note: string }) => api(`/recruitment/applications/${id}/notes`, { method: 'POST', json: { note } }),
    onSuccess: () => { toast.success('Nota registrada.'); invalidateApplications(); },
    onError: (e: any) => toast.error(e.message || 'Erro ao registrar nota.'),
  });
  const downloadDocument = useMutation({
    mutationFn: (id: string) => api<StoredContent>(`/recruitment/application-documents/${id}`),
    onSuccess: (doc) => downloadBase64(doc),
    onError: (e: any) => toast.error(e.message || 'Erro ao baixar documento.'),
  });
  const saveQuestion = useMutation({
    mutationFn: () => api(`/recruitment/postings/${editId}/screening-questions`, { method: 'POST', json: questionPayload(questionDraft) }),
    onSuccess: () => { toast.success('Pergunta salva.'); setQuestionDraft({ question: '', type: 'TEXT', required: false, knockout: false, desiredAnswer: '', options: '', weight: 0 }); invalidateF4Config(); },
    onError: (e: any) => toast.error(e.message || 'Erro ao salvar pergunta.'),
  });
  const deleteQuestion = useMutation({
    mutationFn: (id: string) => api(`/recruitment/screening-questions/${id}/delete`, { method: 'POST' }),
    onSuccess: () => { toast.success('Pergunta removida.'); invalidateF4Config(); },
    onError: (e: any) => toast.error(e.message || 'Erro ao remover pergunta.'),
  });
  const saveCriterion = useMutation({
    mutationFn: () => api(`/recruitment/postings/${editId}/scorecard`, { method: 'POST', json: criterionDraft }),
    onSuccess: () => { toast.success('Critério salvo.'); setCriterionDraft({ name: '', category: '', weight: 1, scaleMin: 1, scaleMax: 5 }); invalidateF4Config(); },
    onError: (e: any) => toast.error(e.message || 'Erro ao salvar critério.'),
  });
  const deleteCriterion = useMutation({
    mutationFn: (id: string) => api(`/recruitment/scorecard/${id}/delete`, { method: 'POST' }),
    onSuccess: () => { toast.success('Critério removido.'); invalidateF4Config(); },
    onError: (e: any) => toast.error(e.message || 'Erro ao remover critério.'),
  });
  const submitEvaluation = useMutation({
    mutationFn: () => api(`/recruitment/applications/${detailId}/evaluations`, {
      method: 'POST',
      json: {
        recommendation,
        summary: evaluationSummary,
        ratings: (appScorecardQuery.data ?? []).map((criterion) => ({ criterionId: criterion.id, score: ratingDraft[criterion.id] ?? criterion.scaleMin })),
      },
    }),
    onSuccess: () => { toast.success('Avaliação enviada.'); setEvaluationSummary(''); setRatingDraft({}); invalidateApplications(); },
    onError: (e: any) => toast.error(e.message || 'Erro ao avaliar.'),
  });
  const scheduleInterview = useMutation({
    mutationFn: (startsAt: string) => api(`/recruitment/applications/${detailId}/interviews`, { method: 'POST', json: { type: 'RH', startsAt, participants: [], notifyCandidate: true } }),
    onSuccess: () => { toast.success('Entrevista agendada.'); invalidateApplications(); },
    onError: (e: any) => toast.error(e.message || 'Erro ao agendar entrevista.'),
  });
  const saveAssessment = useMutation({
    mutationFn: (title: string) => api(`/recruitment/applications/${detailId}/assessments`, { method: 'POST', json: { title, kind: 'TECHNICAL_TEST' } }),
    onSuccess: () => { toast.success('Teste atribuído.'); invalidateApplications(); },
    onError: (e: any) => toast.error(e.message || 'Erro ao atribuir teste.'),
  });
  const runAi = useMutation({
    mutationFn: () => api(`/recruitment/applications/${detailId}/ai-triage`, { method: 'POST' }),
    onSuccess: () => { toast.success('Triagem assistida gerada.'); invalidateApplications(); },
    onError: (e: any) => toast.error(e.message || 'Erro na triagem assistida.'),
  });
  const updateAiSettings = useMutation({
    mutationFn: (enabled: boolean) => api('/recruitment/ai-settings', { method: 'POST', json: { enabled, sensitiveFiltering: true } }),
    onSuccess: () => { toast.success('Configuração de IA atualizada.'); void qc.invalidateQueries({ queryKey: ['recruit-ai-settings'] }); },
    onError: (e: any) => toast.error(e.message || 'Erro ao atualizar IA.'),
  });

  const saveOffer = useMutation({
    mutationFn: () => api(`/recruitment/applications/${detailId}/offers`, { method: 'POST', json: offerPayload(offerDraft) }),
    onSuccess: () => { toast.success('Proposta preparada.'); setOfferDraft({ salaryAmount: '', startDate: '', expiresAt: '', justification: '' }); invalidateApplications(); },
    onError: (e: any) => toast.error(e.message || 'Erro ao preparar proposta.'),
  });
  const approveOffer = useMutation({
    mutationFn: (id: string) => api(`/recruitment/offers/${id}/approve`, { method: 'POST' }),
    onSuccess: () => { toast.success('Proposta aprovada.'); invalidateApplications(); },
    onError: (e: any) => toast.error(e.message || 'Erro ao aprovar proposta.'),
  });
  const sendOffer = useMutation({
    mutationFn: (id: string) => api(`/recruitment/offers/${id}/send`, { method: 'POST' }),
    onSuccess: () => { toast.success('Proposta enviada.'); invalidateApplications(); },
    onError: (e: any) => toast.error(e.message || 'Erro ao enviar proposta.'),
  });
  const cancelOffer = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) => api(`/recruitment/offers/${id}/cancel`, { method: 'POST', json: { reason } }),
    onSuccess: () => { toast.success('Proposta cancelada.'); invalidateApplications(); },
    onError: (e: any) => toast.error(e.message || 'Erro ao cancelar proposta.'),
  });
  const startPreAdmission = useMutation({
    mutationFn: (offerId?: string) => api(`/recruitment/applications/${detailId}/pre-admissions`, { method: 'POST', json: { offerId } }),
    onSuccess: () => { toast.success('Pre-admissao iniciada.'); invalidateApplications(); },
    onError: (e: any) => toast.error(e.message || 'Erro ao iniciar pre-admissao.'),
  });
  const addPreAdmissionDocument = useMutation({
    mutationFn: ({ preAdmissionId, title }: { preAdmissionId: string; title: string }) => api(`/recruitment/pre-admissions/${preAdmissionId}/documents`, { method: 'POST', json: { title, kind: 'OTHER' } }),
    onSuccess: () => { toast.success('Documento solicitado.'); invalidateApplications(); },
    onError: (e: any) => toast.error(e.message || 'Erro ao solicitar documento.'),
  });
  const reviewPreAdmissionDocument = useMutation({
    mutationFn: ({ id, status, note }: { id: string; status: string; note?: string }) => api(`/recruitment/pre-admission-documents/${id}/review`, { method: 'POST', json: { status, note } }),
    onSuccess: () => { toast.success('Documento revisado.'); invalidateApplications(); },
    onError: (e: any) => toast.error(e.message || 'Erro ao revisar documento.'),
  });
  const requestAso = useMutation({
    mutationFn: (preAdmissionId: string) => api(`/recruitment/applications/${detailId}/occupational-exams`, { method: 'POST', json: { preAdmissionId } }),
    onSuccess: () => { toast.success('ASO admissional solicitado.'); invalidateApplications(); },
    onError: (e: any) => toast.error(e.message || 'Erro ao solicitar ASO.'),
  });
  const scheduleAso = useMutation({
    mutationFn: ({ id, scheduledAt, location, providerName, instructions }: { id: string; scheduledAt: string; location?: string; providerName?: string; instructions?: string }) =>
      api(`/recruitment/occupational-exams/${id}/schedule`, { method: 'POST', json: { scheduledAt, location, providerName, instructions } }),
    onSuccess: () => { toast.success('ASO agendado.'); invalidateApplications(); },
    onError: (e: any) => toast.error(e.message || 'Erro ao agendar ASO.'),
  });
  const recordAsoResult = useMutation({
    mutationFn: ({ id, result, examDate, validUntil, physicianName, clinicalNotes }: { id: string; result: string; examDate: string; validUntil?: string; physicianName?: string; clinicalNotes?: string }) =>
      api(`/recruitment/occupational-exams/${id}/result`, { method: 'POST', json: { result, examDate, validUntil, physicianName, clinicalNotes } }),
    onSuccess: () => { toast.success('Resultado do ASO registrado.'); invalidateApplications(); },
    onError: (e: any) => toast.error(e.message || 'Erro ao registrar ASO.'),
  });
  const cancelAso = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) => api(`/recruitment/occupational-exams/${id}/cancel`, { method: 'POST', json: { reason } }),
    onSuccess: () => { toast.success('ASO cancelado.'); invalidateApplications(); },
    onError: (e: any) => toast.error(e.message || 'Erro ao cancelar ASO.'),
  });
  const authorizeAdmission = useMutation({
    mutationFn: () => api(`/recruitment/applications/${detailId}/admission/authorize`, { method: 'POST', json: admissionPayload(admissionDraft) }),
    onSuccess: () => { toast.success('Admissao autorizada.'); setAdmissionDraft({ cpf: '', admissionDate: '', registrationId: '', birthDate: '', sex: '', raceColor: '', pisPasep: '', notes: '' }); invalidateApplications(); invalidate(); },
    onError: (e: any) => toast.error(e.message || 'Erro ao autorizar admissao.'),
  });
  const completeProbationReview = useMutation({
    mutationFn: ({ id, recommendation, notes }: { id: string; recommendation: string; notes?: string }) =>
      api(`/recruitment/probation-reviews/${id}/complete`, { method: 'POST', json: { recommendation, notes } }),
    onSuccess: () => { toast.success('Avaliacao de experiencia concluida.'); invalidateApplications(); },
    onError: (e: any) => toast.error(e.message || 'Erro ao concluir avaliacao.'),
  });

  const postings = listQuery.data ?? [];
  const openEdit = (p: Posting) => { setForm({ ...p }); setEditId(p.id); };
  const stages = stagesQuery.data ?? [];
  const applications = applicationsQuery.data ?? [];
  const detail = detailQuery.data;
  const editQuestions = editQuestionsQuery.data ?? [];
  const editScorecard = editScorecardQuery.data ?? [];
  const appScorecard = appScorecardQuery.data ?? [];
  const acceptedAdmissionOffer = detail?.offers?.find((offer) => offer.status === 'ACCEPTED') ?? null;
  const readyAdmissionPre = detail?.preAdmissions?.find((pre) => ['ASO_CLEARED', 'COMPLETED'].includes(pre.status) && hasClearedAso(pre)) ?? null;
  const canAuthorizeAdmission = Boolean(detail && canAdmit && !detail.admission && acceptedAdmissionOffer && readyAdmissionPre && detail.status === 'ACTIVE');

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link href="/servico-pessoal/recrutamento" className="flex items-center gap-1 hover:text-foreground"><ArrowLeft className="h-4 w-4" /> Requisições</Link>
      </div>
      <PageHeader title="Vagas" description="Vagas criadas a partir de requisições encaminhadas. Edite o texto de divulgação e publique. A descrição técnica original fica protegida." />

      <Card>
        <CardContent className="p-0">
          {postings.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">Nenhuma vaga. Crie a partir de uma requisição em recrutamento.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b bg-muted/40 text-[10px] uppercase text-muted-foreground">
                  <tr><th className="p-3">Vaga</th><th className="p-3">Visibilidade</th><th className="p-3">Pipeline</th><th className="p-3">Candidatos</th><th className="p-3">Status</th><th className="p-3"></th></tr>
                </thead>
                <tbody className="divide-y">
                  {postings.map((p) => (
                    <tr key={p.id} className="hover:bg-muted/20">
                      <td className="p-3"><div className="font-medium">{p.title}</div><div className="text-[10px] text-muted-foreground">{[p.city, p.workMode, p.contractType].filter(Boolean).join(' · ')}</div></td>
                      <td className="p-3 text-xs">{p.visibility}{p.pcd && <Badge variant="outline" className="ml-1 text-[8px]">PcD</Badge>}</td>
                      <td className="p-3 text-xs">{p.pipelineTemplate?.name ?? '—'}</td>
                      <td className="p-3 text-xs">{p._count?.applications ?? 0}</td>
                      <td className="p-3"><Badge variant="outline" className={cn('text-[10px]', STATUS_TONE[p.status])}>{p.status}</Badge></td>
                      <td className="p-3 text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="sm" onClick={() => { setApplicationsPosting(p); setDetailId(null); }}><Users className="mr-1 h-3.5 w-3.5" /> Candidatos</Button>
                          {canManage && <Button variant="ghost" size="sm" onClick={() => openEdit(p)}>Editar</Button>}
                          {canManage && p.status === 'DRAFT' && <Button variant="outline" size="sm" onClick={() => publish.mutate(p.id)}><Send className="mr-1 h-3.5 w-3.5" /> Publicar</Button>}
                          {canManage && p.status === 'PUBLISHED' && <Button variant="ghost" size="sm" onClick={() => setStatus.mutate({ id: p.id, status: 'PAUSED' })}><Pause className="h-3.5 w-3.5" /></Button>}
                          {p.status === 'PUBLISHED' && <a href={`/carreiras/vagas/${p.slug}`} target="_blank" rel="noreferrer"><Button variant="ghost" size="sm"><ExternalLink className="h-3.5 w-3.5" /></Button></a>}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={Boolean(editId)} onOpenChange={(o) => !o && setEditId(null)}>
        <DialogContent className="sm:max-w-[620px]">
          <DialogHeader><DialogTitle>Editar vaga (texto de divulgação)</DialogTitle></DialogHeader>
          <div className="max-h-[70vh] space-y-3 overflow-y-auto pr-1">
            <div><Label>Título público</Label><Input value={form.title ?? ''} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} /></div>
            <div><Label>Descrição pública</Label><Textarea rows={4} value={form.publicDescription ?? ''} onChange={(e) => setForm((f) => ({ ...f, publicDescription: e.target.value }))} /></div>
            <div><Label>Requisitos (público)</Label><Textarea rows={3} value={form.publicRequirements ?? ''} onChange={(e) => setForm((f) => ({ ...f, publicRequirements: e.target.value }))} /></div>
            <div><Label>Benefícios</Label><Textarea rows={2} value={form.benefitsText ?? ''} onChange={(e) => setForm((f) => ({ ...f, benefitsText: e.target.value }))} /></div>
            <div><Label>Etapas do processo</Label><Textarea rows={2} value={form.processStepsText ?? ''} onChange={(e) => setForm((f) => ({ ...f, processStepsText: e.target.value }))} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Cidade</Label><Input value={form.city ?? ''} onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))} /></div>
              <div><Label>Modalidade</Label>
                <NativeSelect value={form.workMode ?? ''} onChange={(e) => setForm((f) => ({ ...f, workMode: e.target.value }))}>
                  <option value="">—</option><option value="PRESENCIAL">Presencial</option><option value="HIBRIDO">Híbrido</option><option value="REMOTO">Remoto</option>
                </NativeSelect>
              </div>
              <div><Label>Visibilidade</Label>
                <NativeSelect value={form.visibility ?? 'PUBLIC'} onChange={(e) => setForm((f) => ({ ...f, visibility: e.target.value }))}>
                  <option value="PUBLIC">Pública</option><option value="INTERNAL">Interna</option><option value="BOTH">Interna e externa</option><option value="CONFIDENTIAL">Confidencial</option>
                </NativeSelect>
              </div>
              <div><Label>Pipeline</Label>
                <NativeSelect value={form.pipelineTemplateId ?? ''} onChange={(e) => setForm((f) => ({ ...f, pipelineTemplateId: e.target.value }))}>
                  {(pipelinesQuery.data ?? []).map((pl) => <option key={pl.id} value={pl.id}>{pl.name}</option>)}
                </NativeSelect>
              </div>
              <div><Label>Encerra em</Label><Input type="date" value={form.closesAt ? String(form.closesAt).slice(0, 10) : ''} onChange={(e) => setForm((f) => ({ ...f, closesAt: e.target.value }))} /></div>
              <div className="flex items-end"><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.pcd ?? false} onChange={(e) => setForm((f) => ({ ...f, pcd: e.target.checked }))} /> Vaga PcD</label></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.showSalary ?? false} onChange={(e) => setForm((f) => ({ ...f, showSalary: e.target.checked }))} /> Exibir faixa salarial</label>
              {form.showSalary && <Input placeholder="Ex.: R$ 4.000 a R$ 5.000" value={form.salaryText ?? ''} onChange={(e) => setForm((f) => ({ ...f, salaryText: e.target.value }))} />}
            </div>

            <div className="rounded-md border p-3">
              <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase text-muted-foreground"><FileText className="h-3.5 w-3.5" /> Triagem</div>
              <div className="grid gap-2 md:grid-cols-[1fr_120px]">
                <Input placeholder="Pergunta ao candidato" value={questionDraft.question} onChange={(e) => setQuestionDraft((f) => ({ ...f, question: e.target.value }))} />
                <NativeSelect value={questionDraft.type} onChange={(e) => setQuestionDraft((f) => ({ ...f, type: e.target.value }))}>
                  <option value="TEXT">Texto</option><option value="YES_NO">Sim/Não</option><option value="SINGLE_CHOICE">Escolha única</option><option value="MULTI_CHOICE">Múltipla</option><option value="NUMBER">Número</option>
                </NativeSelect>
              </div>
              <div className="mt-2 grid gap-2 md:grid-cols-[1fr_1fr_80px_auto]">
                <Input placeholder="Resposta esperada" value={questionDraft.desiredAnswer} onChange={(e) => setQuestionDraft((f) => ({ ...f, desiredAnswer: e.target.value }))} />
                <Input placeholder="Opções separadas por ;" value={questionDraft.options} onChange={(e) => setQuestionDraft((f) => ({ ...f, options: e.target.value }))} />
                <Input type="number" value={questionDraft.weight} onChange={(e) => setQuestionDraft((f) => ({ ...f, weight: Number(e.target.value) }))} />
                <Button size="sm" onClick={() => saveQuestion.mutate()} disabled={!questionDraft.question || saveQuestion.isPending}>Adicionar</Button>
              </div>
              <div className="mt-2 flex gap-4 text-xs">
                <label className="flex items-center gap-1"><input type="checkbox" checked={questionDraft.required} onChange={(e) => setQuestionDraft((f) => ({ ...f, required: e.target.checked }))} /> Obrigatória</label>
                <label className="flex items-center gap-1"><input type="checkbox" checked={questionDraft.knockout} onChange={(e) => setQuestionDraft((f) => ({ ...f, knockout: e.target.checked }))} /> Eliminatória sinalizada</label>
              </div>
              <div className="mt-3 divide-y rounded-md border">
                {editQuestions.length === 0 && <div className="p-2 text-xs text-muted-foreground">Nenhuma pergunta configurada.</div>}
                {editQuestions.map((q) => (
                  <div key={q.id} className="flex items-center gap-2 p-2 text-xs">
                    <div className="min-w-0 flex-1 truncate">{q.order}. {q.question} {q.required && <Badge variant="outline" className="ml-1 text-[8px]">obr.</Badge>} {q.knockout && <Badge variant="outline" className="ml-1 text-[8px]">elim.</Badge>}</div>
                    <Button variant="ghost" size="sm" onClick={() => deleteQuestion.mutate(q.id)}>Remover</Button>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-md border p-3">
              <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase text-muted-foreground"><Star className="h-3.5 w-3.5" /> Scorecard</div>
              <div className="grid gap-2 md:grid-cols-[1fr_120px_80px_80px_80px_auto]">
                <Input placeholder="Critério" value={criterionDraft.name} onChange={(e) => setCriterionDraft((f) => ({ ...f, name: e.target.value }))} />
                <Input placeholder="Categoria" value={criterionDraft.category} onChange={(e) => setCriterionDraft((f) => ({ ...f, category: e.target.value }))} />
                <Input type="number" value={criterionDraft.weight} onChange={(e) => setCriterionDraft((f) => ({ ...f, weight: Number(e.target.value) }))} />
                <Input type="number" value={criterionDraft.scaleMin} onChange={(e) => setCriterionDraft((f) => ({ ...f, scaleMin: Number(e.target.value) }))} />
                <Input type="number" value={criterionDraft.scaleMax} onChange={(e) => setCriterionDraft((f) => ({ ...f, scaleMax: Number(e.target.value) }))} />
                <Button size="sm" onClick={() => saveCriterion.mutate()} disabled={!criterionDraft.name || saveCriterion.isPending}>Adicionar</Button>
              </div>
              <div className="mt-3 divide-y rounded-md border">
                {editScorecard.length === 0 && <div className="p-2 text-xs text-muted-foreground">Nenhum critério configurado.</div>}
                {editScorecard.map((c) => (
                  <div key={c.id} className="flex items-center gap-2 p-2 text-xs">
                    <div className="min-w-0 flex-1 truncate">{c.order}. {c.name} · peso {c.weight} · escala {c.scaleMin}-{c.scaleMax}</div>
                    <Button variant="ghost" size="sm" onClick={() => deleteCriterion.mutate(c.id)}>Remover</Button>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditId(null)}>Cancelar</Button>
            <Button onClick={() => save.mutate()} disabled={save.isPending}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(applicationsPosting)} onOpenChange={(o) => { if (!o) { setApplicationsPosting(null); setDetailId(null); } }}>
        <DialogContent className="sm:max-w-[900px]">
          <DialogHeader><DialogTitle>Candidatos — {applicationsPosting?.title}</DialogTitle></DialogHeader>
          <div className="grid max-h-[72vh] gap-4 overflow-y-auto pr-1 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="space-y-2">
              {applicationsQuery.isLoading && <div className="py-8 text-center text-sm text-muted-foreground">Carregando candidatos...</div>}
              {!applicationsQuery.isLoading && applications.length === 0 && <div className="rounded-md border border-dashed py-8 text-center text-sm text-muted-foreground">Nenhuma candidatura recebida.</div>}
              {applications.map((app) => (
                <div key={app.id} className={cn('rounded-md border p-3 text-sm transition hover:bg-muted/20', detailId === app.id && 'border-primary bg-primary/5')}>
                  <div className="flex items-start justify-between gap-2">
                    <button className="min-w-0 text-left" onClick={() => setDetailId(app.id)}>
                      <div className="truncate font-semibold">{app.candidate.name}</div>
                      <div className="truncate text-[11px] text-muted-foreground">{[app.candidate.email, app.candidate.city, app.candidate.headline].filter(Boolean).join(' · ')}</div>
                    </button>
                    <Badge variant="outline" className={cn('text-[9px]', app.status === 'ACTIVE' ? 'text-emerald-700' : 'text-muted-foreground')}>{app.status}</Badge>
                  </div>
                  <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto_auto]">
                    <NativeSelect
                      value={app.currentStageId ?? ''}
                      disabled={!canManage || app.status !== 'ACTIVE' || stages.length === 0}
                      onChange={(e) => moveApplication.mutate({ id: app.id, toStageId: e.target.value })}
                      className="h-8 text-xs"
                    >
                      <option value="">Sem etapa</option>
                      {stages.map((stage) => <option key={stage.id} value={stage.id}>{stage.order}. {stage.name}</option>)}
                    </NativeSelect>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={!canManage}
                      onClick={() => {
                        const note = prompt('Nota interna sobre o candidato:');
                        if (note) addNote.mutate({ id: app.id, note });
                      }}
                    >
                      <MessageSquare className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-rose-600"
                      disabled={!canManage || app.status !== 'ACTIVE'}
                      onClick={() => {
                        const reason = prompt('Motivo da rejeição:');
                        if (reason) rejectApplication.mutate({ id: app.id, reason });
                      }}
                    >
                      <XCircle className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            <div className="rounded-md border p-3">
              {!detailId && <div className="py-10 text-center text-sm text-muted-foreground">Selecione um candidato para ver detalhes.</div>}
              {detailQuery.isLoading && <div className="py-10 text-center text-sm text-muted-foreground">Carregando detalhe...</div>}
              {detail && (
                <div className="space-y-4 text-sm">
                  <div>
                    <div className="font-semibold">{detail.candidate.name}</div>
                    <div className="text-xs text-muted-foreground">{detail.candidate.email}{detail.candidate.phone ? ` · ${detail.candidate.phone}` : ''}</div>
                  </div>
                  {detail.coverLetter && (
                    <div>
                      <div className="text-[10px] font-semibold uppercase text-muted-foreground">Mensagem</div>
                      <p className="mt-1 whitespace-pre-wrap rounded-md bg-muted/40 p-3 text-xs">{detail.coverLetter}</p>
                    </div>
                  )}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-[10px] font-semibold uppercase text-muted-foreground">Triagem</div>
                      {typeof detail.score === 'number' && <Badge variant="outline" className="text-[9px]">score {detail.score}</Badge>}
                    </div>
                    <div className="divide-y rounded-md border">
                      {(detail.screeningAnswers ?? []).length === 0 && <div className="p-3 text-xs text-muted-foreground">Sem perguntas respondidas.</div>}
                      {(detail.screeningAnswers ?? []).map((answer) => (
                        <div key={answer.id} className="p-2 text-xs">
                          <div className="flex items-start justify-between gap-2">
                            <div className="font-medium">{answer.question.question}</div>
                            {answer.passed === true && <Badge variant="outline" className="text-[8px] text-emerald-700">ok</Badge>}
                            {answer.passed === false && <Badge variant="outline" className="text-[8px] text-amber-700">atenção</Badge>}
                          </div>
                          <div className="mt-1 text-muted-foreground">{formatAnswer(answer.answer)}</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-md border p-3">
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 text-[10px] font-semibold uppercase text-muted-foreground"><Star className="h-3.5 w-3.5" /> Avaliação</div>
                      <NativeSelect value={recommendation} onChange={(e) => setRecommendation(e.target.value)} className="h-8 w-32 text-xs" disabled={!canManage}>
                        <option value="STRONG_YES">Forte sim</option>
                        <option value="YES">Sim</option>
                        <option value="NEUTRAL">Neutro</option>
                        <option value="NO">Não</option>
                        <option value="STRONG_NO">Forte não</option>
                      </NativeSelect>
                    </div>
                    {appScorecard.length === 0 ? (
                      <div className="rounded-md bg-muted/40 p-3 text-xs text-muted-foreground">Configure o scorecard da vaga para avaliar candidatos.</div>
                    ) : (
                      <div className="space-y-2">
                        {appScorecard.map((criterion) => (
                          <label key={criterion.id} className="grid grid-cols-[1fr_72px] items-center gap-2 text-xs">
                            <span className="min-w-0">
                              <span className="block truncate font-medium">{criterion.name}</span>
                              <span className="text-[10px] text-muted-foreground">peso {criterion.weight} · escala {criterion.scaleMin}-{criterion.scaleMax}</span>
                            </span>
                            <Input
                              type="number"
                              min={criterion.scaleMin}
                              max={criterion.scaleMax}
                              value={ratingDraft[criterion.id] ?? criterion.scaleMin}
                              disabled={!canManage}
                              onChange={(e) => setRatingDraft((current) => ({ ...current, [criterion.id]: Number(e.target.value) }))}
                              className="h-8 text-xs"
                            />
                          </label>
                        ))}
                        <Textarea rows={2} placeholder="Resumo da avaliação" value={evaluationSummary} onChange={(e) => setEvaluationSummary(e.target.value)} disabled={!canManage} />
                        <Button size="sm" onClick={() => submitEvaluation.mutate()} disabled={!canManage || submitEvaluation.isPending}>Enviar avaliação</Button>
                      </div>
                    )}
                    <div className="mt-3 space-y-2">
                      {(detail.evaluations ?? []).length === 0 && <div className="text-xs text-muted-foreground">Avaliações de outros avaliadores ficam ocultas até você enviar a sua.</div>}
                      {(detail.evaluations ?? []).map((evaluation) => (
                        <div key={evaluation.id} className="rounded-md bg-muted/40 p-2 text-xs">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-medium">{formatRecommendation(evaluation.recommendation)}</span>
                            <span className="text-muted-foreground">{averageScore(evaluation.ratings)}</span>
                          </div>
                          {evaluation.summary && <div className="mt-1 text-muted-foreground">{evaluation.summary}</div>}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-md border p-3">
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <div className="mr-auto flex items-center gap-2 text-[10px] font-semibold uppercase text-muted-foreground"><CalendarClock className="h-3.5 w-3.5" /> Entrevistas e testes</div>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={!canManage || scheduleInterview.isPending}
                        onClick={() => {
                          const startsAt = window.prompt('Data/hora da entrevista (AAAA-MM-DDTHH:mm):', new Date(Date.now() + 86400000).toISOString().slice(0, 16));
                          if (startsAt) scheduleInterview.mutate(startsAt);
                        }}
                      >
                        Entrevista
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={!canManage || saveAssessment.isPending}
                        onClick={() => {
                          const title = window.prompt('Título do teste ou case:');
                          if (title) saveAssessment.mutate(title);
                        }}
                      >
                        Teste
                      </Button>
                    </div>
                    <div className="space-y-2">
                      {(detail.interviews ?? []).map((interview) => (
                        <div key={interview.id} className="rounded-md bg-muted/40 p-2 text-xs">
                          <div className="font-medium">{interview.type} · {interview.status}</div>
                          <div className="text-muted-foreground">{formatDateTime(interview.startsAt)}{interview.location ? ` · ${interview.location}` : ''}{interview.meetingUrl ? ` · ${interview.meetingUrl}` : ''}</div>
                        </div>
                      ))}
                      {(detail.assessments ?? []).map((assessment) => (
                        <div key={assessment.id} className="rounded-md bg-muted/40 p-2 text-xs">
                          <div className="font-medium">{assessment.title} · {assessment.status}</div>
                          <div className="text-muted-foreground">{assessment.kind}{typeof assessment.score === 'number' ? ` · nota ${assessment.score}` : ''}{assessment.dueAt ? ` · prazo ${formatDateTime(assessment.dueAt)}` : ''}</div>
                        </div>
                      ))}
                      {(detail.interviews ?? []).length === 0 && (detail.assessments ?? []).length === 0 && <div className="text-xs text-muted-foreground">Nenhuma entrevista ou teste registrado.</div>}
                    </div>
                  </div>

                  <div className="rounded-md border p-3">
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <div className="mr-auto flex items-center gap-2 text-[10px] font-semibold uppercase text-muted-foreground"><Bot className="h-3.5 w-3.5" /> IA assistida</div>
                      <label className="flex items-center gap-1 text-xs text-muted-foreground">
                        <input
                          type="checkbox"
                          checked={aiSettingsQuery.data?.enabled ?? false}
                          disabled={!canManage || updateAiSettings.isPending}
                          onChange={(e) => updateAiSettings.mutate(e.target.checked)}
                        />
                        ativa
                      </label>
                      <Button size="sm" variant="outline" disabled={!canManage || !aiSettingsQuery.data?.enabled || runAi.isPending} onClick={() => runAi.mutate()}>
                        Triar
                      </Button>
                    </div>
                    <div className="space-y-2">
                      {(detail.aiAnalyses ?? []).length === 0 && <div className="text-xs text-muted-foreground">Sem análise assistida. A IA nunca aprova nem rejeita automaticamente.</div>}
                      {(detail.aiAnalyses ?? []).map((analysis) => (
                        <div key={analysis.id} className="rounded-md bg-muted/40 p-2 text-xs">
                          <div className="flex flex-wrap items-center gap-1">
                            <Badge variant="outline" className="text-[8px]">{analysis.provider}{analysis.model ? `/${analysis.model}` : ''}</Badge>
                            <Badge variant="outline" className="text-[8px]">{analysis.promptVersion}</Badge>
                            {analysis.humanReviewRequired && <Badge variant="outline" className="text-[8px] text-amber-700">revisão humana</Badge>}
                            {typeof analysis.confidence === 'number' && <span className="ml-auto text-[10px] text-muted-foreground">{Math.round(analysis.confidence * 100)}%</span>}
                          </div>
                          <div className="mt-2 whitespace-pre-wrap">{analysis.summary}</div>
                          <AiPreview label="Evidências" value={analysis.evidence} />
                          <AiPreview label="Lacunas" value={analysis.missingRequirements} />
                          <AiPreview label="Riscos" value={analysis.risks} />
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-md border p-3">
                    <div className="mb-2 flex items-center gap-2 text-[10px] font-semibold uppercase text-muted-foreground"><Send className="h-3.5 w-3.5" /> Proposta</div>
                    <div className="grid gap-2 sm:grid-cols-2">
                      <Input placeholder="Salario mensal. Ex.: 4500,00" value={offerDraft.salaryAmount} onChange={(e) => setOfferDraft((f) => ({ ...f, salaryAmount: e.target.value }))} disabled={!canManage} />
                      <Input type="date" value={offerDraft.startDate} onChange={(e) => setOfferDraft((f) => ({ ...f, startDate: e.target.value }))} disabled={!canManage} />
                      <Input type="date" value={offerDraft.expiresAt} onChange={(e) => setOfferDraft((f) => ({ ...f, expiresAt: e.target.value }))} disabled={!canManage} />
                      <Input placeholder="Justificativa se fora da faixa" value={offerDraft.justification} onChange={(e) => setOfferDraft((f) => ({ ...f, justification: e.target.value }))} disabled={!canManage} />
                    </div>
                    <Button className="mt-2" size="sm" onClick={() => saveOffer.mutate()} disabled={!canManage || !offerDraft.salaryAmount || saveOffer.isPending}>Preparar proposta</Button>
                    <div className="mt-3 space-y-2">
                      {(detail.offers ?? []).length === 0 && <div className="text-xs text-muted-foreground">Nenhuma proposta preparada.</div>}
                      {(detail.offers ?? []).map((offer) => (
                        <div key={offer.id} className="rounded-md bg-muted/40 p-2 text-xs">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-medium">Rev. {offer.revision} · {formatMoney(offer.salaryAmountCents, offer.currency)}</span>
                            <Badge variant="outline" className="text-[8px]">{offer.status}</Badge>
                            {offer.approvalRequired && <Badge variant="outline" className="text-[8px] text-amber-700">fora da faixa</Badge>}
                          </div>
                          <div className="mt-1 text-muted-foreground">
                            Faixa: {formatMoney(offer.salaryMinCents, offer.currency)} a {formatMoney(offer.salaryMaxCents, offer.currency)}
                            {offer.startDate ? ` · inicio ${formatDateTime(offer.startDate).slice(0, 10)}` : ''}
                            {offer.expiresAt ? ` · validade ${formatDateTime(offer.expiresAt).slice(0, 10)}` : ''}
                          </div>
                          {offer.justification && <div className="mt-1 text-muted-foreground">{offer.justification}</div>}
                          <div className="mt-2 flex flex-wrap gap-1">
                            {['DRAFT', 'PENDING_APPROVAL'].includes(offer.status) && <Button size="sm" variant="outline" disabled={!canManage || approveOffer.isPending} onClick={() => approveOffer.mutate(offer.id)}>Aprovar</Button>}
                            {['DRAFT', 'APPROVED'].includes(offer.status) && <Button size="sm" variant="outline" disabled={!canManage || sendOffer.isPending} onClick={() => sendOffer.mutate(offer.id)}>Enviar</Button>}
                            {offer.status === 'ACCEPTED' && <Button size="sm" variant="outline" disabled={!canManage || startPreAdmission.isPending} onClick={() => startPreAdmission.mutate(offer.id)}>Pré-admissão</Button>}
                            {!['ACCEPTED', 'DECLINED', 'CANCELLED'].includes(offer.status) && <Button size="sm" variant="ghost" className="text-rose-600" disabled={!canManage || cancelOffer.isPending} onClick={() => cancelOffer.mutate({ id: offer.id, reason: window.prompt('Motivo do cancelamento:') ?? undefined })}>Cancelar</Button>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-md border p-3">
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <div className="mr-auto text-[10px] font-semibold uppercase text-muted-foreground">Pré-admissão</div>
                      <Button size="sm" variant="outline" disabled={!canManage || startPreAdmission.isPending} onClick={() => startPreAdmission.mutate(undefined)}>Iniciar</Button>
                    </div>
                    <div className="space-y-2">
                      {(detail.preAdmissions ?? []).length === 0 && <div className="text-xs text-muted-foreground">Nenhum checklist de pré-admissão aberto.</div>}
                      {(detail.preAdmissions ?? []).map((pre) => (
                        <div key={pre.id} className="rounded-md bg-muted/40 p-2 text-xs">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-medium">{pre.status}</span>
                            <Button
                              size="sm"
                              variant="ghost"
                              disabled={!canManage || addPreAdmissionDocument.isPending}
                              onClick={() => {
                                const title = window.prompt('Documento adicional:');
                                if (title) addPreAdmissionDocument.mutate({ preAdmissionId: pre.id, title });
                              }}
                            >
                              Solicitar doc.
                            </Button>
                          </div>
                          <div className="mt-2 divide-y rounded-md border bg-background">
                            {pre.documents.map((doc) => (
                              <div key={doc.id} className="p-2">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="font-medium">{doc.title}</span>
                                  <Badge variant="outline" className="text-[8px]">{doc.status}</Badge>
                                  {doc.required && <Badge variant="outline" className="text-[8px]">obrigatório</Badge>}
                                </div>
                                {doc.candidateDocument && <div className="mt-1 text-muted-foreground">{doc.candidateDocument.fileName} · {formatBytes(doc.candidateDocument.sizeBytes)}</div>}
                                {doc.reviewNote && <div className="mt-1 text-muted-foreground">{doc.reviewNote}</div>}
                                {['SUBMITTED', 'REJECTED'].includes(doc.status) && (
                                  <div className="mt-2 flex gap-1">
                                    <Button size="sm" variant="outline" disabled={!canManage || reviewPreAdmissionDocument.isPending} onClick={() => reviewPreAdmissionDocument.mutate({ id: doc.id, status: 'APPROVED' })}>Aprovar</Button>
                                    <Button size="sm" variant="outline" disabled={!canManage || reviewPreAdmissionDocument.isPending} onClick={() => reviewPreAdmissionDocument.mutate({ id: doc.id, status: 'REJECTED', note: window.prompt('Motivo da rejeição:') ?? undefined })}>Rejeitar</Button>
                                    <Button size="sm" variant="ghost" disabled={!canManage || reviewPreAdmissionDocument.isPending} onClick={() => reviewPreAdmissionDocument.mutate({ id: doc.id, status: 'WAIVED' })}>Dispensar</Button>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                          <div className="mt-3 rounded-md border bg-background p-2">
                            <div className="mb-2 flex flex-wrap items-center gap-2">
                              <div className="mr-auto flex items-center gap-1 text-[10px] font-semibold uppercase text-muted-foreground"><HeartPulse className="h-3.5 w-3.5" /> ASO admissional</div>
                              {['READY_FOR_ASO', 'ASO_BLOCKED'].includes(pre.status) && !(pre.occupationalExamRequests ?? []).some((aso) => ['REQUESTED', 'SCHEDULED'].includes(aso.status)) && (
                                <Button size="sm" variant="outline" disabled={!canManage || requestAso.isPending} onClick={() => requestAso.mutate(pre.id)}>Solicitar ASO</Button>
                              )}
                            </div>
                            {(pre.occupationalExamRequests ?? []).length === 0 && (
                              <div className="text-[11px] text-muted-foreground">
                                {pre.status === 'READY_FOR_ASO' ? 'Documentos liberados para solicitar ASO.' : 'Disponivel apos aprovacao dos documentos obrigatorios.'}
                              </div>
                            )}
                            <div className="space-y-2">
                              {(pre.occupationalExamRequests ?? []).map((aso) => (
                                <div key={aso.id} className="rounded-md bg-muted/40 p-2">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span className="font-medium">{aso.examType}</span>
                                    <Badge variant="outline" className="text-[8px]">{aso.status}</Badge>
                                    {aso.asoRecord?.result && <Badge variant="outline" className="text-[8px]">{aso.asoRecord.result}</Badge>}
                                  </div>
                                  <div className="mt-1 text-muted-foreground">
                                    Solicitado em {formatDateTime(aso.requestedAt).slice(0, 10)}
                                    {aso.dueAt ? ` · prazo ${formatDateTime(aso.dueAt).slice(0, 10)}` : ''}
                                  </div>
                                  {aso.appointment && (
                                    <div className="mt-1 text-muted-foreground">
                                      Agendado: {formatDateTime(aso.appointment.scheduledAt)}
                                      {aso.appointment.location ? ` · ${aso.appointment.location}` : ''}
                                      {aso.appointment.providerName ? ` · ${aso.appointment.providerName}` : ''}
                                    </div>
                                  )}
                                  {aso.asoRecord && (
                                    <div className="mt-1 text-muted-foreground">
                                      Exame: {formatDateTime(aso.asoRecord.examDate).slice(0, 10)}
                                      {aso.asoRecord.validUntil ? ` · validade ${formatDateTime(aso.asoRecord.validUntil).slice(0, 10)}` : ''}
                                    </div>
                                  )}
                                  {aso.operationalNotes && <div className="mt-1 text-muted-foreground">{aso.operationalNotes}</div>}
                                  {['REQUESTED', 'SCHEDULED'].includes(aso.status) && (
                                    <div className="mt-2 flex flex-wrap gap-1">
                                      {canHealth && (
                                        <>
                                          <Button
                                            size="sm"
                                            variant="outline"
                                            disabled={scheduleAso.isPending}
                                            onClick={() => {
                                              const scheduledAt = window.prompt('Data/hora do ASO (AAAA-MM-DDTHH:mm):', new Date(Date.now() + 86400000).toISOString().slice(0, 16));
                                              if (!scheduledAt) return;
                                              scheduleAso.mutate({
                                                id: aso.id,
                                                scheduledAt,
                                                location: window.prompt('Local/clinica:', aso.appointment?.location ?? '') ?? undefined,
                                                providerName: window.prompt('Prestador:', aso.appointment?.providerName ?? '') ?? undefined,
                                              });
                                            }}
                                          >
                                            Agendar
                                          </Button>
                                          <Button
                                            size="sm"
                                            variant="outline"
                                            disabled={recordAsoResult.isPending}
                                            onClick={() => {
                                              const result = (window.prompt('Resultado (APTO, APTO_COM_RESTRICAO ou INAPTO):', 'APTO') ?? '').trim().toUpperCase();
                                              if (!['APTO', 'APTO_COM_RESTRICAO', 'INAPTO'].includes(result)) {
                                                toast.error('Resultado invalido.');
                                                return;
                                              }
                                              const examDate = window.prompt('Data do exame (AAAA-MM-DD):', new Date().toISOString().slice(0, 10));
                                              if (!examDate) return;
                                              recordAsoResult.mutate({
                                                id: aso.id,
                                                result,
                                                examDate,
                                                validUntil: window.prompt('Validade (AAAA-MM-DD, opcional):') ?? undefined,
                                                physicianName: window.prompt('Medico responsavel (opcional):') ?? undefined,
                                              });
                                            }}
                                          >
                                            Registrar resultado
                                          </Button>
                                        </>
                                      )}
                                      <Button size="sm" variant="ghost" className="text-rose-600" disabled={(!canManage && !canHealth) || cancelAso.isPending} onClick={() => cancelAso.mutate({ id: aso.id, reason: window.prompt('Motivo do cancelamento:') ?? undefined })}>Cancelar</Button>
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-md border p-3">
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <div className="mr-auto flex items-center gap-2 text-[10px] font-semibold uppercase text-muted-foreground"><UserCheck className="h-3.5 w-3.5" /> Admissao</div>
                      {detail.admission && <Badge variant="outline" className="text-[8px]">{detail.admission.status}</Badge>}
                      {detail.admission && <Badge variant="outline" className="text-[8px]">eSocial {detail.admission.esocialStatus}</Badge>}
                    </div>
                    {detail.admission ? (
                      <div className="space-y-3 text-xs">
                        <div className="grid gap-2 sm:grid-cols-2">
                          <div className="rounded-md bg-muted/40 p-2">
                            <div className="text-[10px] uppercase text-muted-foreground">Colaborador</div>
                            <div className="truncate font-medium">{detail.admission.employeeId ?? '-'}</div>
                          </div>
                          <div className="rounded-md bg-muted/40 p-2">
                            <div className="text-[10px] uppercase text-muted-foreground">Posicao</div>
                            <div className="truncate font-medium">{detail.admission.positionId ?? '-'}</div>
                          </div>
                          <div className="rounded-md bg-muted/40 p-2">
                            <div className="text-[10px] uppercase text-muted-foreground">Inicio</div>
                            <div className="font-medium">{formatDateTime(detail.admission.admissionDate).slice(0, 10)}</div>
                          </div>
                          <div className="rounded-md bg-muted/40 p-2">
                            <div className="text-[10px] uppercase text-muted-foreground">Onboarding</div>
                            <div className="truncate font-medium">{detail.admission.onboardingProcessId ?? '-'}</div>
                          </div>
                        </div>
                        <div className="space-y-2">
                          {(detail.admission.probationReviews ?? []).length === 0 && <div className="text-muted-foreground">Sem avaliacoes de experiencia.</div>}
                          {(detail.admission.probationReviews ?? []).map((review) => (
                            <div key={review.id} className="flex flex-wrap items-center gap-2 rounded-md bg-muted/40 p-2">
                              <div className="mr-auto">
                                <div className="font-medium">D+{review.cycleDay} - {review.status}</div>
                                <div className="text-muted-foreground">Prazo {formatDateTime(review.dueAt).slice(0, 10)}{review.recommendation ? ` - ${review.recommendation}` : ''}</div>
                              </div>
                              {review.status === 'PENDING' && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  disabled={!canAdmit || completeProbationReview.isPending}
                                  onClick={() => {
                                    const recommendation = (window.prompt('Recomendacao (CONTINUAR, EFETIVAR, ENCERRAR):', 'CONTINUAR') ?? '').trim().toUpperCase();
                                    if (!recommendation) return;
                                    completeProbationReview.mutate({ id: review.id, recommendation, notes: window.prompt('Notas da avaliacao:', review.notes ?? '') ?? undefined });
                                  }}
                                >
                                  Concluir
                                </Button>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <div className="grid gap-2 sm:grid-cols-2">
                          <Input placeholder="CPF" value={admissionDraft.cpf} onChange={(e) => setAdmissionDraft((f) => ({ ...f, cpf: e.target.value }))} disabled={!canAdmit} />
                          <Input placeholder="Matricula" value={admissionDraft.registrationId} onChange={(e) => setAdmissionDraft((f) => ({ ...f, registrationId: e.target.value }))} disabled={!canAdmit} />
                          <Input type="date" value={admissionDraft.admissionDate} onChange={(e) => setAdmissionDraft((f) => ({ ...f, admissionDate: e.target.value }))} disabled={!canAdmit} />
                          <Input type="date" value={admissionDraft.birthDate} onChange={(e) => setAdmissionDraft((f) => ({ ...f, birthDate: e.target.value }))} disabled={!canAdmit} />
                          <NativeSelect value={admissionDraft.sex} onChange={(e) => setAdmissionDraft((f) => ({ ...f, sex: e.target.value }))} disabled={!canAdmit}>
                            <option value="">Sexo nao informado</option>
                            <option value="M">Masculino</option>
                            <option value="F">Feminino</option>
                          </NativeSelect>
                          <NativeSelect value={admissionDraft.raceColor} onChange={(e) => setAdmissionDraft((f) => ({ ...f, raceColor: e.target.value }))} disabled={!canAdmit}>
                            <option value="">Raca/cor nao informada</option>
                            <option value="1">Branca</option>
                            <option value="2">Preta</option>
                            <option value="3">Parda</option>
                            <option value="4">Amarela</option>
                            <option value="5">Indigena</option>
                          </NativeSelect>
                          <Input placeholder="PIS/PASEP" value={admissionDraft.pisPasep} onChange={(e) => setAdmissionDraft((f) => ({ ...f, pisPasep: e.target.value }))} disabled={!canAdmit} />
                          <Input placeholder="Observacoes" value={admissionDraft.notes} onChange={(e) => setAdmissionDraft((f) => ({ ...f, notes: e.target.value }))} disabled={!canAdmit} />
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <Button size="sm" disabled={!canAuthorizeAdmission || authorizeAdmission.isPending} onClick={() => authorizeAdmission.mutate()}>
                            <UserCheck className="mr-1 h-3.5 w-3.5" /> Autorizar admissao
                          </Button>
                          <span className="text-[11px] text-muted-foreground">{admissionReadinessText(detail)}</span>
                        </div>
                      </div>
                    )}
                  </div>

                  <div>
                    <div className="mb-2 flex items-center gap-2 text-[10px] font-semibold uppercase text-muted-foreground"><FileText className="h-3.5 w-3.5" /> Documentos</div>
                    <div className="divide-y rounded-md border">
                      {detail.documents.length === 0 && <div className="p-3 text-xs text-muted-foreground">Nenhum documento.</div>}
                      {detail.documents.map((doc) => (
                        <div key={doc.id} className="flex items-center gap-2 p-2">
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-xs font-medium">{doc.fileName}</div>
                            <div className="text-[10px] text-muted-foreground">{doc.kind} · {formatBytes(doc.sizeBytes)} · {doc.scanStatus}</div>
                          </div>
                          <Button variant="ghost" size="sm" onClick={() => downloadDocument.mutate(doc.id)}>
                            <Download className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <div className="mb-2 text-[10px] font-semibold uppercase text-muted-foreground">Linha do tempo</div>
                    <div className="space-y-2">
                      {detail.events.map((event) => (
                        <div key={event.id} className="rounded-md bg-muted/40 p-2 text-xs">
                          <div className="font-medium">{event.type}</div>
                          {event.note && <div className="text-muted-foreground">{event.note}</div>}
                          <div className="text-[10px] text-muted-foreground">{new Date(event.createdAt).toLocaleString('pt-BR')}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
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

function offerPayload(draft: { salaryAmount: string; startDate: string; expiresAt: string; justification: string }) {
  return {
    salaryAmount: draft.salaryAmount,
    startDate: draft.startDate || undefined,
    expiresAt: draft.expiresAt || undefined,
    justification: draft.justification || undefined,
  };
}

function admissionPayload(draft: AdmissionDraft) {
  return {
    cpf: draft.cpf || undefined,
    admissionDate: draft.admissionDate || undefined,
    registrationId: draft.registrationId || undefined,
    birthDate: draft.birthDate || undefined,
    sex: draft.sex || undefined,
    raceColor: draft.raceColor || undefined,
    pisPasep: draft.pisPasep || undefined,
    notes: draft.notes || undefined,
  };
}

function hasClearedAso(pre: PreAdmission) {
  return (pre.occupationalExamRequests ?? []).some((aso) => aso.status === 'COMPLETED' && ['APTO', 'APTO_COM_RESTRICAO'].includes(aso.asoRecord?.result ?? ''));
}

function admissionReadinessText(detail: ApplicationDetail) {
  if (detail.admission) return 'Admissao registrada.';
  if (!(detail.offers ?? []).some((offer) => offer.status === 'ACCEPTED')) return 'Aguardando proposta aceita.';
  if (!(detail.preAdmissions ?? []).some((pre) => ['ASO_CLEARED', 'COMPLETED'].includes(pre.status) && hasClearedAso(pre))) return 'Aguardando pre-admissao e ASO apto.';
  if (detail.status !== 'ACTIVE') return `Status ${detail.status}.`;
  return 'Pronto para autorizar.';
}

function formatMoney(cents: number | null | undefined, currency = 'BRL') {
  if (cents == null) return '-';
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: currency || 'BRL' }).format(cents / 100);
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

function formatAnswer(answer: unknown): string {
  if (answer === undefined || answer === null || answer === '') return '—';
  if (typeof answer === 'boolean') return answer ? 'Sim' : 'Não';
  if (Array.isArray(answer)) return answer.map(formatAnswer).join(', ');
  if (typeof answer === 'object') return JSON.stringify(answer);
  return String(answer);
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return '—';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return value;
  return date.toLocaleString('pt-BR');
}

function formatRecommendation(value: string | null) {
  const labels: Record<string, string> = {
    STRONG_YES: 'Forte sim',
    YES: 'Sim',
    NEUTRAL: 'Neutro',
    NO: 'Não',
    STRONG_NO: 'Forte não',
  };
  return value ? labels[value] ?? value : 'Sem recomendação';
}

function averageScore(ratings: Array<{ score: number; criterion: ScoreCriterion }>) {
  if (!ratings.length) return 'sem notas';
  const totalWeight = ratings.reduce((sum, rating) => sum + (rating.criterion?.weight ?? 1), 0);
  const score = ratings.reduce((sum, rating) => sum + rating.score * (rating.criterion?.weight ?? 1), 0) / Math.max(totalWeight, 1);
  return `média ${score.toFixed(1)}`;
}

function AiPreview({ label, value }: { label: string; value: unknown }) {
  const items = formatAiItems(value);
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

function formatAiItems(value: unknown): string[] {
  if (!value) return [];
  if (Array.isArray(value)) return value.map((item) => formatAnswer(item)).filter((item) => item !== '—');
  if (typeof value === 'object') return Object.entries(value).map(([key, item]) => `${key}: ${formatAnswer(item)}`);
  return [formatAnswer(value)];
}
