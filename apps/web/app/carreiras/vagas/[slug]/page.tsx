'use client';

import { ChangeEvent, Suspense, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { CheckCircle2, FileUp, LogIn, Send, UserRound } from 'lucide-react';
import {
  type CandidateSession,
  candidateApi,
  companyQuery,
  getCandidateToken,
  resolveCareersCompanySlug,
  setCandidateToken,
} from '@/lib/candidate-api';

interface Vacancy {
  slug: string; title: string; description: string | null; requirements: string | null; benefits: string | null;
  processSteps: string | null; area: string | null; city: string | null; location: string | null;
  workMode: string | null; contractType: string | null; pcd: boolean; salary: string | null; closesAt: string | null; closed: boolean;
}
interface Data { company: { name: string; slug: string | null; logoUrl: string | null }; vacancy: Vacancy }
interface ScreeningQuestion { id: string; order: number; type: string; question: string; required: boolean; options: unknown }
interface ApplyResponse { id: string; status: string }

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3333/api';
const MODE_LABEL: Record<string, string> = { PRESENCIAL: 'Presencial', HIBRIDO: 'Hibrido', REMOTO: 'Remoto' };

export default function VacancyDetailPage() {
  return (
    <Suspense fallback={<main className="min-h-screen bg-slate-50 px-4 py-8 text-sm text-slate-500 dark:bg-slate-950 dark:text-slate-300">Carregando vaga...</main>}>
      <VacancyDetailContent />
    </Suspense>
  );
}

function VacancyDetailContent() {
  const routeParams = useParams();
  const searchParams = useSearchParams();
  const vacancySlug = String(routeParams.slug ?? '');
  const empresa = useMemo(() => resolveCareersCompanySlug(searchParams.get('empresa')), [searchParams]);
  const [data, setData] = useState<Data | null>(null);
  const [questions, setQuestions] = useState<ScreeningQuestion[]>([]);
  const [screeningAnswers, setScreeningAnswers] = useState<Record<string, unknown>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [authMode, setAuthMode] = useState<'login' | 'register' | 'reset'>('login');
  const [authForm, setAuthForm] = useState({ name: '', email: '', phone: '', code: '', password: '' });
  const [authMessage, setAuthMessage] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(false);
  const [applyForm, setApplyForm] = useState({ coverLetter: '', consent: false });
  const [resume, setResume] = useState<File | null>(null);
  const [applyLoading, setApplyLoading] = useState(false);
  const [applyError, setApplyError] = useState<string | null>(null);
  const [appliedId, setAppliedId] = useState<string | null>(null);

  useEffect(() => setToken(getCandidateToken()), []);

  useEffect(() => {
    let active = true;
    setLoading(true); setError(null);
    const qs = new URLSearchParams();
    if (empresa) qs.set('empresa', empresa);
    Promise.all([
      fetch(`${API}/careers/vacancies/${vacancySlug}?${qs.toString()}`).then((r) => (r.ok ? r.json() : Promise.reject(new Error('Vaga nao encontrada ou encerrada.')))),
      fetch(`${API}/careers/vacancies/${vacancySlug}/screening-questions?${qs.toString()}`).then((r) => (r.ok ? r.json() : { questions: [] })),
    ])
      .then(([vacancyData, screening]) => {
        if (active) {
          setData(vacancyData);
          setQuestions(Array.isArray(screening?.questions) ? screening.questions : []);
          setLoading(false);
        }
      })
      .catch((e) => { if (active) { setError(e.message); setLoading(false); } });
    return () => { active = false; };
  }, [vacancySlug, empresa]);

  const suffix = companyQuery(empresa);
  const listSuffix = empresa ? `?empresa=${encodeURIComponent(empresa)}` : '';
  const v = data?.vacancy;
  const missingRequired = questions.some((q) => q.required && isEmptyAnswer(screeningAnswers[q.id]));

  async function register() {
    setAuthLoading(true); setAuthMessage(null);
    try {
      const session = await candidateApi<CandidateSession>(`/careers/candidates/register${suffix}`, {
        method: 'POST',
        json: { name: authForm.name, email: authForm.email, phone: authForm.phone, password: authForm.password },
      });
      setCandidateToken(session.token);
      setToken(session.token);
      setAuthMessage(`Conta criada. Bem-vindo(a), ${session.candidate.name}.`);
    } catch (e) {
      setAuthMessage((e as Error).message);
    } finally {
      setAuthLoading(false);
    }
  }

  async function login() {
    setAuthLoading(true); setAuthMessage(null);
    try {
      const session = await candidateApi<CandidateSession>(`/careers/candidates/login${suffix}`, {
        method: 'POST',
        json: { email: authForm.email, password: authForm.password },
      });
      setCandidateToken(session.token);
      setToken(session.token);
      setAuthMessage(`Acesso liberado para ${session.candidate.name}.`);
    } catch (e) {
      setAuthMessage((e as Error).message);
    } finally {
      setAuthLoading(false);
    }
  }

  async function requestReset() {
    setAuthLoading(true); setAuthMessage(null);
    try {
      await candidateApi(`/careers/candidates/forgot-password`, { method: 'POST', json: { email: authForm.email } });
      setAuthMessage('Se houver uma conta com este e-mail, enviamos um código de redefinição. Confira sua caixa de entrada.');
    } catch (e) {
      setAuthMessage((e as Error).message);
    } finally {
      setAuthLoading(false);
    }
  }

  async function doReset() {
    setAuthLoading(true); setAuthMessage(null);
    try {
      const session = await candidateApi<CandidateSession>(`/careers/candidates/reset-password`, {
        method: 'POST',
        json: { email: authForm.email, code: authForm.code, password: authForm.password },
      });
      setCandidateToken(session.token);
      setToken(session.token);
      setAuthMessage(`Senha redefinida. Bem-vindo(a), ${session.candidate.name}.`);
    } catch (e) {
      setAuthMessage((e as Error).message);
    } finally {
      setAuthLoading(false);
    }
  }

  async function apply() {
    setApplyLoading(true); setApplyError(null);
    try {
      const result = await candidateApi<ApplyResponse>(`/careers/vacancies/${vacancySlug}/apply${suffix}`, {
        method: 'POST',
        json: { coverLetter: applyForm.coverLetter, consent: applyForm.consent, answers: screeningAnswers },
      });
      if (resume) await uploadResume(result.id, resume);
      setAppliedId(result.id);
    } catch (e) {
      setApplyError((e as Error).message);
    } finally {
      setApplyLoading(false);
    }
  }

  function pickResume(event: ChangeEvent<HTMLInputElement>) {
    setResume(event.target.files?.[0] ?? null);
  }

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <header className="border-b bg-white dark:border-slate-800 dark:bg-slate-900">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-5">
          {data?.company.logoUrl && <img src={data.company.logoUrl} alt="" className="h-9 w-auto" />}
          <Link href={`/carreiras${listSuffix}`} className="text-sm font-semibold hover:underline">{data?.company.name ?? 'Carreiras'}</Link>
          <Link href={`/candidato${listSuffix}`} className="ml-auto text-xs font-medium text-sky-600 hover:underline dark:text-sky-400">Area do candidato</Link>
        </div>
      </header>

      <article className="mx-auto max-w-3xl px-4 py-8">
        {loading && <div className="py-12 text-center text-slate-400">Carregando...</div>}
        {error && <div className="rounded-md border border-amber-300 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-800/40 dark:bg-amber-950/20 dark:text-amber-300">{error} <Link href={`/carreiras${listSuffix}`} className="underline">Ver outras vagas</Link></div>}
        {v && (
          <>
            <Link href={`/carreiras${listSuffix}`} className="text-xs text-slate-400 hover:underline">Voltar para vagas</Link>
            <h1 className="mt-2 text-2xl font-bold tracking-tight">{v.title}</h1>
            <p className="mt-1 text-sm text-slate-500">{[v.area, v.city || v.location, v.workMode ? MODE_LABEL[v.workMode] ?? v.workMode : null, v.contractType].filter(Boolean).join(' | ')}</p>
            {v.pcd && <span className="mt-2 inline-block rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-medium text-sky-700 dark:bg-sky-900/30 dark:text-sky-300">Vaga afirmativa PcD</span>}
            {v.salary && <p className="mt-2 text-sm font-medium">Faixa: {v.salary}</p>}

            <Section title="Descricao" text={v.description} />
            <Section title="Requisitos" text={v.requirements} />
            <Section title="Beneficios" text={v.benefits} />
            <Section title="Etapas do processo" text={v.processSteps} />

            <section className="mt-8 rounded-lg border bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
              <h2 className="flex items-center gap-2 text-base font-bold"><Send className="h-4 w-4" /> Candidatura</h2>
              {appliedId ? (
                <div className="mt-4 rounded-md border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/20 dark:text-emerald-300">
                  <div className="flex items-center gap-2 font-semibold"><CheckCircle2 className="h-4 w-4" /> Candidatura enviada.</div>
                  <Link href={`/candidato${listSuffix}`} className="mt-2 inline-block underline">Acompanhar minhas candidaturas</Link>
                </div>
              ) : token ? (
                <div className="mt-4 space-y-3">
                  <textarea
                    value={applyForm.coverLetter}
                    onChange={(e) => setApplyForm((f) => ({ ...f, coverLetter: e.target.value }))}
                    rows={4}
                    placeholder="Mensagem opcional para o recrutador"
                    className="w-full rounded-md border px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
                  />
                  {questions.length > 0 && (
                    <div className="space-y-3 rounded-md border bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950">
                      <div className="text-xs font-semibold uppercase text-slate-500">Perguntas da vaga</div>
                      {questions.map((question) => (
                        <QuestionField
                          key={question.id}
                          question={question}
                          value={screeningAnswers[question.id]}
                          onChange={(value) => setScreeningAnswers((current) => ({ ...current, [question.id]: value }))}
                        />
                      ))}
                    </div>
                  )}
                  <label className="flex cursor-pointer items-center gap-2 rounded-md border border-dashed px-3 py-3 text-sm text-slate-600 dark:border-slate-700 dark:text-slate-300">
                    <FileUp className="h-4 w-4" />
                    <span className="min-w-0 flex-1 truncate">{resume ? resume.name : 'Anexar curriculo em PDF, DOC, DOCX, PNG ou JPG'}</span>
                    <input type="file" accept=".pdf,.doc,.docx,.png,.jpg,.jpeg" className="hidden" onChange={pickResume} />
                  </label>
                  <label className="flex items-start gap-2 text-xs text-slate-500">
                    <input
                      type="checkbox"
                      checked={applyForm.consent}
                      onChange={(e) => setApplyForm((f) => ({ ...f, consent: e.target.checked }))}
                      className="mt-0.5"
                    />
                    Autorizo o tratamento dos meus dados pessoais para fins de recrutamento e selecao desta vaga.
                  </label>
                  {applyError && <div className="rounded-md border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700 dark:border-rose-900/40 dark:bg-rose-950/20 dark:text-rose-300">{applyError}</div>}
                  <button
                    onClick={apply}
                    disabled={applyLoading || !applyForm.consent || missingRequired}
                    className="w-full rounded-md bg-sky-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {applyLoading ? 'Enviando...' : 'Enviar candidatura'}
                  </button>
                </div>
              ) : (
                <div className="mt-4 space-y-3">
                  {authMode !== 'reset' ? (
                    <>
                      <div className="grid grid-cols-2 gap-2 rounded-md bg-slate-100 p-1 text-sm dark:bg-slate-800">
                        <button onClick={() => setAuthMode('login')} className={authMode === 'login' ? activeTab : inactiveTab}>Entrar</button>
                        <button onClick={() => setAuthMode('register')} className={authMode === 'register' ? activeTab : inactiveTab}>Criar conta</button>
                      </div>
                      {authMode === 'register' && (
                        <>
                          <LabeledInput label="Nome" value={authForm.name} onChange={(value) => setAuthForm((f) => ({ ...f, name: value }))} icon={<UserRound className="h-4 w-4" />} />
                          <LabeledInput label="Telefone" value={authForm.phone} onChange={(value) => setAuthForm((f) => ({ ...f, phone: value }))} />
                        </>
                      )}
                      <LabeledInput label="E-mail" value={authForm.email} onChange={(value) => setAuthForm((f) => ({ ...f, email: value }))} />
                      <LabeledInput label="Senha" type="password" value={authForm.password} onChange={(value) => setAuthForm((f) => ({ ...f, password: value }))} />
                      {authMode === 'register' && <p className="text-[11px] text-slate-400">Mínimo de 6 caracteres.</p>}
                      {authMessage && <div className="rounded-md border bg-slate-50 p-3 text-xs text-slate-600 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300">{authMessage}</div>}
                      <button
                        onClick={authMode === 'register' ? register : login}
                        disabled={authLoading || !authForm.email || !authForm.password || (authMode === 'register' && !authForm.name)}
                        className="flex w-full items-center justify-center gap-2 rounded-md bg-sky-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <LogIn className="h-4 w-4" /> {authLoading ? 'Aguarde...' : authMode === 'register' ? 'Criar conta e candidatar-se' : 'Entrar para candidatar-se'}
                      </button>
                      {authMode === 'login' && (
                        <button onClick={() => { setAuthMode('reset'); setAuthMessage(null); }} className="w-full text-center text-xs text-sky-600 hover:underline dark:text-sky-400">Esqueci minha senha</button>
                      )}
                    </>
                  ) : (
                    <>
                      <div className="text-sm font-semibold">Redefinir senha</div>
                      <LabeledInput label="E-mail" value={authForm.email} onChange={(value) => setAuthForm((f) => ({ ...f, email: value }))} />
                      <button onClick={requestReset} disabled={authLoading || !authForm.email} className="w-full rounded-md border px-3 py-2 text-xs font-semibold hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:hover:bg-slate-800">
                        Enviar código de redefinição
                      </button>
                      <LabeledInput label="Código recebido" value={authForm.code} onChange={(value) => setAuthForm((f) => ({ ...f, code: value }))} />
                      <LabeledInput label="Nova senha" type="password" value={authForm.password} onChange={(value) => setAuthForm((f) => ({ ...f, password: value }))} />
                      <p className="text-[11px] text-slate-400">Mínimo de 6 caracteres.</p>
                      {authMessage && <div className="rounded-md border bg-slate-50 p-3 text-xs text-slate-600 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300">{authMessage}</div>}
                      <button
                        onClick={doReset}
                        disabled={authLoading || !authForm.email || !authForm.code || !authForm.password}
                        className="flex w-full items-center justify-center gap-2 rounded-md bg-sky-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <LogIn className="h-4 w-4" /> {authLoading ? 'Aguarde...' : 'Redefinir e entrar'}
                      </button>
                      <button onClick={() => { setAuthMode('login'); setAuthMessage(null); }} className="w-full text-center text-xs text-slate-500 hover:underline">Voltar ao login</button>
                    </>
                  )}
                </div>
              )}
              <p className="mt-3 text-center text-[11px] text-slate-400">Conta de candidato externa, separada do acesso interno da empresa.</p>
            </section>
          </>
        )}
      </article>
    </main>
  );
}

