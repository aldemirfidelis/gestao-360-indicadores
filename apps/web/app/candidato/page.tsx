'use client';

import { ChangeEvent, Suspense, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Briefcase, Download, FileUp, HeartPulse, LogIn, LogOut, RefreshCw, ShieldCheck, Trash2, UserRound, XCircle } from 'lucide-react';
import {
  type CandidateSession,
  candidateApi,
  clearCandidateToken,
  companyQuery,
  getCandidateToken,
  resolveCareersCompanySlug,
  setCandidateToken,
} from '@/lib/candidate-api';

interface Profile {
  id: string;
  email: string;
  name: string;
  phone: string | null;
  headline: string | null;
  city: string | null;
  linkedinUrl: string | null;
  portfolioUrl: string | null;
  emailVerifiedAt: string | null;
}

interface Application {
  id: string;
  status: string;
  appliedAt: string;
  stage: string | null;
  posting: { title: string; slug: string; city: string | null; workMode: string | null };
  rejectionReason: string | null;
}

interface CandidateDocument {
  id: string;
  kind: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  applicationId: string | null;
  createdAt: string;
}

interface DataRequest {
  id: string;
  type: string;
  status: string;
  details: string | null;
  requestedAt: string;
  resolvedAt: string | null;
}

interface StoredContent { fileName: string; mimeType: string; contentBase64: string }
interface Offer {
  id: string; status: string; revision: number; salaryAmountCents: number; currency: string; startDate: string | null; expiresAt: string | null; acceptedAt: string | null; declinedAt: string | null;
  application: { posting: { title: string; slug: string; city: string | null; workMode: string | null } };
}
interface PreAdmissionDocument {
  id: string; kind: string; title: string; required: boolean; status: string; reviewNote: string | null; candidateDocumentId: string | null;
  candidateDocument?: { fileName: string; sizeBytes: number } | null;
}
interface OccupationalAppointment {
  id: string; status: string; scheduledAt: string; location: string | null; providerName: string | null; instructions: string | null;
}
interface AsoRecord {
  id: string; result: string; examDate: string; validUntil: string | null;
}
interface OccupationalExamRequest {
  id: string; status: string; examType: string; dueAt: string | null; requestedAt: string;
  appointment?: OccupationalAppointment | null; asoRecord?: AsoRecord | null;
}
interface PreAdmission {
  id: string; status: string; admissionTargetDate: string | null;
  application: { posting: { title: string; slug: string } };
  documents: PreAdmissionDocument[];
  occupationalExamRequests?: OccupationalExamRequest[];
}

const STATUS_LABEL: Record<string, string> = {
  ACTIVE: 'Em andamento',
  HIRED: 'Contratado',
  REJECTED: 'Nao selecionado',
  WITHDRAWN: 'Desistiu',
  DISQUALIFIED: 'Desclassificado',
};

export default function CandidatePortalPage() {
  return (
    <Suspense fallback={<main className="min-h-screen bg-slate-50 px-4 py-8 text-sm text-slate-500 dark:bg-slate-950 dark:text-slate-300">Carregando area do candidato...</main>}>
      <CandidatePortalContent />
    </Suspense>
  );
}

function CandidatePortalContent() {
  const searchParams = useSearchParams();
  const empresa = useMemo(() => resolveCareersCompanySlug(searchParams.get('empresa')), [searchParams]);
  const suffix = companyQuery(empresa);
  const publicSuffix = empresa ? `?empresa=${encodeURIComponent(empresa)}` : '';
  const [token, setToken] = useState<string | null>(null);
  const [authMode, setAuthMode] = useState<'login' | 'register' | 'reset'>('login');
  const [authForm, setAuthForm] = useState({ name: '', email: '', phone: '', code: '', password: '' });
  const [authMessage, setAuthMessage] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [profileForm, setProfileForm] = useState({ name: '', phone: '', headline: '', city: '', linkedinUrl: '', portfolioUrl: '' });
  const [applications, setApplications] = useState<Application[]>([]);
  const [documents, setDocuments] = useState<CandidateDocument[]>([]);
  const [dataRequests, setDataRequests] = useState<DataRequest[]>([]);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [preAdmissions, setPreAdmissions] = useState<PreAdmission[]>([]);
  const [dataRequestForm, setDataRequestForm] = useState({ type: 'ACCESS', details: '' });
  const [file, setFile] = useState<File | null>(null);
  const [uploadForm, setUploadForm] = useState({ kind: 'CV', applicationId: '' });
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => setToken(getCandidateToken()), []);

  useEffect(() => {
    if (!token) return;
    void loadPortal();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function loadPortal() {
    setLoading(true); setError(null);
    try {
      const [me, apps, docs, requests, myOffers, myPreAdmissions] = await Promise.all([
        candidateApi<Profile>('/careers/candidate/me'),
        candidateApi<Application[]>('/careers/candidate/applications'),
        candidateApi<CandidateDocument[]>('/careers/candidate/documents'),
        candidateApi<DataRequest[]>('/careers/candidate/data-requests'),
        candidateApi<Offer[]>('/careers/candidate/offers'),
        candidateApi<PreAdmission[]>('/careers/candidate/pre-admissions'),
      ]);
      setProfile(me);
      setProfileForm({
        name: me.name ?? '',
        phone: me.phone ?? '',
        headline: me.headline ?? '',
        city: me.city ?? '',
        linkedinUrl: me.linkedinUrl ?? '',
        portfolioUrl: me.portfolioUrl ?? '',
      });
      setApplications(apps);
      setDocuments(docs);
      setDataRequests(requests);
      setOffers(myOffers);
      setPreAdmissions(myPreAdmissions);
    } catch (e) {
      setError((e as Error).message);
      if ((e as { status?: number }).status === 401) logout();
    } finally {
      setLoading(false);
    }
  }

  async function register() {
    setAuthLoading(true); setAuthMessage(null);
    try {
      const session = await candidateApi<CandidateSession>(`/careers/candidates/register${suffix}`, {
        method: 'POST',
        json: { name: authForm.name, email: authForm.email, phone: authForm.phone, password: authForm.password },
      });
      setCandidateToken(session.token);
      setToken(session.token);
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
      setAuthMessage('Se houver uma conta com este e-mail, enviamos um código de redefinição.');
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
    } catch (e) {
      setAuthMessage((e as Error).message);
    } finally {
      setAuthLoading(false);
    }
  }

  function logout() {
    clearCandidateToken();
    setToken(null);
    setProfile(null);
    setApplications([]);
    setDocuments([]);
    setDataRequests([]);
    setOffers([]);
    setPreAdmissions([]);
  }

  async function saveProfile() {
    setBusy(true); setError(null);
    try {
      const updated = await candidateApi<Profile>('/careers/candidate/me', { method: 'PATCH', json: profileForm });
      setProfile(updated);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function withdraw(id: string) {
    if (!window.confirm('Deseja desistir desta candidatura?')) return;
    setBusy(true); setError(null);
    try {
      await candidateApi(`/careers/candidate/applications/${id}/withdraw`, { method: 'POST' });
      await loadPortal();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function uploadDocument() {
    if (!file) return;
    setBusy(true); setError(null);
    try {
      const contentBase64 = await fileToBase64(file);
      await candidateApi('/careers/candidate/documents', {
        method: 'POST',
        json: {
          kind: uploadForm.kind,
          applicationId: uploadForm.applicationId || undefined,
          fileName: file.name,
          mimeType: file.type || 'application/octet-stream',
          contentBase64,
        },
      });
      setFile(null);
      await loadPortal();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function downloadDocument(id: string) {
    setBusy(true); setError(null);
    try {
      const doc = await candidateApi<StoredContent>(`/careers/candidate/documents/${id}`);
      downloadBase64(doc);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function deleteDocument(id: string) {
    if (!window.confirm('Remover este documento do seu perfil?')) return;
    setBusy(true); setError(null);
    try {
      await candidateApi(`/careers/candidate/documents/${id}`, { method: 'DELETE' });
      await loadPortal();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function createDataRequest() {
    setBusy(true); setError(null);
    try {
      await candidateApi('/careers/candidate/data-requests', { method: 'POST', json: dataRequestForm });
      setDataRequestForm({ type: 'ACCESS', details: '' });
      await loadPortal();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function decideOffer(id: string, decision: 'ACCEPT' | 'DECLINE') {
    const reason = decision === 'DECLINE' ? window.prompt('Motivo opcional da recusa:') ?? undefined : undefined;
    setBusy(true); setError(null);
    try {
      await candidateApi(`/careers/candidate/offers/${id}/decision`, { method: 'POST', json: { decision, reason } });
      await loadPortal();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function submitPreAdmissionDocument(requirementId: string, candidateDocumentId: string) {
    if (!candidateDocumentId) return;
    setBusy(true); setError(null);
    try {
      await candidateApi(`/careers/candidate/pre-admission-documents/${requirementId}/submit`, { method: 'POST', json: { candidateDocumentId } });
      await loadPortal();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function pickFile(event: ChangeEvent<HTMLInputElement>) {
    setFile(event.target.files?.[0] ?? null);
  }

  if (!token) {
    return (
      <main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
        <section className="mx-auto max-w-md rounded-lg border bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h1 className="text-xl font-bold">Area do candidato</h1>
              <p className="text-sm text-slate-500">Acompanhe candidaturas e curriculos enviados.</p>
            </div>
            <UserRound className="h-8 w-8 text-sky-500" />
          </div>
          {authMode !== 'reset' && (
            <div className="mt-5 grid grid-cols-2 gap-2 rounded-md bg-slate-100 p-1 text-sm dark:bg-slate-800">
              <button onClick={() => setAuthMode('login')} className={authMode === 'login' ? activeTab : inactiveTab}>Entrar</button>
              <button onClick={() => setAuthMode('register')} className={authMode === 'register' ? activeTab : inactiveTab}>Criar conta</button>
            </div>
          )}
          <div className="mt-4 space-y-3">
            {authMode === 'reset' ? (
              <>
                <div className="text-sm font-semibold">Redefinir senha</div>
                <Input label="E-mail" value={authForm.email} onChange={(value) => setAuthForm((f) => ({ ...f, email: value }))} />
                <button onClick={requestReset} disabled={authLoading || !authForm.email} className="w-full rounded-md border px-3 py-2 text-xs font-semibold hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:hover:bg-slate-800">Enviar código de redefinição</button>
                <Input label="Código recebido" value={authForm.code} onChange={(value) => setAuthForm((f) => ({ ...f, code: value }))} />
                <Input label="Nova senha" type="password" value={authForm.password} onChange={(value) => setAuthForm((f) => ({ ...f, password: value }))} />
                <p className="text-[11px] text-slate-400">Mínimo de 6 caracteres.</p>
                {authMessage && <div className="rounded-md border bg-slate-50 p-3 text-xs text-slate-600 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300">{authMessage}</div>}
                <button
                  onClick={doReset}
                  disabled={authLoading || !authForm.email || !authForm.code || !authForm.password}
                  className="flex w-full items-center justify-center gap-2 rounded-md bg-sky-600 px-4 py-3 text-sm font-semibold text-white hover:bg-sky-700 disabled:opacity-50"
                >
                  <LogIn className="h-4 w-4" /> {authLoading ? 'Aguarde...' : 'Redefinir e entrar'}
                </button>
                <button onClick={() => { setAuthMode('login'); setAuthMessage(null); }} className="w-full text-center text-xs text-slate-500 hover:underline">Voltar ao login</button>
              </>
            ) : (
              <>
                {authMode === 'register' && (
                  <>
                    <Input label="Nome" value={authForm.name} onChange={(value) => setAuthForm((f) => ({ ...f, name: value }))} />
                    <Input label="Telefone" value={authForm.phone} onChange={(value) => setAuthForm((f) => ({ ...f, phone: value }))} />
                  </>
                )}
                <Input label="E-mail" value={authForm.email} onChange={(value) => setAuthForm((f) => ({ ...f, email: value }))} />
                <Input label="Senha" type="password" value={authForm.password} onChange={(value) => setAuthForm((f) => ({ ...f, password: value }))} />
                {authMode === 'register' && <p className="text-[11px] text-slate-400">Mínimo de 6 caracteres.</p>}
                {authMessage && <div className="rounded-md border bg-slate-50 p-3 text-xs text-slate-600 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300">{authMessage}</div>}
                <button
                  onClick={authMode === 'register' ? register : login}
                  disabled={authLoading || !authForm.email || !authForm.password || (authMode === 'register' && !authForm.name)}
                  className="flex w-full items-center justify-center gap-2 rounded-md bg-sky-600 px-4 py-3 text-sm font-semibold text-white hover:bg-sky-700 disabled:opacity-50"
                >
                  <LogIn className="h-4 w-4" /> {authLoading ? 'Aguarde...' : authMode === 'register' ? 'Criar conta' : 'Entrar'}
                </button>
                {authMode === 'login' && (
                  <button onClick={() => { setAuthMode('reset'); setAuthMessage(null); }} className="w-full text-center text-xs text-sky-600 hover:underline dark:text-sky-400">Esqueci minha senha</button>
                )}
                <Link href={`/carreiras${publicSuffix}`} className="block text-center text-xs text-sky-600 hover:underline dark:text-sky-400">Ver vagas abertas</Link>
              </>
            )}
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <header className="border-b bg-white dark:border-slate-800 dark:bg-slate-900">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-5">
          <div>
            <h1 className="text-lg font-bold">Area do candidato</h1>
            <p className="text-xs text-slate-500">{profile?.email ?? 'Carregando perfil...'}</p>
          </div>
          <div className="ml-auto flex gap-2">
            <Link href={`/carreiras${publicSuffix}`} className="rounded-md border px-3 py-2 text-xs font-semibold hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800">Vagas</Link>
            <button onClick={logout} className="inline-flex items-center gap-1 rounded-md border px-3 py-2 text-xs font-semibold hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"><LogOut className="h-3.5 w-3.5" /> Sair</button>
          </div>
        </div>
      </header>

      <section className="mx-auto grid max-w-5xl gap-4 px-4 py-6 lg:grid-cols-[0.85fr_1.15fr]">
        {error && <div className="lg:col-span-2 rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700 dark:border-rose-900/40 dark:bg-rose-950/20 dark:text-rose-300">{error}</div>}
        {loading && <div className="lg:col-span-2 flex items-center gap-2 text-sm text-slate-500"><RefreshCw className="h-4 w-4 animate-spin" /> Carregando...</div>}

        <div className="space-y-4">
          <Panel title="Perfil">
            <div className="space-y-3">
              <Input label="Nome" value={profileForm.name} onChange={(value) => setProfileForm((f) => ({ ...f, name: value }))} />
              <Input label="Telefone" value={profileForm.phone} onChange={(value) => setProfileForm((f) => ({ ...f, phone: value }))} />
              <Input label="Resumo profissional" value={profileForm.headline} onChange={(value) => setProfileForm((f) => ({ ...f, headline: value }))} />
              <Input label="Cidade" value={profileForm.city} onChange={(value) => setProfileForm((f) => ({ ...f, city: value }))} />
              <Input label="LinkedIn" value={profileForm.linkedinUrl} onChange={(value) => setProfileForm((f) => ({ ...f, linkedinUrl: value }))} />
              <Input label="Portfolio" value={profileForm.portfolioUrl} onChange={(value) => setProfileForm((f) => ({ ...f, portfolioUrl: value }))} />
              <button onClick={saveProfile} disabled={busy} className="w-full rounded-md bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-700 disabled:opacity-50">Salvar perfil</button>
            </div>
          </Panel>

          <Panel title="Privacidade e LGPD">
            <div className="space-y-3">
              <div className="flex items-center gap-2 rounded-md bg-slate-50 p-3 text-xs text-slate-500 dark:bg-slate-950">
                <ShieldCheck className="h-4 w-4 text-sky-500" />
                Seus pedidos ficam registrados para atendimento pela empresa controladora dos dados.
              </div>
              <select value={dataRequestForm.type} onChange={(e) => setDataRequestForm((f) => ({ ...f, type: e.target.value }))} className="h-10 w-full rounded-md border bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950">
                <option value="ACCESS">Acesso aos dados</option>
                <option value="RECTIFICATION">Retificacao</option>
                <option value="PORTABILITY">Portabilidade</option>
                <option value="DELETION">Exclusao/anonimizacao</option>
              </select>
              <textarea value={dataRequestForm.details} onChange={(e) => setDataRequestForm((f) => ({ ...f, details: e.target.value }))} rows={3} placeholder="Detalhes opcionais" className="w-full rounded-md border bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950" />
              <button onClick={createDataRequest} disabled={busy} className="w-full rounded-md border px-4 py-2 text-sm font-semibold hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:hover:bg-slate-800">Abrir solicitacao</button>
              <div className="divide-y rounded-md border dark:divide-slate-800 dark:border-slate-800">
                {dataRequests.length === 0 && <div className="p-3 text-sm text-slate-400">Nenhuma solicitacao aberta.</div>}
                {dataRequests.map((item) => (
                  <div key={item.id} className="p-3 text-xs">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold">{item.type}</span>
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] dark:bg-slate-800">{item.status}</span>
                    </div>
                    {item.details && <div className="mt-1 text-slate-500">{item.details}</div>}
                  </div>
                ))}
              </div>
            </div>
          </Panel>

          <div id="docs">
          <Panel title="Documentos">
            <div className="space-y-3">
              <select value={uploadForm.kind} onChange={(e) => setUploadForm((f) => ({ ...f, kind: e.target.value }))} className="h-10 w-full rounded-md border bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950">
                <option value="CV">Curriculo</option>
                <option value="COVER">Carta</option>
                <option value="CERTIFICATE">Certificado</option>
                <option value="PORTFOLIO">Portfolio</option>
                <option value="OTHER">Outro</option>
              </select>
              <select value={uploadForm.applicationId} onChange={(e) => setUploadForm((f) => ({ ...f, applicationId: e.target.value }))} className="h-10 w-full rounded-md border bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950">
                <option value="">Perfil geral</option>
                {applications.map((app) => <option key={app.id} value={app.id}>{app.posting.title}</option>)}
              </select>
              <label className="flex cursor-pointer items-center gap-2 rounded-md border border-dashed px-3 py-3 text-sm text-slate-600 dark:border-slate-700 dark:text-slate-300">
                <FileUp className="h-4 w-4" />
                <span className="min-w-0 flex-1 truncate">{file ? file.name : 'Selecionar arquivo'}</span>
                <input type="file" accept=".pdf,.doc,.docx,.png,.jpg,.jpeg" className="hidden" onChange={pickFile} />
              </label>
              <button onClick={uploadDocument} disabled={busy || !file} className="w-full rounded-md border px-4 py-2 text-sm font-semibold hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:hover:bg-slate-800">Enviar documento</button>
              <div className="divide-y rounded-md border dark:divide-slate-800 dark:border-slate-800">
                {documents.length === 0 && <div className="p-3 text-sm text-slate-400">Nenhum documento enviado.</div>}
                {documents.map((doc) => (
                  <div key={doc.id} className="flex items-center gap-2 p-3 text-sm">
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium">{doc.fileName}</div>
                      <div className="text-[11px] text-slate-500">{doc.kind} | {formatBytes(doc.sizeBytes)}</div>
                    </div>
                    <button onClick={() => downloadDocument(doc.id)} title="Baixar" className="rounded p-2 hover:bg-slate-100 dark:hover:bg-slate-800"><Download className="h-4 w-4" /></button>
                    <button onClick={() => deleteDocument(doc.id)} title="Remover" className="rounded p-2 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/20"><Trash2 className="h-4 w-4" /></button>
                  </div>
                ))}
              </div>
            </div>
          </Panel>
          </div>
        </div>

        <div className="space-y-4">
        <Panel title="Propostas">
          <div className="space-y-3">
            {offers.length === 0 && <div className="rounded-md border border-dashed p-6 text-center text-sm text-slate-400 dark:border-slate-800">Nenhuma proposta enviada.</div>}
            {offers.map((offer) => (
              <div key={offer.id} className="rounded-md border p-4 text-sm dark:border-slate-800">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-semibold">{offer.application.posting.title}</h3>
                    <p className="text-xs text-slate-500">{[offer.application.posting.city, offer.application.posting.workMode].filter(Boolean).join(' | ')}</p>
                  </div>
                  <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-200">{offer.status}</span>
                </div>
                <div className="mt-3 rounded-md bg-slate-50 p-3 text-xs text-slate-600 dark:bg-slate-950 dark:text-slate-300">
                  <div className="font-semibold">{formatMoney(offer.salaryAmountCents, offer.currency)}</div>
                  <div>Inicio previsto: {formatDate(offer.startDate)} | Validade: {formatDate(offer.expiresAt)}</div>
                </div>
                {offer.status === 'SENT' && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button onClick={() => decideOffer(offer.id, 'ACCEPT')} disabled={busy} className="rounded-md bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50">Aceitar proposta</button>
                    <button onClick={() => decideOffer(offer.id, 'DECLINE')} disabled={busy} className="rounded-md border px-3 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 disabled:opacity-50 dark:border-slate-700 dark:hover:bg-rose-950/20">Recusar</button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Pre-admissao">
          <div className="space-y-3">
            {preAdmissions.length === 0 && <div className="rounded-md border border-dashed p-6 text-center text-sm text-slate-400 dark:border-slate-800">Nenhum checklist aberto.</div>}
            {preAdmissions.map((pre) => (
              <div key={pre.id} className="rounded-md border p-4 text-sm dark:border-slate-800">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-semibold">{pre.application.posting.title}</h3>
                    <p className="text-xs text-slate-500">Data alvo: {formatDate(pre.admissionTargetDate)}</p>
                  </div>
                  <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-200">{pre.status}</span>
                </div>
                <div className="mt-3 divide-y rounded-md border dark:divide-slate-800 dark:border-slate-800">
                  {pre.documents.map((item) => (
                    <div key={item.id} className="p-3 text-xs">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold">{item.title}</span>
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] dark:bg-slate-800">{item.status}</span>
                        {item.required && <span className="text-rose-500">*</span>}
                      </div>
                      {item.candidateDocument && <div className="mt-1 text-slate-500">{item.candidateDocument.fileName}</div>}
                      {item.reviewNote && <div className="mt-1 rounded bg-slate-50 p-2 text-slate-500 dark:bg-slate-950">{item.reviewNote}</div>}
                      {['PENDING', 'REJECTED', 'SUBMITTED'].includes(item.status) && (
                        <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_auto]">
                          <select
                            defaultValue={item.candidateDocumentId ?? ''}
                            onChange={(e) => submitPreAdmissionDocument(item.id, e.target.value)}
                            disabled={busy || documents.length === 0}
                            className="h-9 rounded-md border bg-white px-3 text-xs dark:border-slate-700 dark:bg-slate-950"
                          >
                            <option value="">Selecionar documento enviado...</option>
                            {documents.map((doc) => <option key={doc.id} value={doc.id}>{doc.fileName}</option>)}
                          </select>
                          <Link href="#docs" className="rounded-md border px-3 py-2 text-center text-xs font-semibold hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800">Enviar novo</Link>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                {(pre.occupationalExamRequests ?? []).length > 0 && (
                  <div className="mt-3 rounded-md border p-3 text-xs dark:border-slate-800">
                    <div className="mb-2 flex items-center gap-2 font-semibold text-slate-600 dark:text-slate-300"><HeartPulse className="h-4 w-4 text-sky-500" /> ASO admissional</div>
                    <div className="space-y-2">
                      {(pre.occupationalExamRequests ?? []).map((aso) => (
                        <div key={aso.id} className="rounded-md bg-slate-50 p-2 dark:bg-slate-950">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-semibold">{aso.examType}</span>
                            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] dark:bg-slate-800">{aso.status}</span>
                            {aso.asoRecord?.result && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] dark:bg-slate-800">{aso.asoRecord.result}</span>}
                          </div>
                          {aso.appointment && (
                            <div className="mt-1 text-slate-500">
                              Agendado: {formatDateTime(aso.appointment.scheduledAt)}
                              {aso.appointment.location ? ` | ${aso.appointment.location}` : ''}
                              {aso.appointment.providerName ? ` | ${aso.appointment.providerName}` : ''}
                            </div>
                          )}
                          {aso.appointment?.instructions && <div className="mt-1 text-slate-500">{aso.appointment.instructions}</div>}
                          {aso.asoRecord && <div className="mt-1 text-slate-500">Exame: {formatDate(aso.asoRecord.examDate)}{aso.asoRecord.validUntil ? ` | validade ${formatDate(aso.asoRecord.validUntil)}` : ''}</div>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Minhas candidaturas">
          <div className="space-y-3">
            {applications.length === 0 && (
              <div className="rounded-md border border-dashed p-8 text-center text-sm text-slate-400 dark:border-slate-800">
                <Briefcase className="mx-auto mb-2 h-6 w-6" />
                Nenhuma candidatura ainda.
              </div>
            )}
            {applications.map((app) => (
              <div key={app.id} className="rounded-md border p-4 dark:border-slate-800">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-semibold">{app.posting.title}</h3>
                    <p className="text-xs text-slate-500">{[app.posting.city, app.posting.workMode, app.stage].filter(Boolean).join(' | ')}</p>
                  </div>
                  <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-200">{STATUS_LABEL[app.status] ?? app.status}</span>
                </div>
                {app.rejectionReason && <p className="mt-3 rounded-md bg-slate-50 p-3 text-xs text-slate-500 dark:bg-slate-950">{app.rejectionReason}</p>}
                <div className="mt-4 flex flex-wrap gap-2">
                  <Link href={`/carreiras/vagas/${app.posting.slug}${publicSuffix}`} className="rounded-md border px-3 py-2 text-xs font-semibold hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800">Ver vaga</Link>
                  {app.status === 'ACTIVE' && <button onClick={() => withdraw(app.id)} disabled={busy} className="inline-flex items-center gap-1 rounded-md border px-3 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 disabled:opacity-50 dark:border-slate-700 dark:hover:bg-rose-950/20"><XCircle className="h-3.5 w-3.5" /> Desistir</button>}
                </div>
              </div>
            ))}
          </div>
        </Panel>
        </div>
      </section>
    </main>
  );
}

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-lg border bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <h2 className="mb-3 text-sm font-bold uppercase text-slate-500">{title}</h2>
      {children}
    </section>
  );
}

function Input({ label, value, onChange, type = 'text' }: { label: string; value: string; onChange: (value: string) => void; type?: string }) {
  return (
    <label className="block text-xs font-medium text-slate-500">
      {label}
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 h-10 w-full rounded-md border bg-white px-3 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-sky-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
      />
    </label>
  );
}

async function fileToBase64(file: File): Promise<string> {
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

function downloadBase64(doc: StoredContent) {
  const bytes = Uint8Array.from(atob(doc.contentBase64), (char) => char.charCodeAt(0));
  const url = URL.createObjectURL(new Blob([bytes], { type: doc.mimeType }));
  const a = document.createElement('a');
  a.href = url;
  a.download = doc.fileName;
  a.click();
  URL.revokeObjectURL(url);
}

function formatBytes(value: number) {
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / 1024 / 1024).toFixed(1)} MB`;
}

function formatMoney(cents: number, currency = 'BRL') {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: currency || 'BRL' }).format(cents / 100);
}

function formatDate(value: string | null | undefined) {
  if (!value) return '-';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return value;
  return date.toLocaleDateString('pt-BR');
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return '-';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return value;
  return date.toLocaleString('pt-BR');
}

const activeTab = 'rounded bg-white px-3 py-2 font-semibold shadow-sm dark:bg-slate-950';
const inactiveTab = 'rounded px-3 py-2 text-slate-500 hover:text-slate-900 dark:hover:text-slate-100';