function Section({ title, text }: { title: string; text: string | null }) {
  if (!text) return null;
  return (
    <section className="mt-6">
      <h2 className="text-sm font-bold uppercase text-slate-500">{title}</h2>
      <div className="mt-1 whitespace-pre-wrap text-sm leading-relaxed">{text}</div>
    </section>
  );
}

function LabeledInput({ label, value, onChange, type = 'text', icon }: { label: string; value: string; onChange: (value: string) => void; type?: string; icon?: ReactNode }) {
  return (
    <label className="block text-xs font-medium text-slate-500">
      {label}
      <span className="mt-1 flex items-center gap-2 rounded-md border bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-950">
        {icon}
        <input type={type} value={value} onChange={(e) => onChange(e.target.value)} className="min-w-0 flex-1 bg-transparent text-sm text-slate-900 outline-none dark:text-slate-100" />
      </span>
    </label>
  );
}

function QuestionField({ question, value, onChange }: { question: ScreeningQuestion; value: unknown; onChange: (value: unknown) => void }) {
  const options = Array.isArray(question.options) ? question.options.map(String) : [];
  return (
    <label className="block text-xs font-medium text-slate-600 dark:text-slate-300">
      {question.question}{question.required && <span className="text-rose-500"> *</span>}
      {question.type === 'YES_NO' ? (
        <select value={value === undefined ? '' : String(value)} onChange={(e) => onChange(e.target.value === '' ? undefined : e.target.value === 'true')} className="mt-1 h-10 w-full rounded-md border bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-900">
          <option value="">Selecionar...</option>
          <option value="true">Sim</option>
          <option value="false">Nao</option>
        </select>
      ) : ['SINGLE_CHOICE', 'MULTI_CHOICE'].includes(question.type) && options.length ? (
        <select
          multiple={question.type === 'MULTI_CHOICE'}
          value={Array.isArray(value) ? value.map(String) : value ? [String(value)] : []}
          onChange={(e) => {
            const selected = Array.from(e.currentTarget.selectedOptions).map((option) => option.value);
            onChange(question.type === 'MULTI_CHOICE' ? selected : selected[0]);
          }}
          className="mt-1 min-h-10 w-full rounded-md border bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
        >
          {question.type === 'SINGLE_CHOICE' && <option value="">Selecionar...</option>}
          {options.map((option) => <option key={option} value={option}>{option}</option>)}
        </select>
      ) : (
        <input
          type={question.type === 'NUMBER' ? 'number' : 'text'}
          value={typeof value === 'string' || typeof value === 'number' ? value : ''}
          onChange={(e) => onChange(question.type === 'NUMBER' ? Number(e.target.value) : e.target.value)}
          className="mt-1 h-10 w-full rounded-md border bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-900"
        />
      )}
    </label>
  );
}

async function uploadResume(applicationId: string, file: File) {
  const contentBase64 = await fileToBase64(file);
  await candidateApi('/careers/candidate/documents', {
    method: 'POST',
    json: {
      applicationId,
      kind: 'CV',
      fileName: file.name,
      mimeType: file.type || 'application/octet-stream',
      contentBase64,
    },
  });
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error ?? new Error('Falha ao ler arquivo.'));
    reader.onload = () => {
      const value = String(reader.result ?? '');
      resolve(value.includes(',') ? value.split(',')[1] : value);
    };
    reader.readAsDataURL(file);
  });
}

function isEmptyAnswer(answer: unknown) {
  if (answer === undefined || answer === null) return true;
  if (typeof answer === 'string') return answer.trim() === '';
  if (Array.isArray(answer)) return answer.length === 0;
  return false;
}

const activeTab = 'rounded bg-white px-3 py-2 font-semibold shadow-sm dark:bg-slate-950';
const inactiveTab = 'rounded px-3 py-2 text-slate-500 hover:text-slate-900 dark:hover:text-slate-100';
